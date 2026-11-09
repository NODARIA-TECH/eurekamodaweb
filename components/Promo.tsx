'use client';
import { Fragment, useState } from 'react';

// Barra de aviso superior. El texto se edita en el panel; lo que va entre **asteriscos** sale en negrita.
export function PromoText({ text }: { text: string }) {
  return <>{text.split('**').map((t, i) => (i % 2 ? <b key={i}>{t}</b> : <Fragment key={i}>{t}</Fragment>))}</>;
}

export default function Promo({ show = true, text }: { show?: boolean; text: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden || !show || !text.trim()) return null;
  return (
    <div className="promo">
      <div className="wrap">
        <span><PromoText text={text} /></span>
        <button className="x" onClick={() => setHidden(true)}>Descartar</button>
      </div>
    </div>
  );
}
