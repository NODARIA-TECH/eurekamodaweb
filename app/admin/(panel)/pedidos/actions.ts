'use server';
import { requireAdmin } from '@/lib/admin-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateOrderStatus, getOrder, updateOrderInfo, updateOrderItems, deleteOrder, deleteCustomer } from '@/lib/store';
import { sendOrderShippedEmail, sendOrderUpdateEmail } from '@/lib/order-emails';
import { baseUrl } from '@/lib/base-url';
import { ORDER_STATUSES, type Order } from '@/lib/types';

const back = (id: string, q = '') => redirect(`/admin/pedidos/${id}${q ? '?' + q : ''}`);
const refresh = (id?: string) => { revalidatePath('/admin/pedidos'); revalidatePath('/admin'); if (id) revalidatePath('/admin/pedidos/' + id); };
const s = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').trim().slice(0, max);

// Cambio rápido desde la lista
export async function setStatus(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  const status = s(fd, 'status') as Order['status'];
  if (!ORDER_STATUSES.includes(status)) return;
  const before = await getOrder(id);
  await updateOrderStatus(id, status);
  if (status === 'enviado' && before?.status !== 'enviado') { const o = await getOrder(id); if (o) await sendOrderShippedEmail(baseUrl(), o); }
  refresh(id);
}

// Estado + envío + aviso a la clienta (ficha del pedido)
export async function saveProgress(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  const status = s(fd, 'status') as Order['status'];
  if (!ORDER_STATUSES.includes(status)) back(id, 'e=' + encodeURIComponent('Estado no válido.'));
  const before = await getOrder(id);
  if (!before) redirect('/admin/pedidos');
  const url = s(fd, 'trackingUrl', 400);
  if (url && !/^https?:\/\//i.test(url)) back(id, 'e=' + encodeURIComponent('El enlace de seguimiento tiene que empezar por https://'));
  // En la recogida en tienda no hay campos de transporte: no se tocan
  if (fd.has('carrier')) await updateOrderInfo(id, { carrier: s(fd, 'carrier', 60), trackingNumber: s(fd, 'trackingNumber', 80), trackingUrl: url });
  const note = s(fd, 'note', 500);
  await updateOrderStatus(id, status, note);
  const notify = fd.get('notify') === 'on';
  let mail = '';
  if (notify) {
    const o = await getOrder(id);
    if (o?.customerEmail) {
      if (status === 'enviado' && before!.status !== 'enviado' && !o.emails?.enviado) { const ok = await sendOrderShippedEmail(baseUrl(), o); mail = !ok ? 'fallo' : o.delivery === 'recogida' ? 'listo' : 'enviado'; }
      else if (status !== before!.status || note) { const ok = await sendOrderUpdateEmail(baseUrl(), o, note); mail = ok ? 'aviso' : 'fallo'; }
    }
  }
  refresh(id);
  back(id, 'ok=progreso' + (mail ? '&mail=' + mail : ''));
}

export async function saveCustomer(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  const email = s(fd, 'customerEmail', 160);
  if (email && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) back(id, 'e=' + encodeURIComponent('El correo no es válido.'));
  const delivery = s(fd, 'delivery');
  await updateOrderInfo(id, {
    ...(delivery === 'envio' || delivery === 'recogida' ? { delivery } : {}),
    customerName: s(fd, 'customerName', 120), customerEmail: email, phone: s(fd, 'phone', 40),
    shipping: { name: s(fd, 'sname', 120) || undefined, line1: s(fd, 'line1', 160) || undefined, line2: s(fd, 'line2', 160) || undefined, postalCode: s(fd, 'postalCode', 12) || undefined, city: s(fd, 'city', 80) || undefined, state: s(fd, 'state', 80) || undefined, country: s(fd, 'country', 2).toUpperCase() || 'ES' },
  });
  refresh(id);
  back(id, 'ok=datos');
}

export async function saveItems(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  const o = await getOrder(id);
  if (!o) redirect('/admin/pedidos');
  const qtys = o!.items.map((_, i) => (fd.get('del' + i) === 'on' ? 0 : Number(fd.get('qty' + i) ?? 0)));
  const addRaw = s(fd, 'add', 200);           // "productId|talla|color"
  const [pid, size, color] = addRaw ? addRaw.split('|') : [];
  const addQty = Math.max(0, Math.floor(Number(fd.get('addQty') || 1)));
  const r = await updateOrderItems(id, qtys, pid ? { productId: pid, size: size || undefined, color: color || undefined, qty: addQty || 1 } : undefined);
  refresh(id);
  back(id, r.ok ? 'ok=articulos' : 'e=' + encodeURIComponent(r.error || 'No se pudo guardar.'));
}

export async function saveNotes(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  await updateOrderInfo(id, { notes: s(fd, 'notes', 2000) });
  refresh(id);
  back(id, 'ok=notas');
}

export async function removeOrder(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  await deleteOrder(id, fd.get('restock') === 'on');
  refresh();
  redirect('/admin/pedidos?ok=borrado');
}

export async function removeCustomerFromOrder(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  const cid = s(fd, 'customerId');
  if (cid) await deleteCustomer(cid);
  revalidatePath('/admin/clientes');
  refresh(id);
  back(id, 'ok=clienta');
}
