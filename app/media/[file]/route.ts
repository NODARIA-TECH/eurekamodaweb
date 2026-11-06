import { promises as fs } from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', avif: 'image/avif', gif: 'image/gif',
};

// Sirve las fotos subidas desde el panel (data/uploads). Nombre aleatorio = inmutable -> caché larga.
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  const name = params.file;
  if (!/^[a-z0-9]+\.(webp|jpe?g|png|avif|gif)$/i.test(name)) return new Response('Not found', { status: 404 });
  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, name));
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': MIME[name.split('.').pop()!.toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
