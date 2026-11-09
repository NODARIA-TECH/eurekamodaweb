// Biblioteca de fotos del editor: fotos de la web, de los productos y las subidas. POST: subir una foto nueva.
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import { adminGuard, noCache } from '@/lib/admin-api';
import { UPLOAD_DIR, saveUpload } from '@/lib/uploads';
import { listProducts } from '@/lib/store';

export const dynamic = 'force-dynamic';

export interface MediaItem { src: string; name: string; group: 'web' | 'productos' | 'subidas'; at?: number }

const PUB = path.join(process.cwd(), 'public');
const pretty = (f: string) => f.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

async function dir(rel: string, filter: (f: string) => boolean = () => true): Promise<string[]> {
  try { return (await fs.readdir(path.join(PUB, rel))).filter((f) => /\.(webp|jpe?g|png|avif)$/i.test(f) && filter(f)).sort(); }
  catch { return []; }
}

export async function GET(req: Request) {
  const deny = adminGuard(req);
  if (deny) return deny;
  const items: MediaItem[] = [];
  const seen = new Set<string>();
  const add = (it: MediaItem) => { if (!seen.has(it.src)) { seen.add(it.src); items.push(it); } };

  // Subidas (lo más reciente primero)
  try {
    const files = (await fs.readdir(UPLOAD_DIR)).filter((f) => /\.(webp|jpe?g|png|avif|gif)$/i.test(f));
    const stats = await Promise.all(files.map(async (f) => ({ f, t: (await fs.stat(path.join(UPLOAD_DIR, f))).mtimeMs })));
    stats.sort((a, b) => b.t - a.t).forEach(({ f, t }) => add({ src: `/media/${f}`, name: 'Foto subida', group: 'subidas', at: t }));
  } catch { /* aún no hay subidas */ }

  // Fotos de los productos, con su nombre
  const named = new Map<string, string>();
  for (const p of await listProducts()) {
    const all = [p.image, ...(p.images || []), ...Object.values(p.colorImages || {}), ...Object.values(p.colorGallery || {}).flat()];
    for (const src of all) if (src && /^\/(img|media|uploads)\//.test(src) && !named.has(src)) named.set(src, p.name);
  }
  for (const it of items) if (named.has(it.src)) it.name = named.get(it.src)!;

  // Fotos de la web (portada y lookbook)
  for (const f of await dir('img/home')) add({ src: `/img/home/${f}`, name: pretty(f), group: 'web' });
  for (const f of await dir('img/look')) add({ src: `/img/look/${f}`, name: 'Look · ' + pretty(f), group: 'web' });
  for (const [src, name] of Array.from(named)) if (!src.startsWith('/media/') && !/-m\.webp$/.test(src)) add({ src, name, group: 'productos' });
  for (const f of await dir('img/productos', (f) => !/-(encuadre|detalle|m)\./.test(f))) add({ src: `/img/productos/${f}`, name: pretty(f), group: 'productos' });

  return NextResponse.json({ items }, { headers: noCache });
}

export async function POST(req: Request) {
  const deny = adminGuard(req, { write: true });
  if (deny) return deny;
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: 'No se recibió la foto.' }, { status: 400 }); }
  const src = await saveUpload(form.get('file'));
  if (!src) return NextResponse.json({ error: 'Ese archivo no es una foto válida (JPG, PNG, WEBP o HEIC, máx. 25 MB).' }, { status: 400 });
  return NextResponse.json({ src }, { headers: noCache });
}
