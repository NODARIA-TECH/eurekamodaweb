import { NextResponse } from 'next/server';
import { checkSyncAuth } from '@/lib/sync-auth';
import { setStockBySku, conOrigenStock, listProducts } from '@/lib/store';
import { fsConfigurado, pausaFs, stockPorReferenciaFs } from '@/lib/facturascripts';

export const dynamic = 'force-dynamic';

// POST /api/sync/stock
// FacturaScripts manda sobre el stock (FS -> web).
// Body: { stock: [{ sku, stock }] }  ó  [{ sku, stock }]
export async function POST(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 }); }
  const raw = Array.isArray(body?.stock) ? body.stock : Array.isArray(body) ? body : [];
  const items = raw
    .map((x: any) => ({ sku: String(x.sku || '').trim(), stock: Math.max(0, Math.floor(Number(x.stock))) }))   // sin negativos
    .filter((x: any) => x.sku && Number.isFinite(x.stock));
  if (!items.length) return NextResponse.json({ ok: true, updated: 0, missing: [], note: 'Sin líneas de stock que sincronizar.' });

  const res = await conOrigenStock('FacturaScripts → web (stock, n8n cada 5 min)', () => setStockBySku(items));
  const tallas = await stockDeTallas();
  return NextResponse.json({ ok: true, updated: res.updated, missing: res.missing, ignored: res.ignored, tallas });
}

// n8n solo manda el stock por prenda (la suma de todas sus tallas). El de cada talla/color lo lee aquí
// la web de FacturaScripts, aprovechando esta misma llamada de cada 5 minutos.
async function stockDeTallas() {
  if (!fsConfigurado() || pausaFs()) return { saltado: true };
  try {
    const refs = new Set<string>();
    for (const p of await listProducts()) for (const v of p.variants || []) if (v.sku) refs.add(v.sku.trim().toLowerCase());
    if (!refs.size) return { updated: 0 };
    const fs = await stockPorReferenciaFs();
    const items = Array.from(fs, ([sku, stock]) => ({ sku, stock })).filter((x) => refs.has(x.sku));
    if (!items.length) return { updated: 0 };
    const r = await conOrigenStock('FacturaScripts → web (stock por talla y color, cada 5 min)', () => setStockBySku(items));
    return { updated: r.updated, leidas: items.length };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}
