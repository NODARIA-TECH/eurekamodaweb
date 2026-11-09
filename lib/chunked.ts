// Subida por trozos: el navegador manda cada archivo en trozos de menos de 1 MB.
// Así da igual el límite de tamaño de Nginx/Cloudflare (por defecto Nginx corta a 1 MB y
// devuelve un 413 sin avisar) y una foto grande de InShot o un ZIP entero suben igual.
import { promises as fs } from 'fs';
import path from 'path';
import { UPLOAD_DIR } from './uploads';

export const PARTS_DIR = path.join(UPLOAD_DIR, '.partes');
export const STAGE_DIR = path.join(UPLOAD_DIR, '.lote');
export const MAX_CHUNK = 960 * 1024;          // el navegador manda 768 KB; margen de seguridad
export const MAX_FILE = 300 * 1024 * 1024;    // un ZIP grande de fotos
const MAX_PARTS = Math.ceil(MAX_FILE / (512 * 1024));
const OLD_MS = 6 * 60 * 60 * 1000;            // trozos/lotes abandonados: se limpian a las 6 h

export const validId = (id: string) => /^[a-z0-9]{10,40}$/i.test(id);

export async function putChunk(id: string, index: number, total: number, data: Buffer) {
  if (!validId(id)) throw new Error('Identificador de subida no válido.');
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || total > MAX_PARTS || index < 0 || index >= total) throw new Error('Trozo no válido.');
  if (data.length > MAX_CHUNK) throw new Error('Trozo demasiado grande.');
  const dir = path.join(PARTS_DIR, id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, String(index).padStart(5, '0')), new Uint8Array(data));
}

// Une los trozos (comprueba que están todos) y borra la carpeta temporal.
export async function assemble(id: string, total: number): Promise<Buffer> {
  const dir = path.join(PARTS_DIR, id);
  const bufs: Buffer[] = [];
  let size = 0;
  for (let i = 0; i < total; i++) {
    let b: Buffer;
    try { b = await fs.readFile(path.join(dir, String(i).padStart(5, '0'))); }
    catch { throw new Error(`Falta el trozo ${i + 1} de ${total}. Vuelve a intentarlo.`); }
    size += b.length;
    if (size > MAX_FILE) throw new Error('El archivo es demasiado grande (máx. 300 MB).');
    bufs.push(b);
  }
  await fs.rm(dir, { recursive: true, force: true });
  return Buffer.concat(bufs.map((b) => new Uint8Array(b.buffer, b.byteOffset, b.byteLength)));
}

// Para el lote: se guarda el archivo completo hasta que se colocan las fotos.
export async function stage(id: string, name: string, data: Buffer) {
  await fs.mkdir(STAGE_DIR, { recursive: true });
  await fs.writeFile(path.join(STAGE_DIR, id), new Uint8Array(data));
  await fs.writeFile(path.join(STAGE_DIR, id + '.json'), JSON.stringify({ name: name.slice(0, 200), size: data.length, at: Date.now() }));
}
export async function readStaged(id: string): Promise<{ name: string; data: Buffer } | null> {
  if (!validId(id)) return null;
  try {
    const meta = JSON.parse(await fs.readFile(path.join(STAGE_DIR, id + '.json'), 'utf8'));
    return { name: String(meta.name || 'foto'), data: await fs.readFile(path.join(STAGE_DIR, id)) };
  } catch { return null; }
}
export async function dropStaged(id: string) {
  if (!validId(id)) return;
  await fs.rm(path.join(STAGE_DIR, id), { force: true });
  await fs.rm(path.join(STAGE_DIR, id + '.json'), { force: true });
}

// Limpieza de subidas a medias (se llama de vez en cuando, sin esperar).
let lastSweep = 0;
export async function sweep() {
  if (Date.now() - lastSweep < 30 * 60 * 1000) return;
  lastSweep = Date.now();
  for (const base of [PARTS_DIR, STAGE_DIR]) {
    let names: string[] = [];
    try { names = await fs.readdir(base); } catch { continue; }
    for (const n of names) {
      try {
        const st = await fs.stat(path.join(base, n));
        if (Date.now() - st.mtimeMs > OLD_MS) await fs.rm(path.join(base, n), { recursive: true, force: true });
      } catch { /* ya no está */ }
    }
  }
}
