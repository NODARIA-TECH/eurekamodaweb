// Vista previa en directo de la portada (dentro del editor). Muestra el BORRADOR y se actualiza al escribir.
import LivePreview from '@/components/admin/LivePreview';
import { requireAdmin } from '@/lib/admin-auth';
import { listProducts, listCategories } from '@/lib/store';
import { getEditorState } from '@/lib/site-store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Vista previa · EUREKA', robots: { index: false, follow: false } };

export default async function PreviewPage() {
  requireAdmin();
  const [products, categories, state] = await Promise.all([listProducts(), listCategories(), getEditorState()]);
  return <LivePreview initial={state.content} products={products} categories={categories} />;
}
