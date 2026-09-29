'use server';
import { revalidatePath } from 'next/cache';
import { createOrder } from '@/lib/store';

export async function checkout(payload: {
  items: { productId: string; qty: number; size?: string }[];
  name?: string;
  email?: string;
}): Promise<{ ok: boolean; ref?: string; error?: string }> {
  const res = await createOrder({ items: payload.items, customerName: payload.name, customerEmail: payload.email });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath('/tienda');
  revalidatePath('/');
  return { ok: true, ref: res.order!.ref };
}
