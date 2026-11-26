'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { guardarEntrada, cambiarEstado, regenerarBorrador } from '@/lib/diario';
import { listShopProducts, listCategories } from '@/lib/store';

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '');

export async function guardar(fd: FormData) {
  requireAdmin();
  const id = s(fd, 'id');
  const publicar = s(fd, 'accion') === 'publicar';
  const productIds = fd.getAll('productIds').map(String).filter(Boolean);
  const e = await guardarEntrada(id, { title: s(fd, 'title'), intro: s(fd, 'intro'), body: s(fd, 'body'), publicar, productIds: productIds.length ? productIds : undefined });
  revalidatePath('/diario'); revalidatePath('/sitemap.xml');
  redirect(`/admin/diario?ok=${e ? (publicar ? 'publicada' : 'guardada') : 'error'}${e && publicar ? '&slug=' + encodeURIComponent(e.slug) : ''}`);
}

export async function otra(fd: FormData) {
  requireAdmin();
  const e = await regenerarBorrador(s(fd, 'id'), await listShopProducts(), await listCategories());
  redirect(`/admin/diario?ok=${e ? 'otra' : 'error'}`);
}

export async function estado(fd: FormData) {
  requireAdmin();
  const st = s(fd, 'status');
  if (!['borrador', 'publicada', 'descartada'].includes(st)) redirect('/admin/diario?ok=error');
  await cambiarEstado(s(fd, 'id'), st as 'borrador' | 'publicada' | 'descartada');
  revalidatePath('/diario');
  redirect(`/admin/diario?ok=${st}`);
}
