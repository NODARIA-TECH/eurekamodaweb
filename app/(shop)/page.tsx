import HomeBody from '@/components/HomeBody';
import { listShopProducts, listCategories } from '@/lib/store';
import { getPublishedContent } from '@/lib/site-store';

export const dynamic = 'force-dynamic';

// Portada: el contenido (fotos, textos, orden de bloques) se edita en el panel → "Página de inicio".
export default async function Home() {
  const [products, categories, content] = await Promise.all([listShopProducts(), listCategories(), getPublishedContent()]);
  return (
    <main id="top">
      <HomeBody c={content} products={products} categories={categories} />
    </main>
  );
}
