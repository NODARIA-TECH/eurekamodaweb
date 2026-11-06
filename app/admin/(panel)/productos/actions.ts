'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  createProduct, updateProduct, deleteProduct, getProduct,
  upsertProductBySku, upsertProductByName, listCategories, createCategory,
} from '@/lib/store';
import { requireAdmin } from '@/lib/admin-auth';
import { saveUpload } from '@/lib/uploads';
import { toCents } from '@/lib/money';
import {
  headerKey, pick, parseColors, parseSizes, parseEuroCents, parseStock, cleanCategory, slugify,
} from '@/lib/catalog-normalize';

const PLACEHOLDER = '26998033';

// Avisa a n8n (webhook) de que el catálogo ha cambiado, para que vuelque a FacturaScripts
// al momento. Si N8N_CATALOG_WEBHOOK no está configurado, no hace nada. Nunca lanza error.
async function pingCatalogSync(): Promise<void> {
  const url = process.env.N8N_CATALOG_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"source":"web-catalog"}',
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* fire-and-forget: el catálogo ya está guardado en la web */ }
}

function refresh(id?: string) {
  revalidatePath('/admin/productos');
  revalidatePath('/tienda');
  revalidatePath('/');
  if (id) revalidatePath(`/producto/${id}`);
}

const list = (v: FormDataEntryValue | null) =>
  String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);

/* ---------- Alta rápida: crea y abre la ficha para completarla ---------- */
export async function createProductQuick(fd: FormData) {
  requireAdmin();
  const name = String(fd.get('name') || '').trim();
  if (!name) redirect('/admin/productos');
  const p = await createProduct({
    name,
    category: String(fd.get('category') || 'vestidos'),
    price: toCents(String(fd.get('price') || '0')),
    stock: parseInt(String(fd.get('stock') || '0'), 10) || 0,
    image: PLACEHOLDER,
  });
  refresh();
  await pingCatalogSync();
  redirect(`/admin/productos/${p.id}?nuevo=1`);
}

/* ---------- Guardar ficha completa (datos + variantes + fotos) ---------- */
export async function saveProduct(fd: FormData) {
  requireAdmin();
  const id = String(fd.get('id') || '');
  const p = await getProduct(id);
  if (!p) redirect('/admin/productos');

  // Fotos del producto: [principal, ...galería]
  let imgs = [p!.image, ...(p!.images || [])].filter((x) => x && x !== PLACEHOLDER);
  const quitar = new Set(fd.getAll('quitar').map(String));
  imgs = imgs.filter((x) => !quitar.has(x));
  for (const f of fd.getAll('galeria')) {
    const url = await saveUpload(f);
    if (url) imgs.push(url);
  }
  const principal = String(fd.get('principal') || '');
  if (principal && imgs.includes(principal)) imgs = [principal, ...imgs.filter((x) => x !== principal)];
  imgs = Array.from(new Set(imgs));

  // Variantes
  const sizes = list(fd.get('tallas'));
  const colors = list(fd.get('colores'));

  // Foto por color: subir nueva, elegir una de la galería, mantener o quitar.
  const colorImages: Record<string, string> = {};
  for (const c of colors) {
    const uploaded = await saveUpload(fd.get(`cfoto:${c}`));
    const choice = String(fd.get(`cpick:${c}`) || '__keep');
    if (uploaded) colorImages[c] = uploaded;
    else if (choice === '__none') continue;
    else if (choice === '__keep') { if (p!.colorImages?.[c]) colorImages[c] = p!.colorImages[c]; }
    else colorImages[c] = choice;
  }

  await updateProduct(id, {
    name: String(fd.get('name') || p!.name).trim() || p!.name,
    category: String(fd.get('category') || p!.category),
    price: toCents(String(fd.get('price') || '0')) || p!.price,
    stock: Math.max(0, parseInt(String(fd.get('stock') ?? p!.stock), 10) || 0),
    badge: String(fd.get('badge') || '').trim() || undefined,
    description: String(fd.get('description') || '').trim() || undefined,
    details: String(fd.get('details') || '').trim() || undefined,
    sizes: sizes.length ? sizes : undefined,
    colors: colors.length ? colors : undefined,
    colorImages: Object.keys(colorImages).length ? colorImages : undefined,
    image: imgs[0] || PLACEHOLDER,
    images: imgs.slice(1),
  });
  refresh(id);
  await pingCatalogSync();
  redirect(`/admin/productos/${id}?ok=1`);
}

