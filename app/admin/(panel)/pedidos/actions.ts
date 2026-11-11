'use server';
import { requireAdmin } from '@/lib/admin-auth';
import { revalidatePath } from 'next/cache';
import { updateOrderStatus, getOrder } from '@/lib/store';
import { sendOrderShippedEmail } from '@/lib/order-emails';
import { baseUrl } from '@/lib/base-url';
import type { Order } from '@/lib/types';

const STATES: Order['status'][] = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

export async function setStatus(fd: FormData) {
  requireAdmin();
  const id = String(fd.get('id'));
  const status = String(fd.get('status')) as Order['status'];
  if (!STATES.includes(status)) return;
  await updateOrderStatus(id, status);
  // Al marcarlo como enviado, la clienta recibe un email "tu pedido va de camino" (una sola vez)
  if (status === 'enviado') { const o = await getOrder(id); if (o) await sendOrderShippedEmail(baseUrl(), o); }
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}
