'use client';
import Link from 'next/link';
import { useState } from 'react';
import { productImg, swatch } from '@/lib/data';
import type { Product } from '@/lib/types';
import { money } from '@/lib/money';
import { useCart } from './Cart';

function Heart() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 21s-7.5-4.6-10-9.4C.3 8.2 2 5 5.3 5c2 0 3.3 1.1 4.2 2.3l.5.7.5-.7C11.4 6.1 12.7 5 14.7 5 18 5 19.7 8.2 22 11.6 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

export default function ProductCard({ p }: { p: Product }) {
  const { add } = useCart();
  const [fav, setFav] = useState(false);
  const out = p.stock <= 0;
  const colors = p.colors || [];
  const hasOptions = (p.sizes?.length || 0) > 1 || colors.length > 1;
  const second = (p.images || [])[0];
  return (
    <article className="pc">
      <div className="img">
        {p.badge && !out && <span className="bd">{p.badge}</span>}
        {out && <span className="bd out">Agotado</span>}
        <button className={'fav' + (fav ? ' on' : '')} aria-label="Favorito" onClick={() => setFav((f) => !f)}>
          <Heart />
        </button>
        <Link href={`/producto/${p.id}`} className="imglink" aria-label={p.name}>
          <img loading="lazy" src={productImg(p.image, 420, 560)} alt={p.name} />
          {second && <img loading="lazy" className="alt" src={productImg(second, 420, 560)} alt="" aria-hidden="true" />}
        </Link>
        {!out && (hasOptions ? (
          <Link className="add" href={`/producto/${p.id}`}>Elegir talla y color</Link>
        ) : (
          <button className="add" onClick={() => add({ id: p.id, name: p.name, price: p.price, image: p.image, size: p.sizes?.[0], color: colors[0] })}>
            Añadir
          </button>
        ))}
      </div>
      <div className="cap2">
        <Link className="nm" href={`/producto/${p.id}`}>{p.name}</Link>
        <div className="ct">{p.category}</div>
        <span className="pr">{money(p.price)}</span>
        {colors.length > 1 && (
          <div className="pc-sw" aria-label={`${colors.length} colores`}>
            {colors.slice(0, 6).map((c) => <span key={c} title={c} style={{ background: swatch(c) }} />)}
            {colors.length > 6 && <small>+{colors.length - 6}</small>}
          </div>
        )}
      </div>
    </article>
  );
}
