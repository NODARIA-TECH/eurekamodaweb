// Subida de fotos del panel. Se guardan en data/uploads (persistente, fuera de public/,
// que Next solo sirve si existía al compilar) y se sirven por la ruta /media/[archivo].
// Si sharp está disponible, se dejan en 2000 px como máximo (calidad alta para el zoom) y en WebP.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif',
  'image/heic': 'heic', 'image/heif': 'heic',
};
const MAX_BYTES = 25 * 1024 * 1024;

// Devuelve '/media/xxxx.webp' o null si no hay archivo válido.
export async function saveUpload(file: unknown): Promise<string | null> {
  const f = file as File | null;
  if (!f || typeof (f as any).arrayBuffer !== 'function' || !f.size) return null;
  const type = (f.type || '').toLowerCase();
  const ext = TYPES[type] || (/\.(jpe?g|png|webp|avif|gif|heic|heif)$/i.exec(f.name || '')?.[1]?.toLowerCase().replace('jpeg', 'jpg').replace('heif', 'heic'));
  if (!ext) return null;            // solo imágenes
  if (f.size > MAX_BYTES) return null;

  return saveBuffer(Buffer.from(await f.arrayBuffer()), ext);
}

// Para fotos que llegan como bytes (p.ej. dentro de un ZIP). `filename` decide el formato.
export async function saveUploadBuffer(input: Buffer, filename: string): Promise<string | null> {
  const ext = /\.(jpe?g|png|webp|avif|gif|heic|heif)$/i.exec(filename || '')?.[1]?.toLowerCase().replace('jpeg', 'jpg').replace('heif', 'heic');
  if (!ext || !input.length || input.length > MAX_BYTES) return null;
  return saveBuffer(input, ext);
}

async function saveBuffer(input: Buffer, ext: string): Promise<string | null> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const id = randomUUID().replace(/-/g, '').slice(0, 14);

  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(input, { failOn: 'none' })
      .rotate() // respeta la orientación de las fotos del móvil
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true, kernel: 'lanczos3' })
      .webp({ quality: 88, smartSubsample: true })
      .toBuffer();
    const name = id + '.webp';
    await fs.writeFile(path.join(UPLOAD_DIR, name), new Uint8Array(out));
    return '/media/' + name;
  } catch {
    // Sin sharp (o formato no soportado, p.ej. HEIC sin libheif): se guarda tal cual.
    if (ext === 'heic') return null;
    const name = id + '.' + ext;
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
