'use client';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';

export default function ProductRail({ products, label = 'Recién llegado', title = 'Novedades' }: { products: Product[]; label?: string; title?: string }) {
  return (
    <section id="rail">
      <div className="wrap">
        <div className="sh">
          {label && <span className="lab">{label}</span>}
          <h2>{title}</h2>
        </div>
        <div className="railwrap">
          <div className="rail">
            {products.map((p) => (<ProductCard key={p.id} p={p} />))}
          </div>
        </div>
      </div>
    </section>
  );
}
