// Subida de fotos del panel. Se guardan en data/uploads (persistente, fuera de public/,
// que Next solo sirve si existía al compilar) y se sirven por la ruta /media/[archivo].
// Si sharp está disponible, se dejan en 2000 px como máximo (calidad alta para el zoom) y en WebP.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const MAX_BYTES = 40 * 1024 * 1024;

// Formato real de la foto por su contenido (no por el nombre): así valen .JPG, .jpeg, .PNG, .HEIC,
// fotos sin extensión o con la extensión cambiada (InShot, WhatsApp, iPhone…).
export type ImgKind = 'jpg' | 'png' | 'webp' | 'gif' | 'avif' | 'heic' | 'tiff' | 'bmp';
export function sniffImage(b: Buffer): ImgKind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (b.toString('latin1', 0, 3) === 'GIF') return 'gif';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return 'tiff';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.toString('latin1', 4, 8) === 'ftyp') {
    // Marcas ISO-BMFF: avif = AV1; heic/heix/hevc/mif1… = HEIF del iPhone y apps como InShot
    const brands = b.toString('latin1', 8, Math.min(b.length, 64));
    if (/avif|avis/.test(brands.slice(0, 4))) return 'avif';
    if (/heic|heix|hevc|hevx|heim|heis|mif1|msf1|heif/.test(brands)) return 'heic';
    if (/avif|avis/.test(brands)) return 'avif';
  }
  return null;
}

export type SaveResult =
  | { ok: true; src: string; width?: number; height?: number; kind: ImgKind; ms: number }
  | { ok: false; error: string; code: 'vacio' | 'grande' | 'formato' | 'heic' | 'proceso' | 'disco' };

