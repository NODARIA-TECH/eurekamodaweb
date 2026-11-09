// Editor de la página de inicio.
import PageEditor from '@/components/admin/PageEditor';
import { requireAdmin } from '@/lib/admin-auth';
import { listProducts, listCategories } from '@/lib/store';
import { getEditorState } from '@/lib/site-store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Página de inicio · EUREKA' };

export default async function PaginaPage() {
  requireAdmin();
  const [products, categories, state] = await Promise.all([listProducts(), listCategories(), getEditorState()]);
  const prods = products.map((p) => ({ id: p.id, name: p.name, image: p.image, price: p.price, stock: p.stock }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return <PageEditor initial={state} products={prods} categories={categories.map((c) => ({ slug: c.slug, name: c.name }))} />;
}
