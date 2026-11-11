// Webhook de Stripe: confirma los pagos aunque la clienta cierre el navegador antes de volver a la web.
// En Stripe → Developers → Webhooks → Add endpoint: https://eurekamoda.com/api/stripe/webhook
// Eventos: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired
// y el "Signing secret" (whsec_…) en .env como STRIPE_WEBHOOK_SECRET.
import Stripe from 'stripe';
import { NextResponse } from 'next/server';
import { finalizeStripeSession, expireStripeSession } from '@/lib/stripe-orders';
import { baseUrl } from '@/lib/base-url';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return NextResponse.json({ error: 'Webhook sin configurar (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).' }, { status: 503 });
  const stripe = new Stripe(key);
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature') || '', secret);
  } catch (e: any) {
    console.error('[stripe] Webhook con firma no válida:', e?.message);
    return NextResponse.json({ error: 'Firma no válida' }, { status: 400 });
  }
  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await finalizeStripeSession(event.data.object as Stripe.Checkout.Session, baseUrl());
    } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      await expireStripeSession(event.data.object as Stripe.Checkout.Session);
    }
  } catch (e: any) {
    console.error('[stripe] Error procesando', event.type, e?.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });   // Stripe lo reintentará
  }
  return NextResponse.json({ received: true });
}
