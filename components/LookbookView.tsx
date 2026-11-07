'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Product } from '@/lib/types';
import { money } from '@/lib/money';

export type RPiece = {
  label: string; color?: string; product?: Product; categoryHref?: string;
  spot?: { x: number; y: number } | null; mask?: string;
};
export type RLook = { slug: string; title: string; mood: string; photo: string; alt: string; pieces: RPiece[] };

const hrefOf = (pc: RPiece) =>
  pc.product ? `/producto/${pc.product.id}${pc.color && pc.product.colors?.includes(pc.color) ? `?color=${encodeURIComponent(pc.color)}` : ''}` : pc.categoryHref;
const priceOf = (pc: RPiece) => (pc.product ? money(pc.product.price) : pc.categoryHref ? 'Ver' : 'En tienda');

// Un look: al pasar por un punto o por una prenda de la lista, la prenda se ilumina
// (el resto de la foto se apaga y pierde color) y aparece su etiqueta.
function LookCard({ look, eager }: { look: RLook; eager: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const router = useRouter();
  const pointer = useRef<string>('mouse'); // 'mouse' | 'touch' | 'pen'
  const pc = active !== null ? look.pieces[active] : null;

  const open = (i: number) => { const h = hrefOf(look.pieces[i]); if (h) router.push(h); };
  const tap = (i: number) => {
    // Ratón: pasar por encima ilumina y el clic abre. Dedo: el 1.er toque ilumina, el 2.º abre.
    if (pointer.current === 'mouse' || active === i) open(i);
    else setActive(i);
  };
  const hover = (i: number) => (e: React.PointerEvent) => { if (e.pointerType === 'mouse') setActive(i); };
  // El foco solo ilumina si viene del teclado (al tocar con el dedo también se enfoca el botón)
  const focus = (i: number) => (e: React.FocusEvent) => { if ((e.target as HTMLElement).matches(':focus-visible')) setActive(i); };

  return (
    <article className={'lb-card' + (active !== null ? ' lit' : '')} id={look.slug}>
      <div className="lb-ph" onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
        onPointerDown={(e) => { pointer.current = e.pointerType; }}
        onClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') setActive(null); }}>
        <img src={look.photo} alt={look.alt} loading={eager ? 'eager' : 'lazy'} />
        {look.pieces.map((p, i) => p.mask && (
          <div key={'d' + i} className={'lb-dim' + (active === i ? ' on' : '')} aria-hidden="true"
            style={{ WebkitMaskImage: `url(${p.mask})`, maskImage: `url(${p.mask})` }} />
        ))}
        {look.pieces.map((p, i) => p.spot && (
          <button key={'s' + i} type="button" className={'lb-dot' + (active === i ? ' on' : '')}
            style={{ left: `${p.spot.x}%`, top: `${p.spot.y}%` }}
            aria-label={`${p.label}${p.color ? ' ' + p.color : ''}, ${priceOf(p)}`}
            onPointerEnter={hover(i)} onFocus={focus(i)} onClick={() => tap(i)}>
            <span />
          </button>
        ))}
        {pc && pc.spot && (() => {
          const left = pc.spot.x <= 55;
          const href = hrefOf(pc);
          const body = (
            <>
              <span className="lb-tag-n">{pc.label}</span>
              <span className="lb-tag-m">{pc.color ? `${pc.color} · ` : ''}<b>{priceOf(pc)}</b></span>
              {href ? <span className="lb-tag-go">Ver prenda →</span> : <span className="lb-tag-go off">Disponible en tienda</span>}
            </>
          );
          const style = { top: `${Math.min(86, Math.max(10, pc.spot.y))}%`, ...(left ? { left: `calc(${pc.spot.x}% + 22px)` } : { right: `calc(${100 - pc.spot.x}% + 22px)` }) };
          return href
            ? <Link href={href} className={'lb-tag ' + (left ? 'r' : 'l')} style={style}>{body}</Link>
            : <div className={'lb-tag ' + (left ? 'r' : 'l')} style={style}>{body}</div>;
        })()}
      </div>
      <div className="lb-body">
        <span className="lb-mood">{look.mood}</span>
        <h2>{look.title}</h2>
        <ul className="lb-pieces" onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}>
          {look.pieces.map((p, i) => {
            const href = hrefOf(p);
            const inner = (<><span>{p.label}{p.color ? <em> · {p.color}</em> : null}</span><b className={p.product ? '' : 'lb-see'}>{priceOf(p)}</b></>);
            return (
              <li key={p.label} className={(p.product ? '' : 'lb-store') + (active === i ? ' on' : '')}
                onPointerEnter={hover(i)} onFocus={focus(i)}>
                {href ? <Link href={href}>{inner}</Link> : <span className="lb-row">{inner}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

export default function LookbookView({ looks }: { looks: RLook[] }) {
  return (
    <div className="lb-grid">
      {looks.map((l, i) => <LookCard key={l.slug} look={l} eager={i < 3} />)}
    </div>
  );
}
