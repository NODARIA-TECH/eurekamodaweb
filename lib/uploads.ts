// Subida de fotos del panel. Se guardan en data/uploads (persistente, fuera de public/,
// que Next solo sirve si existía al compilar) y se sirven por la ruta /media/[archivo].
// Si sharp está disponible, se redimensionan a 1600px y se convierten a WebP (pesan ~10 veces menos).
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

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const id = randomUUID().replace(/-/g, '').slice(0, 14);
  const input = Buffer.from(await f.arrayBuffer());

  try {
    const sharp = (await import('sharp')).default;
    const out = await sharp(input, { failOn: 'none' })
      .rotate() // respeta la orientación de las fotos del móvil
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
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
