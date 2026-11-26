'use server';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { listProducts } from '@/lib/store';
import { lanzarVolcadoFs } from '@/lib/facturascripts';

export async function pasarAFs() {
  requireAdmin();
  const r = lanzarVolcadoFs(await listProducts());
  redirect('/admin/facturascripts' + (r.ok ? '?lanzado=1' : `?err=${r.motivo}`));
}
