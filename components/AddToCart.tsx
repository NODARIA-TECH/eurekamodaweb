'use client';
import { useState } from 'react';
import { useCart } from './Cart';

type P = { id: string; name: string; price: number; image: string; sizes?: string[]; colors?: string[] };
const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export default function AddToCart({ product, disabled }: { product: P; disabled?: boolean }) {
  const { add } = useCart();
  // Tallas: las del producto si las hay; si no, la lista por defecto.
  const sizes = product.sizes && product.sizes.length ? product.sizes : DEFAULT_SIZES;
  // Colores: solo si el producto los define.
  const colors = product.colors && product.colors.length ? product.colors : [];
  const [size, setSize] = useState<string>(sizes.includes('M') ? 'M' : sizes[0]);
  const [color, setColor] = useState<string>(colors[0] ?? '');

  if (disabled) return <button className="btn btn-o" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>Agotado</button>;

  return (
    <div>
      <div className="pdp-sizes">
        <span>Talla</span>
        <div className="sizes">
          {sizes.map((s) => (
            <button key={s} className={'size' + (s === size ? ' on' : '')} onClick={() => setSize(s)}>{s}</button>
          ))}
        </div>
      </div>
      {colors.length > 0 && (
        <div className="pdp-sizes">
          <span>Color</span>
          <div className="sizes">
            {colors.map((c) => (
              <button key={c} className={'size' + (c === color ? ' on' : '')} onClick={() => setColor(c)}>{c}</button>
            ))}
          </div>
        </div>
      )}
      <button className="btn btn-ink" onClick={() => add({ id: product.id, name: product.name, price: product.price, image: product.image, size, color: color || undefined })}>
        Añadir a la cesta
      </button>
    </div>
  );
}
