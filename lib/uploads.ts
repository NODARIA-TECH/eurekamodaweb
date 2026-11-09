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

// Devuelve '/media/xxxx.webp' o null si no es una imagen que se pueda leer.
export async function saveUpload(file: unknown): Promise<string | null> {
  const f = file as File | null;
  if (!f || typeof (f as any).arrayBuffer !== 'function' || !f.size) return null;
  if (f.size > MAX_BYTES) return null;
  return saveBuffer(Buffer.from(await f.arrayBuffer()));
}

// Para fotos que llegan como bytes (p.ej. dentro de un ZIP).
export async function saveUploadBuffer(input: Buffer, _filename?: string): Promise<string | null> {
  if (!input.length || input.length > MAX_BYTES) return null;
  return saveBuffer(input);
}

// HEIC/HEIF → JPEG de máxima calidad (sharp no trae el decodificador HEVC).
async function heicToJpeg(input: Buffer): Promise<Buffer> {
  const convert = (await import('heic-convert')).default as (o: { buffer: Buffer; format: 'JPEG' | 'PNG'; quality?: number }) => Promise<ArrayBuffer>;
  return Buffer.from(await convert({ buffer: input, format: 'JPEG', quality: 0.95 }));
}

async function saveBuffer(raw: Buffer): Promise<string | null> {
  const kind = sniffImage(raw);
  if (!kind) return null;             // no es una imagen
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const id = randomUUID().replace(/-/g, '').slice(0, 14);

  let input = raw;
  if (kind === 'heic') {
    try { input = await heicToJpeg(raw); }
    catch (e: any) {
      // Algunos HEIC "modernos" sí los lee sharp directamente; si tampoco, no es válida.
      console.error('[fotos] No se pudo convertir un HEIC:', e?.message);
    }
  }
  try {
    const sharp = (await import('sharp')).default;
    // Quita el marco blanco puro que añaden algunas apps (InShot, exportes del iPhone).
    // Solo blanco casi perfecto: mesas, paredes o fondos claros de la foto no se recortan.
    let base = await sharp(input, { failOn: 'none', animated: false }).rotate().toBuffer();
    try {
      const { info } = await sharp(base).trim({ background: '#ffffff', threshold: 6 }).toBuffer({ resolveWithObject: true });
      const meta = await sharp(base).metadata();
      const keep = (info.width * info.height) / ((meta.width || 1) * (meta.height || 1));
      if (keep > 0.35 && keep < 0.995) base = await sharp(base).trim({ background: '#ffffff', threshold: 6 }).toBuffer();
    } catch { /* foto de un solo color: se deja como está */ }
    const out = await sharp(base)
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .toColourspace('srgb')
      .webp({ quality: 88, smartSubsample: true })
      .toBuffer();
    const name = id + '.webp';
    await fs.writeFile(path.join(UPLOAD_DIR, name), new Uint8Array(out));
    return '/media/' + name;
  } catch (e: any) {
    console.error('[fotos] No se pudo procesar la foto (' + kind + '):', e?.message);
    // Sin sharp: se guarda tal cual si el navegador la puede mostrar.
    if (!['jpg', 'png', 'webp', 'gif', 'avif'].includes(kind)) return null;
    const name = id + '.' + kind;
    await fs.writeFile(path.join(UPLOAD_DIR, name), new Uint8Array(input));
    return '/media/' + name;
  }
}

// Igual que saveUploadBuffer, pero si esa misma foto (mismos bytes) ya se subió antes,
// devuelve la que ya existe en vez de crear otra copia. Así subir dos veces el mismo ZIP no duplica.
const INDEX = path.join(UPLOAD_DIR, 'index.json');
export async function saveUploadBufferOnce(input: Buffer, filename: string): Promise<{ url: string | null; existed: boolean }> {
  const { createHash } = await import('crypto');
  const hash = createHash('sha1').update(new Uint8Array(input)).digest('hex');
  let index: Record<string, string> = {};
  try { index = JSON.parse(await fs.readFile(INDEX, 'utf8')); } catch { /* aún no hay índice */ }
  const prev = index[hash];
  if (prev) {
    try { await fs.access(path.join(UPLOAD_DIR, prev.replace('/media/', ''))); return { url: prev, existed: true }; } catch { /* se borró: se vuelve a guardar */ }
  }
  const url = await saveUploadBuffer(input, filename);
  if (url) {
    index[hash] = url;
    const tmp = INDEX + '.' + process.pid + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(index));
    await fs.rename(tmp, INDEX);
  }
  return { url, existed: false };
}
