'use client';
import { useState } from 'react';
import { PRODUCTS, pexels, type Product } from '@/lib/data';
import { useCart } from './Cart';

function Heart() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 21s-7.5-4.6-10-9.4C.3 8.2 2 5 5.3 5c2 0 3.3 1.1 4.2 2.3l.5.7.5-.7C11.4 6.1 12.7 5 14.7 5 18 5 19.7 8.2 22 11.6 19.5 16.4 12 21 12 21z" />
    </svg>
  );
}

function Card({ p }: { p: Product }) {
  const { add } = useCart();
  const [fav, setFav] = useState(false);
  return (
    <article className="pc">
      <div className="img">
        {p.badge && <span className="bd">{p.badge}</span>}
        <button className={'fav' + (fav ? ' on' : '')} aria-label="Favorito" onClick={() => setFav((f) => !f)}>
          <Heart />
        </button>
        {/* Placeholder Pexels -> se sustituye por foto de catálogo real */}
        <img loading="lazy" src={pexels(p.img, 420, 560)} alt={p.name} />
        <button className="add" onClick={() => add(p.name)}>Añadir</button>
      </div>
      <div className="cap2">
        <span className="nm">{p.name}</span>
        <div className="ct">{p.category}</div>
        <span className="pr">{p.price} €</span>
      </div>
    </article>
  );
}

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
            {PRODUCTS.map((p) => (<Card key={p.id} p={p} />))}
          </div>
        </div>
      </div>
    </section>
  );
}
