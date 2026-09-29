'use client';
import Link from 'next/link';
import { useState } from 'react';
import { pexels, type Product } from '@/lib/data';
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
  return (
    <article className="pc">
      <div className="img">
        {p.badge && <span className="bd">{p.badge}</span>}
        <button className={'fav' + (fav ? ' on' : '')} aria-label="Favorito" onClick={() => setFav((f) => !f)}>
          <Heart />
        </button>
        <Link href={`/producto/${p.id}`} className="imglink" aria-label={p.name}>
          <img loading="lazy" src={pexels(p.img, 420, 560)} alt={p.name} />
        </Link>
        <button className="add" onClick={() => add(p.name)}>Añadir</button>
      </div>
      <div className="cap2">
        <Link className="nm" href={`/producto/${p.id}`}>{p.name}</Link>
        <div className="ct">{p.category}</div>
        <span className="pr">{p.price} €</span>
      </div>
    </article>
  );
}
