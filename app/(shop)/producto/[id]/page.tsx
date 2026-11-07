import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getCategory, listProducts } from '@/lib/store';
import { looksFor } from '@/lib/lookbook';
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

export default async function ProductPage({ params, searchParams }: { params: { id: string }; searchParams: { color?: string } }) {
  const p = await getProduct(params.id);
  if (!p) notFound();
  const cat = await getCategory(p.category);
  const categoryName = cat?.name || p.category;
  const looks = looksFor(p, await listProducts());
  const initialColor = searchParams.color && p.colors?.includes(searchParams.color) ? searchParams.color : undefined;
  return (
    <main className="page">
      <div className="wrap">
        <div className="crumbs"><Link href="/tienda">Tienda</Link> · <Link href={`/categoria/${p.category}`}>{categoryName}</Link></div>
        <ProductDetail p={p} categoryName={categoryName} initialColor={initialColor} />
        {looks.length > 0 && (
          <section className="pdp-looks">
            <div className="sh"><span className="script">así lo</span><h2>combinamos</h2></div>
            <div className="pdp-looks-g">
              {looks.map((l) => (
                <Link key={l.slug} href={`/lookbook#${l.slug}`} className="pdp-look">
                  <img src={l.photo} alt={l.alt} loading="lazy" />
                  <span>{l.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
