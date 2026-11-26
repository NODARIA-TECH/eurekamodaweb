'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { addProductPhotos, createProduct, listCategories } from '@/lib/store';
import { uploadedExists } from '@/lib/uploads';
import { toCents } from '@/lib/money';

export type FotoProducto = { id: string; name: string; sku?: string; image: string; images: string[]; colors: string[]; colorImages: Record<string, string>; price: number; category: string; hidden: boolean };
const pack = (p: { id: string; name: string; sku?: string; image: string; images?: string[]; colors?: string[]; colorImages?: Record<string, string>; price: number; category: string; hidden?: boolean }): FotoProducto => ({
  id: p.id, name: p.name, sku: p.sku, image: p.image, images: p.images || [], colors: p.colors || [], colorImages: p.colorImages || {}, price: p.price, category: p.category, hidden: !!p.hidden,
});

function refrescar() { revalidatePath('/admin/productos'); revalidatePath('/tienda'); revalidatePath('/'); }

// Guarda en el producto las fotos que ya se subieron (una a una, según terminan)
export async function guardarFotos(id: string, srcs: string[], color?: string): Promise<{ ok: boolean; error?: string; producto?: FotoProducto }> {
  requireAdmin();
  const buenas: string[] = [];
  for (const s of srcs.slice(0, 20)) if (typeof s === 'string' && (await uploadedExists(s))) buenas.push(s);
  if (!buenas.length) return { ok: false, error: 'La foto no llegó bien al servidor. Vuelve a subirla.' };
  const p = await addProductPhotos(id, buenas, color || undefined);
  if (!p) return { ok: false, error: 'No encuentro ese producto (¿se ha borrado?).' };
  refrescar();
  return { ok: true, producto: pack(p) };
}

// Prenda nueva desde el móvil: nombre, precio y categoría; las fotos se añaden justo después
export async function crearPrenda(datos: { name: string; price: string; category: string; stock: string }): Promise<{ ok: boolean; error?: string; producto?: FotoProducto }> {
  requireAdmin();
  const name = String(datos.name || '').trim().slice(0, 120);
  if (name.length < 3) return { ok: false, error: 'Escribe el nombre de la prenda.' };
  const cats = await listCategories();
  const category = cats.some((c) => c.slug === datos.category) ? datos.category : (cats[0]?.slug || 'tops');
  const p = await createProduct({ name, category, price: toCents(String(datos.price || '0')), stock: Math.max(0, parseInt(String(datos.stock || '1'), 10) || 0), image: '26998033' });
  refrescar();
  return { ok: true, producto: pack(p) };
}