export async function removeProduct(fd: FormData) {
  requireAdmin();
  await deleteProduct(String(fd.get('id')));
  refresh();
  redirect('/admin/productos?borrado=1');
}

/* ---------- Importar catálogo (Excel / CSV) ---------- */

// CSV con comillas, BOM y separador auto (',' o ';' del Excel español)
function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^﻿/, '');
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];
  const delim = (lines[0].match(/;/g)?.length || 0) > (lines[0].match(/,/g)?.length || 0) ? ';' : ',';
  const parseLine = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === delim) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map(headerKey);
  return lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { if (h) o[h] = (cells[idx] ?? '').trim(); });
    return o;
  });
}

async function rowsFromFile(file: File): Promise<Record<string, string>[]> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const sheet = wb.SheetNames.find((n) => /producto/i.test(n)) || wb.SheetNames[0];
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheet], { defval: '', raw: true });
    return json.map((r) => {
      const o: Record<string, string> = {};
      for (const k of Object.keys(r)) { const key = headerKey(k); if (key) o[key] = String(r[k] ?? '').trim(); }
      return o;
    });
  }
  return parseCsv(await file.text());
}

export async function importCsv(fd: FormData) {
  requireAdmin();
  const file = fd.get('file') as unknown as File | null;
  if (!file || typeof (file as any).arrayBuffer !== 'function') redirect('/admin/productos');
  const rows = await rowsFromFile(file as File);

  const cats = await listCategories();
  const slugs = new Set(cats.map((c) => c.slug));
  let created = 0, updated = 0;
  const skipped: string[] = [];

  for (const r of rows) {
    const name = pick(r, ['nombre', 'name', 'producto']).replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const price = parseEuroCents(pick(r, ['precio_pvp', 'precio', 'pvp', 'precio_eur']));
    if (!price) { skipped.push(name); continue; } // sin precio no se publica (evita productos a 0 €)

    const catName = cleanCategory(pick(r, ['categoria', 'category'])) || 'Tops';
    const slug = slugify(catName) || 'tops';
    if (!slugs.has(slug)) { await createCategory({ name: catName, slug, image: PLACEHOLDER }); slugs.add(slug); }

    const tallasRaw = pick(r, ['tallas', 'talla', 'sizes']);
    const data = {
      name,
      price,
      category: slug,
      stock: parseStock(pick(r, ['stock_inicial', 'stock', 'unidades'])),
      sizes: tallasRaw ? parseSizes(tallasRaw) ?? [] : undefined,
      colors: parseColors(pick(r, ['colores', 'color', 'colors'])),
      description: pick(r, ['descripcion', 'description']) || undefined,
      details: pick(r, ['composicion_y_cuidados', 'composicion', 'cuidados', 'detalles']) || undefined,
      badge: pick(r, ['etiqueta', 'badge']) || undefined,
      keepStock: true, // al actualizar, el stock lo manda FacturaScripts
      previousName: pick(r, ['nombre_anterior', 'antes_se_llamaba']) || undefined,
    };
    const sku = pick(r, ['referencia', 'sku', 'ref']);
    const { previousName, ...bySku } = data;
    const res = sku ? await upsertProductBySku({ sku, ...bySku }) : await upsertProductByName(data);
    if (res.created) created++; else updated++;
  }
  refresh();
  await pingCatalogSync();
  const q = new URLSearchParams({ imp: '1', c: String(created), u: String(updated), s: String(skipped.length) });
  if (skipped.length) q.set('sn', skipped.slice(0, 8).join(' · '));
  redirect('/admin/productos?' + q.toString());
}
