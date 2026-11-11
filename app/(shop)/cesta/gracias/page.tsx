import Link from 'next/link';
import Stripe from 'stripe';
import { finalizeStripeSession } from '@/lib/stripe-orders';
import { baseUrl } from '@/lib/base-url';
import ClearCartOnMount from '@/components/ClearCartOnMount';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pago · EUREKA' };

export default async function GraciasPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams.session_id;
  const key = process.env.STRIPE_SECRET_KEY;

  let ref: string | null = null;
  let paid = false;
  let email: string | null = null;

  if (key && sessionId) {
    try {
      const stripe = new Stripe(key);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const r = await finalizeStripeSession(session, baseUrl()); // idempotente (también lo hace el webhook)
      ref = r.order?.ref ?? null;
      email = r.order?.customerEmail ?? null;
      paid = r.paid && session.payment_status !== 'unpaid';
    } catch {
      /* si Stripe no responde, mostramos estado "procesando" */
    }
  }

  return (
    <main className="page">
      <div className="wrap" style={{ maxWidth: 620 }}>
        {paid && <ClearCartOnMount />}
        <div className="page-head">
          <span className="lab">{paid ? 'Pago confirmado' : 'Tu pedido'}</span>
          <h1>{paid ? '¡Gracias por tu compra!' : 'Procesando tu pago…'}</h1>
          <p>
            {paid ? (
              <>Tu pedido <b>{ref}</b> está pagado. Te hemos enviado la confirmación por email{email ? <> a <b>{email}</b></> : null} y puedes seguirlo en <Link href={`/seguimiento?ref=${encodeURIComponent(ref || '')}&email=${encodeURIComponent(email || '')}`}>Seguir pedido</Link>.</>
            ) : (
              'Si acabas de pagar, tu pedido se confirmará en un momento. Si cancelaste, tu cesta sigue disponible.'
            )}
          </p>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-gold" href="/tienda">Seguir comprando</Link>
          {paid && <Link className="btn" href={`/seguimiento?ref=${encodeURIComponent(ref || '')}&email=${encodeURIComponent(email || '')}`}>Seguir mi pedido</Link>}
          {!paid && <Link className="btn" href="/cesta">Volver a la cesta</Link>}
        </div>
      </div>
    </main>
  );
}
