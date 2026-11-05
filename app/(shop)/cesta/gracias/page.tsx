import Link from 'next/link';
import Stripe from 'stripe';
import { getOrderByStripeSession, markOrderPaid } from '@/lib/store';
import ClearCartOnMount from '@/components/ClearCartOnMount';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pago · EUREKA' };

export default async function GraciasPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const sessionId = searchParams.session_id;
  const key = process.env.STRIPE_SECRET_KEY;

  let ref: string | null = null;
  let paid = false;

  if (key && sessionId) {
    try {
      const stripe = new Stripe(key);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const order = await getOrderByStripeSession(sessionId);
      ref = order?.ref ?? null;
      if (session.payment_status === 'paid' && order) {
        await markOrderPaid(order.id); // idempotente
        paid = true;
      }
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
              <>Tu pedido <b>{ref}</b> está pagado. Recibirás la confirmación por email y podrás seguirlo en tu cuenta.</>
            ) : (
              'Si acabas de pagar, tu pedido se confirmará en un momento. Si cancelaste, tu cesta sigue disponible.'
            )}
          </p>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-gold" href="/tienda">Seguir comprando</Link>
          {paid && <Link className="btn" href="/cuenta">Ver mis pedidos</Link>}
          {!paid && <Link className="btn" href="/cesta">Volver a la cesta</Link>}
        </div>
      </div>
    </main>
  );
}
