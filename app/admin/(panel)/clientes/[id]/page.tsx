import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCustomer, listOrders } from '@/lib/store';
import { STATUS_LABEL } from '@/lib/types';
import ConfirmSubmit from '@/components/admin/ConfirmSubmit';
import { money } from '@/lib/money';
import { adjust, removeCustomer } from '../actions';

export const dynamic = 'force-dynamic';

function balClass(n: number) { return n > 0 ? 'bal-pos' : n < 0 ? 'bal-neg' : 'bal-zero'; }

export default async function ClienteDetalle({ params }: { params: { id: string } }) {
  const c = await getCustomer(params.id);
  if (!c) notFound();
  const movs = c.movements.slice().reverse();
  const orders = (await listOrders()).filter((o) => o.customerId === c.id);
  return (
    <>
      <div className="adm-h">
        <div><h1>{c.name}</h1><p>{c.email} · alta {new Date(c.createdAt).toLocaleDateString('es-ES')}</p></div>
        <Link className="btn-sm ghost" href="/admin/clientes">← Clientes</Link>
      </div>

      <div className="adm-tiles">
        <div className="tile"><div className="k">Balance actual</div><div className={'v ' + balClass(c.balance)}>{money(c.balance)}</div></div>
        <div className="tile"><div className="k">Movimientos</div><div className="v">{c.movements.length}</div></div>
      </div>

      <div className="adm-card">
        <h2>Ajustar balance</h2>
        <form action={adjust} className="adm-form">
          <input type="hidden" name="id" value={c.id} />
          <label>Importe (€) — usa − para restar<input name="amount" placeholder="10 · -5,50" /></label>
          <label>Motivo<input name="reason" placeholder="Vale, devolución, corrección…" /></label>
          <button className="btn-sm gold" type="submit" style={{ height: 40 }}>Aplicar</button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: '.76rem', marginTop: 10 }}>+ suma saldo a favor · − registra deuda.</p>
      </div>

      <div className="adm-card">
        <h2>Movimientos</h2>
        {movs.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Sin movimientos.</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Motivo</th><th>Importe</th></tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.createdAt).toLocaleDateString('es-ES')}</td>
                  <td>{m.reason}</td>
                  <td className={balClass(m.amount)}>{m.amount > 0 ? '+' : ''}{money(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="adm-card">
        <h2>Pedidos</h2>
        {orders.length === 0 ? <p style={{ color: 'var(--muted)' }}>Sin pedidos.</p> : (
          <table className="adm-table">
            <thead><tr><th>Ref</th><th>Fecha</th><th>Total</th><th>Estado</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id}><td><Link href={`/admin/pedidos/${o.id}`}><b>{o.ref}</b></Link></td><td>{new Date(o.createdAt).toLocaleDateString('es-ES')}</td><td>{money(o.amountPaid ?? o.total)}</td><td><span className={'badge-pill st-' + o.status}>{STATUS_LABEL[o.status]}</span></td></tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="adm-card">
        <h2>Eliminar clienta</h2>
        <form action={removeCustomer} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="hidden" name="id" value={c.id} />
          <ConfirmSubmit className="btn-sm danger" message={`¿Eliminar a ${c.name}? Se borran su ficha, su cuenta y su saldo. Sus pedidos se conservan.`}>Eliminar clienta</ConfirmSubmit>
          <span className="adm-help" style={{ margin: 0 }}>Se borran su ficha, su cuenta (si tiene) y su saldo. Sus pedidos se conservan para la contabilidad.</span>
        </form>
      </div>
    </>
  );
}
