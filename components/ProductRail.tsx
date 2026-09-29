'use client';
import { PRODUCTS } from '@/lib/data';
import ProductCard from './ProductCard';

export default function ProductRail() {
  return (
    <section id="rail">
      <div className="wrap">
        <div className="sh">
          <span className="lab">Recién llegado</span>
          <h2>Novedades</h2>
        </div>
        <div className="railwrap">
          <div className="rail">
            {PRODUCTS.map((p) => (<ProductCard key={p.id} p={p} />))}
          </div>
        </div>
      </div>
    </section>
  );
}
