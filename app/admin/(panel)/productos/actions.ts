'use server';
import { revalidatePath } from 'next/cache';
import { createProduct, updateProduct, deleteProduct, upsertProductBySku, listCategories, createCategory } from '@/lib/store';
import { toCents } from '@/lib/money';
import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Guarda una imagen subida en public/uploads y devuelve su ruta pública (/uploads/xxx).
// Devuelve null si no hay archivo válido (tipo no permitido, vacío o demasiado grande).
const UPLOAD_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif',
};
async function saveUpload(file: unknown): Promise<string | null> {
  const f = file as File | null;
  if (!f || typeof (f as any).arrayBuffer !== 'function' || !f.size) return null;
  const ext = UPLOAD_TYPES[(f.type || '').toLowerCase()];
  if (!ext) return null;                         // solo imágenes
  if (f.size > 6 * 1024 * 1024) return null;     // máx. 6 MB
  const name = randomUUID().slice(0, 12) + '.' + ext;
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), new Uint8Array(await f.arrayBuffer()));
  return '/uploads/' + name;
}

// --- Parser CSV con comillas, BOM y separador auto (',' o ';' de Excel español) ---
function parseCsv(text: string): Record<string, string>[] {
  text = text.replace(/^﻿/, ''); // quita BOM
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
      } else {
        if (c === '"') q = true;
        else if (c === delim) { out.push(cur); cur = ''; }
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

// Lee las filas de un archivo CSV o Excel (.xlsx/.xls). Claves en minúsculas.
async function rowsFromFile(file: File): Promise<Record<string, string>[]> {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]]; // primera hoja (Productos)
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '', raw: false });
    return json.map((r) => {
      const o: Record<string, string> = {};
      for (const k of Object.keys(r)) o[String(k).trim().toLowerCase()] = String(r[k] ?? '').trim();
      return o;
    });
  }
  const text = await file.text();
  return parseCsv(text);
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
  const uploaded = await saveUpload(fd.get('foto'));
  const image = uploaded || String(fd.get('image') || '').trim() || '26998033';
  await createProduct({
    name,
    category: String(fd.get('category') || 'vestidos'),
    price: toCents(String(fd.get('price'))),
    stock: parseInt(String(fd.get('stock') || '0'), 10) || 0,
    image,
    badge: String(fd.get('badge') || '') || undefined,
    sku: String(fd.get('sku') || '').trim() || undefined, // vacío = se genera solo (PEK-0001…)
  });
  revalidatePath('/admin/productos');
  revalidatePath('/tienda');
}

// Cambia solo la foto de un producto existente (subida desde el panel).
export async function setProductPhoto(fd: FormData) {
  const id = String(fd.get('id') || '').trim();
  const uploaded = await saveUpload(fd.get('foto'));
  if (!id || !uploaded) return;
  await updateProduct(id, { image: uploaded });
  revalidatePath('/admin/productos');
  revalidatePath('/tienda');
}

export async function removeProduct(fd: FormData) {
  await deleteProduct(String(fd.get('id')));
  revalidatePath('/admin/productos');
}

// Importación de catálogo desde CSV (columnas: referencia, nombre, categoria, precio_pvp, iva, stock, descripcion).
// Precio = PVP (con IVA); se guarda tal cual en la web. SKU vacío = autogenerado (PEK-####).
export async function importCsv(fd: FormData) {
  const file = fd.get('file') as unknown as File | null;
  if (!file || typeof (file as any).arrayBuffer !== 'function') return;
  const rows = await rowsFromFile(file as File);

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
