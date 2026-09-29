import ProductCard from './ProductCard';
import type { Product } from '@/lib/data';

export default function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid">
      {products.map((p) => (<ProductCard key={p.id} p={p} />))}
    </div>
  );
}
