'use server';
import { revalidatePath } from 'next/cache';
import { createProduct, updateProduct, deleteProduct, upsertProductBySku, listCategories, createCategory } from '@/lib/store';
import { toCents } from '@/lib/money';

// --- Parser CSV sencillo con soporte de comillas ---
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => (o[h] = (cells[idx] ?? '').trim()));
    rows.push(o);
  }
  return rows;
}
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function saveProductRow(fd: FormData) {
  const id = String(fd.get('id'));
  await updateProduct(id, {
    price: toCents(String(fd.get('price'))),
    stock: parseInt(String(fd.get('stock') || '0'), 10) || 0,
    badge: String(fd.get('badge') || '') || undefined,
  });
  revalidatePath('/admin/productos');
}

export async function addProduct(fd: FormData) {
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  await createProduct({
    name,
    category: String(fd.get('category') || 'vestidos'),
    price: toCents(String(fd.get('price'))),
    stock: parseInt(String(fd.get('stock') || '0'), 10) || 0,
    image: String(fd.get('image') || '26998033'),
    badge: String(fd.get('badge') || '') || undefined,
    sku: String(fd.get('sku') || '').trim() || undefined, // vacío = se genera solo (EUR-0001…)
  });
  revalidatePath('/admin/productos');
}

export async function removeProduct(fd: FormData) {
  await deleteProduct(String(fd.get('id')));
  revalidatePath('/admin/productos');
}

// Importación de catálogo desde CSV (columnas: referencia, nombre, categoria, precio_pvp, iva, stock, descripcion).
// Precio = PVP (con IVA); se guarda tal cual en la web. SKU vacío = autogenerado (PEK-####).
export async function importCsv(fd: FormData) {
  const file = fd.get('file') as unknown as File | null;
  if (!file || typeof (file as any).text !== 'function') return;
  const text = await (file as File).text();
  const rows = parseCsv(text);

  const cats = await listCategories();
  const slugs = new Set(cats.map((c) => c.slug));

  for (const r of rows) {
    const name = (r.nombre || r.name || '').trim();
    if (!name) continue;
    const priceCents = Math.round((parseFloat((r.precio_pvp || r.precio || '0').replace(',', '.')) || 0) * 100);
    const stock = parseInt(r.stock || '0', 10) || 0;
    const categoria = (r.categoria || r.category || 'Tops').trim();
    const slug = slugify(categoria) || 'tops';
    if (!slugs.has(slug)) { await createCategory({ name: categoria, slug, image: '26998033' }); slugs.add(slug); }
    const sku = (r.referencia || r.sku || '').trim();
    if (sku) {
      await upsertProductBySku({ sku, name, price: priceCents, stock, category: slug });
    } else {
      await createProduct({ name, price: priceCents, stock, category: slug, image: '26998033' });
    }
  }
  revalidatePath('/admin/productos');
  revalidatePath('/tienda');
}
