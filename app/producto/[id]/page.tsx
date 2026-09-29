import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PRODUCTS, getProduct, pexels } from '@/lib/data';
import AddToCart from '@/components/AddToCart';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const p = getProduct(params.id);
  return { title: (p ? p.name : 'Producto') + ' · EUREKA' };
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const p = getProduct(params.id);
  if (!p) notFound();
  return (
    <main className="page">
      <div className="wrap">
        <div className="crumbs"><Link href="/tienda">Tienda</Link> · <span>{p.category}</span></div>
        <div className="pdp">
          <div className="pdp-img"><img src={pexels(p.img, 900, 1200)} alt={p.name} /></div>
          <div className="pdp-info">
            <span className="lab">{p.category}</span>
            <h1>{p.name}</h1>
            <div className="pdp-price">{p.price} €</div>
            <p className="pdp-desc">
              Prenda seleccionada de la colección EUREKA. (Descripción de ejemplo — se completa
              con el catálogo real de la clienta.)
            </p>
            <div className="pdp-sizes">
              <span>Talla</span>
              <div className="sizes">
                {['XS', 'S', 'M', 'L', 'XL'].map((s) => (<button key={s} className="size">{s}</button>))}
              </div>
            </div>
            <AddToCart name={p.name} />
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
