'use server';
import { requireAdmin } from '@/lib/admin-auth';
import { revalidatePath } from 'next/cache';
import { updateOrderStatus } from '@/lib/store';
import type { Order } from '@/lib/types';

export async function setStatus(fd: FormData) {
  requireAdmin();
  await updateOrderStatus(String(fd.get('id')), String(fd.get('status')) as Order['status']);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}
