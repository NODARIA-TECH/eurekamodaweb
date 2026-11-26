import type { Metadata } from 'next';
import HomeBody from '@/components/HomeBody';
import JsonLd from '@/components/JsonLd';
import { storeLd, websiteLd } from '@/lib/seo';
import { listShopProducts, listCategories } from '@/lib/store';
import { getPublishedContent } from '@/lib/site-store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { alternates: { canonical: '/' } };

// Portada: el contenido (fotos, textos, orden de bloques) se edita en el panel → "Página de inicio".
export default async function Home() {
  const [products, categories, content] = await Promise.all([listShopProducts(), listCategories(), getPublishedContent()]);
  return (
    <main id="top">
      <JsonLd data={[storeLd(content.social as unknown as Record<string, string>, content.tienda), websiteLd()]} />
      <HomeBody c={content} products={products} categories={categories} seed={Date.now()} />
    </main>
  );
}
