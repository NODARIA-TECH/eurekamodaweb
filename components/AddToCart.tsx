'use client';
import { useState } from 'react';
import { useCart } from './Cart';

type P = { id: string; name: string; price: number; image: string };
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export default function AddToCart({ product, disabled }: { product: P; disabled?: boolean }) {
  const { add } = useCart();
  const [size, setSize] = useState<string>('M');

  if (disabled) return <button className="btn btn-o" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>Agotado</button>;

  return (
    <div>
      <div className="pdp-sizes">
        <span>Talla</span>
        <div className="sizes">
          {SIZES.map((s) => (
            <button key={s} className={'size' + (s === size ? ' on' : '')} onClick={() => setSize(s)}>{s}</button>
          ))}
        </div>
      </div>
      <button className="btn btn-ink" onClick={() => add({ id: product.id, name: product.name, price: product.price, image: product.image, size })}>
        Añadir a la cesta
      </button>
    </div>
  );
}
