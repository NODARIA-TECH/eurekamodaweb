import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';
import { getCategory, shopProductsByCategory } from '@/lib/store';
import JsonLd from '@/components/JsonLd';
import { breadcrumbLd, textoCategoria } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const c = await getCategory(params.slug);
  if (!c) return { title: 'Categoría · EUREKA' };
  const n = c.name.toLowerCase();
  return {
    title: `${c.name} de mujer · EUREKA Écija`,
    description: `Compra ${n} de mujer en EUREKA, tu tienda de moda en Écija (Sevilla). Envío en 24–48 h o recogida gratis en tienda.`,
    alternates: { canonical: `/categoria/${c.slug}` },
    openGraph: { title: `${c.name} · EUREKA`, url: `/categoria/${c.slug}` },
  };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const c = await getCategory(params.slug);
  if (!c) notFound();
  const products = await shopProductsByCategory(c.slug);
  return (
    <main className="page">
      <JsonLd data={breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: 'Tienda', path: '/tienda' }, { name: c.name, path: `/categoria/${c.slug}` }])} />
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Categoría</span>
          <h1>{c.name}</h1>
          <p>{products.length} {products.length === 1 ? 'prenda' : 'prendas'}</p>
        </div>
        {products.length > 0 ? (
          <ProductGrid products={products} />
        ) : (
          <p className="empty">Pronto más novedades en esta categoría.</p>
        )}
        <div className="cat-seo"><h2>{c.name} de mujer en Écija</h2><p>{textoCategoria(c.slug, c.name)}</p></div>
      </div>
    </main>
  );
}
