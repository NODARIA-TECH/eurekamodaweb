'use server';
import { revalidatePath } from 'next/cache';
import { createProduct, updateProduct, deleteProduct } from '@/lib/store';
import { toCents } from '@/lib/money';

export async function saveProductRow(fd: FormData) {
  const id = String(fd.get('id'));
  await updateProduct(id, {
    price: toCents(String(fd.get('price'))),
    stock: parseInt(String(fd.get('stock') || '0'), 10) || 0,
    badge: String(fd.get('badge') || '') || undefined,
  });
  revalidatePath('/admin/productos');
}

export async function addProduct(fd: FormData) {
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  await createProduct({
    name,
    category: String(fd.get('category') || 'vestidos'),
    price: toCents(String(fd.get('price'))),
    stock: parseInt(String(fd.get('stock') || '0'), 10) || 0,
    image: String(fd.get('image') || '26998033'),
    badge: String(fd.get('badge') || '') || undefined,
  });
  revalidatePath('/admin/productos');
}

export async function removeProduct(fd: FormData) {
  await deleteProduct(String(fd.get('id')));
  revalidatePath('/admin/productos');
}
