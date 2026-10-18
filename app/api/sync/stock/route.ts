import { NextResponse } from 'next/server';
import { checkSyncAuth } from '@/lib/sync-auth';
import { setStockBySku } from '@/lib/store';

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
    .map((x: any) => ({ sku: String(x.sku || '').trim(), stock: Number(x.stock) }))
    .filter((x: any) => x.sku && Number.isFinite(x.stock));
  if (!items.length) return NextResponse.json({ ok: false, error: 'Sin líneas de stock válidas (sku + stock).' }, { status: 400 });

  const res = await setStockBySku(items);
  return NextResponse.json({ ok: true, updated: res.updated, missing: res.missing });
}
