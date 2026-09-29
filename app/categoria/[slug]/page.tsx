import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import { CATEGORIES, categoryBySlug, productsByCategoryName } from '@/lib/data';

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const c = categoryBySlug(params.slug);
  return { title: (c ? c.name : 'Categoría') + ' · EUREKA' };
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const c = categoryBySlug(params.slug);
  if (!c) notFound();
  const products = productsByCategoryName(c.name);
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
