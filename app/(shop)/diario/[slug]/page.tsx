import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { entradaPorSlug, publicadas, trozos } from '@/lib/diario';
import { listShopProducts } from '@/lib/store';
import { productImg } from '@/lib/data';
import ProductGrid from '@/components/ProductGrid';
import JsonLd from '@/components/JsonLd';
import { articleLd, breadcrumbLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const e = await entradaPorSlug(params.slug);
  if (!e) return { title: 'Diario · EUREKA', robots: { index: false } };
  const desc = e.intro.replace(/\s+/g, ' ').slice(0, 155);
  return {
    title: `${e.title} · EUREKA`,
    description: desc,
    alternates: { canonical: `/diario/${e.slug}` },
    openGraph: { type: 'article', title: e.title, description: desc, url: `/diario/${e.slug}`, publishedTime: e.publishedAt, ...(e.image ? { images: [productImg(e.image, 1200, 1600)] } : {}) },
  };
}

const fecha = (d?: string) => (d ? new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }) : '');

export default async function Entrada({ params }: { params: { slug: string } }) {
  const e = await entradaPorSlug(params.slug);
  if (!e) notFound();
  const [shop, todas] = await Promise.all([listShopProducts(), publicadas()]);
  const prendas = e.productIds.map((id) => shop.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const otras = todas.filter((x) => x.id !== e.id).slice(0, 3);
  const img = e.image ? productImg(e.image, 1200, 1600) : undefined;
  return (
    <main className="page">
      <JsonLd data={[articleLd({ ...e, image: img && !img.includes('sin-foto') ? img : undefined }), breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: 'Diario', path: '/diario' }, { name: e.title, path: `/diario/${e.slug}` }])]} />
      <div className="wrap">
        <div className="crumbs"><Link href="/diario">Diario</Link> · <time dateTime={e.publishedAt}>{fecha(e.publishedAt)}</time></div>
        <article className="dia-art">
          <h1>{e.title}</h1>
          <p className="dia-intro">{e.intro}</p>
          {e.body.split(/\n\s*\n/).map((par, i) => (
            <p key={i}>{trozos(par).map((t, j) => (t.b ? <strong key={j}>{t.t}</strong> : <span key={j}>{t.t}</span>))}</p>
          ))}
        </article>
        {prendas.length > 0 && (
          <section className="dia-prendas">
            <div className="sh"><span className="script">las prendas</span><h2>de esta entrada</h2></div>
            <ProductGrid products={prendas} />
          </section>
        )}
        {otras.length > 0 && (
          <section className="dia-mas">
            <h2>Más del diario</h2>
            <ul>{otras.map((o) => <li key={o.id}><Link href={`/diario/${o.slug}`}>{o.title}</Link></li>)}</ul>
          </section>
        )}
      </div>
    </main>
  );
}
