import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import { getCategory, productsByCategory } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCategory(params.slug);
  return { title: (c ? c.name : 'Categoría') + ' · EUREKA' };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const c = await getCategory(params.slug);
  if (!c) notFound();
  const products = await productsByCategory(c.slug);
  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Categoría</span>
          <h1>{c.name}</h1>
          <p>{products.length} prendas</p>
        </div>
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="empty">Pronto más novedades en esta categoría.</p>
        )}
      </div>
    </main>
  );
}
