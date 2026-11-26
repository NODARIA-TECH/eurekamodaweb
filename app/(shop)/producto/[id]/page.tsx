import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, getCategory, listShopProducts, shownInShop } from '@/lib/store';
import { looksFor } from '@/lib/lookbook';
import { productImg } from '@/lib/data';
import ProductDetail from '@/components/ProductDetail';
import JsonLd from '@/components/JsonLd';
import { productLd, breadcrumbLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProduct(params.id);
  if (!p) return { title: 'Producto · EUREKA' };
  const precio = p.price ? ` · ${(p.price / 100).toFixed(2).replace('.', ',')} €` : '';
  const desc = (p.description || `${p.name} de mujer en EUREKA, tu tienda de moda en Écija.`).replace(/\s+/g, ' ').slice(0, 150);
  const hidden = !shownInShop(p);
  return {
    title: p.name + ' · EUREKA',
    description: desc,
    alternates: { canonical: `/producto/${p.id}` },
    openGraph: { title: p.name + precio, description: desc, url: `/producto/${p.id}`, images: [productImg(p.image, 1200, 1600)] },
    ...(hidden ? { robots: { index: false } } : {}),
  };
}

export default async function ProductPage({ params, searchParams }: { params: { id: string }; searchParams: { color?: string } }) {
  const p = await getProduct(params.id);
  if (!p || !shownInShop(p)) notFound();   // oculto o sin foto: no se publica
  const cat = await getCategory(p.category);
  const categoryName = cat?.name || p.category;
  const looks = looksFor(p, await listShopProducts());
  const initialColor = searchParams.color && p.colors?.includes(searchParams.color) ? searchParams.color : undefined;
  return (
    <main className="page">
      <JsonLd data={[productLd(p, categoryName), breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: categoryName, path: `/categoria/${p.category}` }, { name: p.name, path: `/producto/${p.id}` }])]} />
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
