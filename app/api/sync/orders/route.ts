import { NextResponse } from 'next/server';
import { checkSyncAuth } from '@/lib/sync-auth';
import { listPendingOrders, markOrderSynced } from '@/lib/store';

export const dynamic = 'force-dynamic';

// GET /api/sync/orders
// Pedidos online pendientes de volcar a FacturaScripts (web -> FS crea el pedido/venta).
export async function GET(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;
  const orders = await listPendingOrders();
  return NextResponse.json({
    ok: true,
    count: orders.length,
    orders: orders.map((o) => ({
      id: o.id,
      ref: o.ref,
      customerName: o.customerName || null,
      customerEmail: o.customerEmail || null,
      total_cents: o.total,
      total: +(o.total / 100).toFixed(2),
      status: o.status,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        qty: i.qty,
        size: i.size || null,
        price_cents: i.price,
        price: +(i.price / 100).toFixed(2),
      })),
    })),
  });
}

// POST /api/sync/orders
// Marca pedidos como ya volcados a FacturaScripts.
// Body: { marks: [{ id, facturaRef? }] }  ó  { id, facturaRef? }
export async function POST(req: Request) {
  const unauth = checkSyncAuth(req);
  if (unauth) return unauth;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'JSON inválido.' }, { status: 400 }); }
  const marks = Array.isArray(body?.marks) ? body.marks : body?.id ? [body] : [];
  if (!marks.length) return NextResponse.json({ ok: false, error: 'Sin pedidos que marcar (id).' }, { status: 400 });

  const results: any[] = [];
  for (const m of marks) {
    const id = String(m.id || '').trim();
    if (!id) { results.push({ id, ok: false }); continue; }
    const ok = await markOrderSynced(id, m.facturaRef ? String(m.facturaRef) : undefined);
    results.push({ id, ok });
  }
  return NextResponse.json({ ok: true, marked: results.filter((r) => r.ok).length, results });
}
