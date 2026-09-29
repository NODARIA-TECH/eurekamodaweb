'use server';
import { revalidatePath } from 'next/cache';
import { updateOrderStatus } from '@/lib/store';
import type { Order } from '@/lib/types';

export async function setStatus(fd: FormData) {
  await updateOrderStatus(String(fd.get('id')), String(fd.get('status')) as Order['status']);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}
