import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getCategory } from '@/lib/store';
import { productImg } from '@/lib/data';
import ProductDetail from '@/components/ProductDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProduct(params.id);
  if (!p) return { title: 'Producto · EUREKA' };
  const desc = (p.description || `${p.name} — moda de mujer EUREKA`).slice(0, 155);
  return {
    title: p.name + ' · EUREKA',
    description: desc,
    openGraph: { title: p.name + ' · EUREKA', description: desc, images: [productImg(p.image, 1200, 1600)] },
  };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) notFound();
  const cat = await getCategory(p.category);
  const categoryName = cat?.name || p.category;
  return (
    <main className="page">
      <div className="wrap">
        <div className="crumbs"><Link href="/tienda">Tienda</Link> · <Link href={`/categoria/${p.category}`}>{categoryName}</Link></div>
        <ProductDetail p={p} categoryName={categoryName} />
      </div>
    </main>
  );
}
