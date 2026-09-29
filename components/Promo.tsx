'use client';
import { useState } from 'react';

export default function Promo() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="promo">
      <div className="wrap">
        <span>Envío <b>gratis</b> a partir de 50&nbsp;€ · Devoluciones rápidas y sencillas</span>
        <button className="x" onClick={() => setHidden(true)}>Descartar</button>
      </div>
    </div>
  );
}
