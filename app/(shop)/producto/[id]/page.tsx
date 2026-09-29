import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/store';
import { pexels } from '@/lib/data';
import { money } from '@/lib/money';
import AddToCart from '@/components/AddToCart';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await getProduct(params.id);
  return { title: (p ? p.name : 'Producto') + ' · EUREKA' };
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const p = await getProduct(params.id);
  if (!p) notFound();
  const out = p.stock <= 0;
  return (
    <main className="page">
      <div className="wrap">
        <div className="crumbs"><Link href="/tienda">Tienda</Link> · <Link href={`/categoria/${p.category}`}>{p.category}</Link></div>
        <div className="pdp">
          <div className="pdp-img"><img src={pexels(p.image, 900, 1200)} alt={p.name} /></div>
          <div className="pdp-info">
            <span className="lab">{p.category}</span>
            <h1>{p.name}</h1>
            <div className="pdp-price">{money(p.price)}</div>
            <p className={'pdp-stock ' + (out ? 'ko' : 'ok')}>{out ? 'Agotado' : (p.stock <= 3 ? `¡Últimas ${p.stock} unidades!` : 'En stock')}</p>
            <p className="pdp-desc">
              Prenda seleccionada de la colección EUREKA. (Descripción de ejemplo — se completa
              con el catálogo real de la clienta.)
            </p>
            <AddToCart product={{ id: p.id, name: p.name, price: p.price, image: p.image }} disabled={out} />
            <ul className="pdp-notes">
              <li>Envío en 24–48h</li>
              <li>Cambios y devoluciones en 30 días</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
