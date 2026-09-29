import type { Metadata } from 'next';
import Link from 'next/link';
import { getAccount } from '@/lib/store';
import { money } from '@/lib/money';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mi cuenta · EUREKA' };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente', pagado: 'Pagado', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
};

export default async function CuentaPage({ searchParams }: { searchParams: { email?: string } }) {
  const email = (searchParams.email || '').trim();
  const data = email ? await getAccount(email) : undefined;

  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Área de cliente</span>
          <h1>Mi cuenta</h1>
          <p>Consulta tus pedidos y tu saldo</p>
        </div>

        <form className="acct-form" action="/cuenta" method="get">
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" /></svg>
            <input name="email" type="email" defaultValue={email} placeholder="Tu correo electrónico" autoComplete="email" />
          </div>
          <button className="btn-search" type="submit">Entrar</button>
        </form>
        <p className="acct-note">Acceso de demostración por correo. El inicio de sesión con contraseña llega en la fase Completo.</p>

        {email && !data && (
          <div className="empty">
            <p>No encontramos ninguna cuenta con <strong>{email}</strong>.</p>
            <p className="muted">Prueba con el correo de un pedido realizado o contacta con la tienda.</p>
          </div>
        )}

        {data && (
          <>
            <section className="acct-hero">
              <div className="acct-who">
                <span className="acct-hi">Hola,</span>
                <h2>{data.customer.name}</h2>
                <span className="acct-mail">{data.customer.email}</span>
              </div>
              <div className={'acct-balance' + (data.customer.balance < 0 ? ' neg' : data.customer.balance > 0 ? ' pos' : '')}>
                <span className="lab">{data.customer.balance < 0 ? 'Saldo pendiente' : 'Saldo a favor'}</span>
                <strong>{money(Math.abs(data.customer.balance))}</strong>
                {data.customer.balance < 0 && <span className="acct-tag">Pendiente de pago</span>}
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
          </>
        )}
      </div>
    </main>
  );
}