const MB = (n: number) => (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';

// Devuelve '/media/xxxx.webp' o null si no es una imagen que se pueda leer.
export async function saveUpload(file: unknown): Promise<string | null> {
  const f = file as File | null;
  if (!f || typeof (f as any).arrayBuffer !== 'function' || !f.size) return null;
  if (f.size > MAX_BYTES) return null;
  const r = await saveBufferDetailed(Buffer.from(await f.arrayBuffer()));
  return r.ok ? r.src : null;
}

// Igual, pero con el motivo si falla (null = no se envió ningún archivo).
export async function saveUploadFile(file: unknown): Promise<SaveResult | null> {
  const f = file as File | null;
  if (!f || typeof (f as any).arrayBuffer !== 'function' || !f.size) return null;
  if (f.size > MAX_BYTES) return { ok: false, code: 'grande', error: `La foto pesa ${MB(f.size)}; el máximo es ${MB(MAX_BYTES)}.` };
  return saveBufferDetailed(Buffer.from(await f.arrayBuffer()));
}

// ¿Es una foto subida (/media/…) que de verdad está guardada en el servidor?
export async function uploadedExists(src: string): Promise<boolean> {
  const m = /^\/media\/([a-z0-9]+\.(webp|jpe?g|png|gif|avif))$/i.exec(src || '');
  if (!m) return false;
  try { await fs.access(path.join(UPLOAD_DIR, m[1])); return true; } catch { return false; }
}

// Para fotos que llegan como bytes (p.ej. dentro de un ZIP).
export async function saveUploadBuffer(input: Buffer, _filename?: string): Promise<string | null> {
  const r = await saveBufferDetailed(input);
  return r.ok ? r.src : null;
}

// HEIC/HEIF → JPEG de máxima calidad (sharp no trae el decodificador HEVC).
// Se hace en un hilo aparte (scripts/heic-worker.cjs) que se cierra a los 30 s sin trabajo:
// así los ~400 MB que reserva el decodificador vuelven al sistema. Si el hilo no arranca, se hace aquí.
let worker: any = null;
let workerTimer: ReturnType<typeof setTimeout> | null = null;
let jobSeq = 0;
const jobs = new Map<number, { ok: (b: Buffer) => void; ko: (e: Error) => void }>();
function stopWorker() { try { worker?.terminate(); } catch { /* */ } worker = null; }
async function getWorker() {
  if (worker) return worker;
  const { Worker } = await import('worker_threads');
  const file = path.join(process.cwd(), 'scripts', 'heic-worker.cjs');
  await fs.access(file);
  const w = new Worker(file);
  w.on('message', (m: any) => { const j = jobs.get(m.id); if (!j) return; jobs.delete(m.id); m.ok ? j.ok(Buffer.from(m.data)) : j.ko(new Error(m.error)); });
  const failAll = (e: Error) => { for (const [, j] of Array.from(jobs)) j.ko(e); jobs.clear(); if (worker === w) worker = null; };
  w.on('error', failAll);
  w.on('exit', (code: number) => failAll(new Error('El conversor se cerró (' + code + ')')));
  worker = w;
  return w;
}
async function heicToJpegInWorker(input: Buffer): Promise<Buffer> {
  const w = await getWorker();
  if (workerTimer) clearTimeout(workerTimer);
  const id = ++jobSeq;
  const res = await new Promise<Buffer>((ok, ko) => {
    jobs.set(id, { ok, ko });
    const copy = new Uint8Array(input).slice().buffer;
    w.postMessage({ id, buffer: copy }, [copy]);
  });
  workerTimer = setTimeout(stopWorker, 30000);
  return res;
}
async function heicToJpeg(input: Buffer): Promise<Buffer> {
  try { return await heicToJpegInWorker(input); }
  catch (e: any) {
    if (/no es|invalid|unsupported|not a|HEIF/i.test(e?.message || '')) throw e;   // el archivo está mal: no sirve reintentar
    console.error('[fotos] Conversor HEIC en hilo no disponible, se usa el normal:', e?.message);
    const convert = (await import('heic-convert')).default as (o: { buffer: Buffer; format: 'JPEG' | 'PNG'; quality?: number }) => Promise<ArrayBuffer>;
    return Buffer.from(await convert({ buffer: input, format: 'JPEG', quality: 0.95 }));
  }
}

// Una foto cada vez: convertir HEIC y optimizar gasta mucha memoria y el VPS es pequeño.
let turno: Promise<unknown> = Promise.resolve();
function deUnaEnUna<T>(fn: () => Promise<T>): Promise<T> {
  const run = turno.then(fn, fn);
  turno = run.catch(() => undefined);
  return run;
}

function errDisco(e: any): string {
  const c = e?.code;
  if (c === 'ENOSPC' || c === 'EDQUOT') return 'El servidor se ha quedado sin espacio en disco.';
  if (c === 'EACCES' || c === 'EPERM' || c === 'EROFS') return 'El servidor no tiene permiso para guardar fotos en data/uploads (revisa el propietario de la carpeta).';
  return 'No se pudo guardar la foto en el servidor (' + (e?.message || c || 'error de disco') + ').';
}

// Últimos fallos de subida (para Panel → Diagnóstico)
export const recentUploadErrors: { at: string; error: string }[] = [];
function noteError(error: string) {
  recentUploadErrors.unshift({ at: new Date().toISOString(), error });
  recentUploadErrors.length = Math.min(recentUploadErrors.length, 20);
}

export async function saveBufferDetailed(raw: Buffer): Promise<SaveResult> {
  const r = await saveBufferDetailed0(raw);
  if (!r.ok) noteError(r.error);
  return r;
}
async function saveBufferDetailed0(raw: Buffer): Promise<SaveResult> {
  if (!raw?.length) return { ok: false, code: 'vacio', error: 'El archivo está vacío.' };
  if (raw.length > MAX_BYTES) return { ok: false, code: 'grande', error: `La foto pesa ${MB(raw.length)}; el máximo es ${MB(MAX_BYTES)}.` };
  const kind = sniffImage(raw);
  if (!kind) return { ok: false, code: 'formato', error: 'No es una foto (formatos válidos: JPG, PNG, HEIC/HEIF, WebP, AVIF, GIF, TIFF, BMP).' };
  return deUnaEnUna(() => procesar(raw, kind));
}

async function procesar(raw: Buffer, kind: ImgKind): Promise<SaveResult> {
  const t0 = Date.now();
  try { await fs.mkdir(UPLOAD_DIR, { recursive: true }); } catch (e) { return { ok: false, code: 'disco', error: errDisco(e) }; }
  const id = randomUUID().replace(/-/g, '').slice(0, 14);

  let input = raw;
  let heicError = '';
  if (kind === 'heic') {
    try { input = await heicToJpeg(raw); }
    catch (e: any) {
      // Algunos HEIC "modernos" sí los lee sharp directamente; si tampoco, no es válida.
      heicError = e?.message || String(e);
      console.error('[fotos] No se pudo convertir un HEIC:', heicError);
    }
  }
  let out: Buffer | null = null;
  let width: number | undefined, height: number | undefined;
  let procError = '';
  try {
    const sharp = (await import('sharp')).default;
    sharp.cache(false); sharp.concurrency(1);   // poca memoria: el VPS es pequeño y comparte con FacturaScripts
    // Quita el marco blanco puro que añaden algunas apps (InShot, exportes del iPhone).
    // Solo blanco casi perfecto: mesas, paredes o fondos claros de la foto no se recortan.
    let base = await sharp(input, { failOn: 'none', animated: false }).rotate().toBuffer();
    try {
      const { info } = await sharp(base).trim({ background: '#ffffff', threshold: 6 }).toBuffer({ resolveWithObject: true });
      const meta = await sharp(base).metadata();
      const keep = (info.width * info.height) / ((meta.width || 1) * (meta.height || 1));
      if (keep > 0.35 && keep < 0.995) base = await sharp(base).trim({ background: '#ffffff', threshold: 6 }).toBuffer();
    } catch { /* foto de un solo color: se deja como está */ }
    const r = await sharp(base)
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .toColourspace('srgb')
      .webp({ quality: 88, smartSubsample: true })
      .toBuffer({ resolveWithObject: true });
    out = r.data; width = r.info.width; height = r.info.height;
  } catch (e: any) {
    procError = e?.message || String(e);
    console.error('[fotos] No se pudo procesar la foto (' + kind + '):', procError);
  }

  try {
    if (out) {
      const name = id + '.webp';
      await fs.writeFile(path.join(UPLOAD_DIR, name), new Uint8Array(out));
      return { ok: true, src: '/media/' + name, width, height, kind, ms: Date.now() - t0 };
    }
    // Sin sharp: se guarda tal cual si el navegador la puede mostrar.
    const usable = kind === 'heic' && !heicError ? 'jpg' : kind;
    if (['jpg', 'png', 'webp', 'gif', 'avif'].includes(usable)) {
      const name = id + '.' + usable;
      await fs.writeFile(path.join(UPLOAD_DIR, name), new Uint8Array(input));
      return { ok: true, src: '/media/' + name, kind, ms: Date.now() - t0 };
    }
  } catch (e) {
    return { ok: false, code: 'disco', error: errDisco(e) };
  }
  if (kind === 'heic') return { ok: false, code: 'heic', error: 'No se pudo convertir la foto HEIC' + (heicError ? ` (${heicError})` : '') + '. Prueba a exportarla otra vez desde InShot o como JPG.' };
  return { ok: false, code: 'proceso', error: `No se pudo procesar la foto (${kind.toUpperCase()}): ${procError || 'formato no compatible'}.` };
}

// Igual que saveUploadBuffer, pero si esa misma foto (mismos bytes) ya se subió antes,
// devuelve la que ya existe en vez de crear otra copia. Así subir dos veces el mismo ZIP no duplica.
const INDEX = path.join(UPLOAD_DIR, 'index.json');
export async function saveUploadBufferOnce(input: Buffer, filename: string): Promise<{ url: string | null; existed: boolean; error?: string }> {
  const { createHash } = await import('crypto');
  const hash = createHash('sha1').update(new Uint8Array(input)).digest('hex');
  let index: Record<string, string> = {};
  try { index = JSON.parse(await fs.readFile(INDEX, 'utf8')); } catch { /* aún no hay índice */ }
  const prev = index[hash];
  if (prev) {
    try { await fs.access(path.join(UPLOAD_DIR, prev.replace('/media/', ''))); return { url: prev, existed: true }; } catch { /* se borró: se vuelve a guardar */ }
  }
  const r = await saveBufferDetailed(input);
  const url = r.ok ? r.src : null;
  if (url) {
    index[hash] = url;
    const tmp = INDEX + '.' + process.pid + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(index));
    await fs.rename(tmp, INDEX);
  }
  return { url, existed: false, error: r.ok ? undefined : r.error };
}
