'use server';
import { revalidatePath } from 'next/cache';
import { createCategory, deleteCategory } from '@/lib/store';

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function addCategory(fd: FormData) {
  const name = String(fd.get('name') || '').trim();
  if (!name) return;
  const slug = slugify(String(fd.get('slug') || '') || name);
  await createCategory({ name, slug, image: String(fd.get('image') || '26998033') });
  revalidatePath('/admin/categorias');
}

export async function removeCategory(fd: FormData) {
  await deleteCategory(String(fd.get('slug')));
  revalidatePath('/admin/categorias');
}
