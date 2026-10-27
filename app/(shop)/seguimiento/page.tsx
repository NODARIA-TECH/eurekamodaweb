import type { Metadata } from 'next';
import Link from 'next/link';
import { findOrderForTracking } from '@/lib/store';
import { money } from '@/lib/money';
import OrderTracker from '@/components/OrderTracker';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Seguimiento de pedido · EUREKA' };

export default async function SeguimientoPage({
  searchParams,
}: {
  searchParams: { ref?: string; email?: string };
}) {
  const ref = (searchParams.ref || '').trim();
  const email = (searchParams.email || '').trim();
  const searched = !!(ref && email);
  const order = searched ? await findOrderForTracking(ref, email) : undefined;

  return (
    <main className="page">
      <div className="wrap seg-wrap">
        <div className="page-head">
          <span className="lab">Seguimiento</span>
          <h1>¿Dónde está mi pedido?</h1>
          <p>Introduce la referencia de tu pedido y el correo con el que lo hiciste.</p>
        </div>

        <form className="seg-form" method="get">
          <label>Referencia<input name="ref" defaultValue={ref} placeholder="EUR-1024" required /></label>
          <label>Correo<input name="email" type="email" defaultValue={email} placeholder="tu@correo.com" required /></label>
          <button className="btn btn-ink" type="submit">Buscar pedido</button>
        </form>

        {searched && !order && (
          <p className="seg-none">No encontramos ningún pedido con esos datos. Revisa la referencia y el correo e inténtalo de nuevo.</p>
        )}

        {order && (
          <section className="seg-result">
            <div className="seg-top">
              <div><span className="muted">Pedido</span><strong>{order.ref}</strong></div>
              <div><span className="muted">Total</span><strong>{money(order.total)}</strong></div>
            </div>
            <OrderTracker status={order.status} history={order.history} />
            <div className="seg-items">
              <h3>Artículos</h3>
              <ul>
                {order.items.map((it, i) => (
                  <li key={i}>
                    <span>{it.qty}× {it.name}{it.size ? ` (${it.size})` : ''}</span>
                    <span>{money(it.price * it.qty)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <p className="seg-foot">
          <Link href="/cuenta">¿Tienes cuenta? Entra para ver todos tus pedidos →</Link>
        </p>
      </div>
    </main>
  );
}
