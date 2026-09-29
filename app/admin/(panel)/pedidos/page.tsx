import { listOrders } from '@/lib/store';
import { money } from '@/lib/money';
import { setStatus } from './actions';

export const dynamic = 'force-dynamic';
const STATES = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

export default async function PedidosAdmin() {
  const orders = await listOrders();
  return (
    <>
      <div className="adm-h"><div><h1>Pedidos</h1><p>{orders.length} pedidos</p></div></div>
      <div className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Ref</th><th>Fecha</th><th>Cliente</th><th>Artículos</th><th>Total</th><th>Estado</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><b>{o.ref}</b></td>
                <td>{new Date(o.createdAt).toLocaleDateString('es-ES')}</td>
                <td>{o.customerName ?? '—'}</td>
                <td>{o.items.map((i) => `${i.qty}× ${i.name}${i.size ? ' (' + i.size + ')' : ''}`).join(', ')}</td>
                <td><b>{money(o.total)}</b></td>
                <td>
                  <form action={setStatus} className="adm-inline">
                    <input type="hidden" name="id" value={o.id} />
                    <span className={'badge-pill st-' + o.status}>{o.status}</span>
                    <select name="status" defaultValue={o.status}>
                      {STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
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
