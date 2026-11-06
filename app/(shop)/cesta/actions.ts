'use server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { createOrder, createPendingOrder, setOrderStripeSession } from '@/lib/store';

type Payload = {
  items: { productId: string; qty: number; size?: string; color?: string }[];
  name?: string;
  email?: string;
  code?: string; // código de descuento (promotion code de Stripe)
};

// Checkout. Si hay STRIPE_SECRET_KEY configurada, crea una sesión de Stripe Checkout
// y devuelve la URL para redirigir. Si no, cae al flujo antiguo (pedido directo sin pago).
export async function checkout(payload: Payload): Promise<{ ok: boolean; url?: string; ref?: string; error?: string }> {
  const key = process.env.STRIPE_SECRET_KEY;

  // --- Fallback sin Stripe: comportamiento anterior ---
  if (!key) {
    const res = await createOrder({ items: payload.items, customerName: payload.name, customerEmail: payload.email });
    if (!res.ok) return { ok: false, error: res.error };
    revalidatePath('/tienda');
    revalidatePath('/');
    return { ok: true, ref: res.order!.ref };
  }

  // --- Flujo con Stripe ---
  const stripe = new Stripe(key);

  // Si hay código de descuento, lo validamos ANTES de crear el pedido (y lo resolvemos a su promotion_code).
  let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
  const code = (payload.code || '').trim();
  if (code) {
    try {
      const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
      const pc = list.data[0];
      if (!pc) return { ok: false, error: 'El código de descuento no es válido o ha caducado.' };
      discounts = [{ promotion_code: pc.id }];
    } catch {
      return { ok: false, error: 'No se pudo validar el código de descuento.' };
    }
  }

  const res = await createPendingOrder({ items: payload.items, customerName: payload.name, customerEmail: payload.email });
  if (!res.ok) return { ok: false, error: res.error };
  const order = res.order!;

  const envio = order.total >= 5000 || order.total === 0 ? 0 : 395; // envío gratis desde 50 €

  // URL base para las vueltas de Stripe. Prioriza EUREKA_BASE_URL (p.ej. https://eurekamoda.com);
  // si no, la deduce de la petición (host + protocolo reenviado por Nginx/Cloudflare).
  let base = process.env.EUREKA_BASE_URL;
  if (!base) {
    const h = headers();
    const host = h.get('host') || '';
    const proto = h.get('x-forwarded-proto') || 'http';
    base = `${proto}://${host}`;
  }
  base = base.replace(/\/+$/, '');

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((it) => ({
    price_data: {
      currency: 'eur',
      product_data: { name: it.name + (it.size || it.color ? ` (${[it.size && `Talla ${it.size}`, it.color && `Color ${it.color}`].filter(Boolean).join(', ')})` : '') },
      unit_amount: it.price, // céntimos
    },
    quantity: it.qty,
  }));
  if (envio > 0) {
    line_items.push({
      price_data: { currency: 'eur', product_data: { name: 'Envío' }, unit_amount: envio },
      quantity: 1,
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      // Si el cliente metió un código válido en la cesta, lo aplicamos ya; si no, dejamos
      // que pueda introducirlo en la página de Stripe.
      ...(discounts ? { discounts } : { allow_promotion_codes: true }),
      customer_email: payload.email || undefined,
      metadata: { orderId: order.id, ref: order.ref },
      success_url: `${base}/cesta/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/cesta`,
    });
    await setOrderStripeSession(order.id, session.id);
    return { ok: true, url: session.url || undefined };
  } catch (e) {
    return { ok: false, error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' };
  }
}
