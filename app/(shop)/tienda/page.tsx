import type { Metadata } from 'next';
import ProductGrid from '@/components/ProductGrid';
import { listProducts } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tienda · EUREKA' };

export default async function TiendaPage() {
  const products = await listProducts();
  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Toda la colección</span>
          <h1>Tienda</h1>
          <p>{products.length} prendas</p>
        </div>
        <ProductGrid products={products} />
      </div>
    </main>
  );
}
