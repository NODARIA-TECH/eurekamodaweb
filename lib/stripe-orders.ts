// Cierra un pedido cuando Stripe confirma el pago. Lo usan la página de "gracias" (cuando la clienta
// vuelve de Stripe) y el webhook (aunque cierre el navegador antes de volver). Es idempotente:
// el stock se descuenta y los emails salen una sola vez.
import type Stripe from 'stripe';
import { getOrderByStripeSession, getOrder, markOrderPaid, updateOrderStatus } from './store';
import { sendOrderPaidEmails } from './order-emails';
import type { Order, ShippingAddress } from './types';

function shippingFrom(s: Stripe.Checkout.Session): ShippingAddress | undefined {
  const sd: any = (s as any).collected_information?.shipping_details || (s as any).shipping_details;
  const a = sd?.address;
  if (!a) return undefined;
  return { name: sd.name || undefined, line1: a.line1 || undefined, line2: a.line2 || undefined, postalCode: a.postal_code || undefined, city: a.city || undefined, state: a.state || undefined, country: a.country || undefined };
}

export async function finalizeStripeSession(s: Stripe.Checkout.Session, base: string): Promise<{ order?: Order; paid: boolean }> {
  const order = (await getOrderByStripeSession(s.id)) || (s.metadata?.orderId ? await getOrder(s.metadata.orderId) : undefined);
  if (!order) return { paid: false };
  if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return { order, paid: order.status !== 'pendiente' && order.status !== 'cancelado' };
  const cd = s.customer_details;
  const r = await markOrderPaid(order.id, {
    customerEmail: cd?.email || undefined,
    customerName: cd?.name || undefined,
    phone: cd?.phone || undefined,
    shipping: shippingFrom(s),
    amountPaid: s.amount_total ?? undefined,
    // El envío va como una línea más ('Envío'): es lo cobrado de más sobre los artículos
    shippingCost: s.total_details?.amount_shipping || Math.max(0, (s.amount_subtotal ?? order.total) - order.total),
    discount: s.total_details?.amount_discount || undefined,
  });
  if (r.ok && r.order) await sendOrderPaidEmails(base, r.order);   // no repite: mira o.emails
  return { order: r.order || order, paid: !!r.ok };
}

// La sesión de pago caducó sin pagar (la clienta abandonó): el pedido pendiente se cancela.
export async function expireStripeSession(s: Stripe.Checkout.Session): Promise<void> {
  const order = (await getOrderByStripeSession(s.id)) || (s.metadata?.orderId ? await getOrder(s.metadata.orderId) : undefined);
  if (order && order.status === 'pendiente') await updateOrderStatus(order.id, 'cancelado');
}
