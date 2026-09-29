import type { Metadata } from 'next';
import ProductGrid from '@/components/ProductGrid';
import { PRODUCTS } from '@/lib/data';

export const metadata: Metadata = { title: 'Tienda · EUREKA' };

export default function TiendaPage() {
  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Toda la colección</span>
          <h1>Tienda</h1>
          <p>{PRODUCTS.length} prendas</p>
        </div>
        <ProductGrid products={PRODUCTS} />
      </div>
    </main>
  );
}
