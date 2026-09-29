'use client';
import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';

export default function ProductRail({ products }: { products: Product[] }) {
  return (
    <section id="rail">
      <div className="wrap">
        <div className="sh">
          <span className="lab">Recién llegado</span>
          <h2>Novedades</h2>
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
