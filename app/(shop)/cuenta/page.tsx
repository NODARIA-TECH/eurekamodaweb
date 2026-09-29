import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAccountById } from '@/lib/store';
import { readSession, CUSTOMER_COOKIE } from '@/lib/auth';
import { money } from '@/lib/money';
import { logout } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mi cuenta · EUREKA' };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente', pagado: 'Pagado', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
};

export default async function CuentaPage() {
  const id = readSession(cookies().get(CUSTOMER_COOKIE)?.value);
  if (!id) redirect('/cuenta/login');
  const data = await getAccountById(id);
  if (!data) {
    // sesión firmada pero el cliente ya no existe: cerrar sesión
    redirect('/cuenta/login?e=' + encodeURIComponent('Tu sesión ha caducado, vuelve a entrar.'));
  }

  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Área de cliente</span>
          <h1>Mi cuenta</h1>
          <p>Tus pedidos y tu saldo</p>
        </div>

        <section className="acct-hero">
          <div className="acct-who">
            <span className="acct-hi">Hola,</span>
            <h2>{data.customer.name}</h2>
            <span className="acct-mail">{data.customer.email}</span>
          </div>
          <div className="acct-side">
            <div className={'acct-balance' + (data.customer.balance < 0 ? ' neg' : data.customer.balance > 0 ? ' pos' : '')}>
              <span className="lab">{data.customer.balance < 0 ? 'Saldo pendiente' : 'Saldo a favor'}</span>
              <strong>{money(Math.abs(data.customer.balance))}</strong>
              {data.customer.balance < 0 && <span className="acct-tag">Pendiente de pago</span>}
            </div>
            <form action={logout}>
              <button className="acct-logout" type="submit">Cerrar sesión</button>
            </form>
          </div>
        </section>

        <div className="acct-cols">
          <section className="acct-block">
            <h3>Mis pedidos</h3>
            {data.orders.length === 0 ? (
              <p className="muted">Todavía no tienes pedidos. <Link href="/tienda">Ir a la tienda →</Link></p>
            ) : (
              <ul className="acct-orders">
                {data.orders.map((o) => (
                  <li key={o.id}>
                    <div className="ao-top">
                      <span className="ao-ref">{o.ref}</span>
                      <span className={'ao-st st-' + o.status}>{statusLabel[o.status] || o.status}</span>
                    </div>
                    <div className="ao-items">
                      {o.items.map((it, i) => (
                        <span key={i}>{it.qty}× {it.name}{it.size ? ` (${it.size})` : ''}</span>
                      ))}
                    </div>
                    <div className="ao-bot">
                      <span className="muted">{fecha(o.createdAt)}</span>
                      <strong>{money(o.total)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="acct-block">
            <h3>Movimientos de saldo</h3>
            {data.customer.movements.length === 0 ? (
              <p className="muted">Sin movimientos registrados.</p>
            ) : (
              <ul className="acct-mov">
                {data.customer.movements.slice().reverse().map((m) => (
                  <li key={m.id}>
                    <div>
                      <span className="am-reason">{m.reason}</span>
                      <span className="muted">{fecha(m.createdAt)}</span>
                    </div>
                    <strong className={m.amount < 0 ? 'neg' : 'pos'}>
                      {m.amount < 0 ? '−' : '+'}{money(Math.abs(m.amount))}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
