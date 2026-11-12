import { listOrders } from '@/lib/store';
import { money } from '@/lib/money';
import Link from 'next/link';
import { setStatus } from './actions';
import { ORDER_STATUSES } from '@/lib/types';
import { statusLabel, esRecogida } from '@/lib/envio';

export const dynamic = 'force-dynamic';

export default async function PedidosAdmin({ searchParams }: { searchParams: { ok?: string } }) {
  const orders = await listOrders();
  return (
    <>
      <div className="adm-h"><div><h1>Pedidos</h1><p>{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} · pulsa «Gestionar» para cambiar artículos, datos o envío · al marcarlo «Enviado» (o «Listo para recoger» si recoge en tienda), la clienta recibe un email</p></div></div>
      {searchParams.ok === 'borrado' && <div className="adm-ok">Pedido eliminado.</div>}
      <div className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Ref</th><th>Fecha</th><th>Clienta</th><th>Entrega</th><th>Artículos</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={{ whiteSpace: 'nowrap' }}><Link href={`/admin/pedidos/${o.id}`}><b>{o.ref}</b></Link><div><Link className="btn-sm ghost" href={`/admin/pedidos/${o.id}`} style={{ marginTop: 6, display: 'inline-block' }}>Gestionar</Link></div></td>
                <td>{new Date(o.createdAt).toLocaleDateString('es-ES')}</td>
                <td>
                  <div>{o.customerName ?? '—'}</div>
                  {o.customerEmail && <div className="adm-help" style={{ margin: 0 }}><a href={`mailto:${o.customerEmail}`}>{o.customerEmail}</a></div>}
                  {o.phone && <div className="adm-help" style={{ margin: 0 }}><a href={`tel:${o.phone}`}>{o.phone}</a></div>}
                </td>
                <td style={{ fontSize: '.82rem', lineHeight: 1.4, minWidth: 170 }}>
                  {esRecogida(o) ? <span className="badge-pickup">Recogida en tienda</span> : o.shipping ? [o.shipping.name, o.shipping.line1, o.shipping.line2, [o.shipping.postalCode, o.shipping.city].filter(Boolean).join(' '), o.shipping.state].filter(Boolean).map((l, i) => <div key={i}>{l}</div>) : <span className="adm-help" style={{ margin: 0 }}>—</span>}
                </td>
                <td>{o.items.map((i) => `${i.qty}× ${i.name}${(i.size || i.color) ? ' (' + [i.size, i.color].filter(Boolean).join(' · ') + ')' : ''}`).join(', ')}</td>
                <td>
                  <b>{money(o.amountPaid ?? o.total)}</b>
                  {o.amountPaid != null && (o.shippingCost || o.discount) ? <div className="adm-help" style={{ margin: 0 }}>{o.shippingCost ? `envío ${money(o.shippingCost)}` : ''}{o.shippingCost && o.discount ? ' · ' : ''}{o.discount ? `dto. −${money(o.discount)}` : ''}</div> : null}
                  {o.emails?.confirmacion && <div className="adm-help" style={{ margin: 0 }} title="Email de confirmación enviado a la clienta">✉ confirmación</div>}
                  {o.emails?.enviado && <div className="adm-help" style={{ margin: 0 }} title="Email de envío enviado a la clienta">✉ enviado</div>}
                </td>
                <td>
                  <form action={setStatus} className="adm-inline">
                    <input type="hidden" name="id" value={o.id} />
                    <span className={'badge-pill st-' + o.status}>{statusLabel(o.status, esRecogida(o))}</span>
                    <select name="status" defaultValue={o.status}>
                      {ORDER_STATUSES.map((s) => (<option key={s} value={s}>{statusLabel(s, esRecogida(o))}</option>))}
                    </select>
                    <button className="btn-sm ghost" type="submit">Guardar</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
