'use server';
import { revalidatePath } from 'next/cache';
import { adjustBalance } from '@/lib/store';
import { toCents } from '@/lib/money';

export async function adjust(fd: FormData) {
  const id = String(fd.get('id'));
  const raw = String(fd.get('amount') || '0');
  const neg = raw.trim().startsWith('-');
  const cents = toCents(raw) * (neg ? -1 : 1);
  await adjustBalance(id, cents, String(fd.get('reason') || 'Ajuste manual'));
  revalidatePath('/admin/clientes/' + id);
  revalidatePath('/admin/clientes');
}
