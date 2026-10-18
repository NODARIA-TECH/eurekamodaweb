import { NextResponse } from 'next/server';
import { checkSyncAuth } from '@/lib/sync-auth';
import { listProducts, listCategories, upsertProductBySku } from '@/lib/store';

export const dynamic = 'force-dynamic';

// GET  /api/sync/products
// Devuelve el catálogo de la web para que n8n lo vuelque a FacturaScripts (web -> FS).
export async function GET(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  return NextResponse.json({
    ok: true,
    count: products.length,
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku || null,
      name: p.name,
      price_cents: p.price,
      price: +(p.price / 100).toFixed(2),
      stock: p.stock,
      category_slug: p.category,
      category_name: catName.get(p.category) || p.category,
      image: p.image,
      badge: p.badge || null,
      updatedAt: p.updatedAt || null,
    })),
  });
}

// POST /api/sync/products
// Alta/actualización de productos por SKU (FS -> web), para artículos creados en FacturaScripts.
// Body: { products: [{ sku, name, price (euros) | price_cents, stock?, category?, image?, badge? }] }
export async function POST(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 }); }
  const items = Array.isArray(body?.products) ? body.products : Array.isArray(body) ? body : [];
  if (!items.length) return NextResponse.json({ ok: false, error: 'Sin productos.' }, { status: 400 });

  const results: any[] = [];
  for (const it of items) {
    const sku = String(it.sku || '').trim();
    if (!sku || !it.name) { results.push({ sku, ok: false, error: 'Faltan sku o name.' }); continue; }
    const price_cents = it.price_cents != null ? Math.round(Number(it.price_cents)) : Math.round(Number(it.price || 0) * 100);
    const r = await upsertProductBySku({
      sku,
      name: String(it.name),
      price: price_cents,
      stock: it.stock != null ? Number(it.stock) : undefined,
      category: it.category ? String(it.category) : undefined,
      image: it.image ? String(it.image) : undefined,
      badge: it.badge ? String(it.badge) : undefined,
    });
    results.push({ sku, ok: true, created: r.created, id: r.product.id });
  }
  const created = results.filter((r) => r.created).length;
  return NextResponse.json({ ok: true, total: results.length, created, updated: results.filter((r) => r.ok && !r.created).length, results });
}
