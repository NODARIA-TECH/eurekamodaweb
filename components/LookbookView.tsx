'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Product } from '@/lib/types';
import { money } from '@/lib/money';
import ProductDetail from './ProductDetail';

export type RPiece = { label: string; color?: string; product?: Product; categoryHref?: string; categoryName?: string };
export type RLook = { slug: string; title: string; mood: string; photo: string; alt: string; pieces: RPiece[] };

const pieceHref = (pc: RPiece) =>
  pc.product ? `/producto/${pc.product.id}${pc.color && pc.product.colors?.includes(pc.color) ? `?color=${encodeURIComponent(pc.color)}` : ''}` : pc.categoryHref;

// Iconos de trazo (sin dependencias)
const Ico = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I_CLOSE = 'M6 6l12 12M18 6L6 18';
const I_MAX = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
const I_MIN = 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5';
const I_EXT = 'M14 4h6v6M20 4l-9 9M10 6H5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5';
const I_PREV = 'M15 5l-7 7 7 7';
const I_NEXT = 'M9 5l7 7-7 7';

export default function LookbookView({ looks, contactEmail }: { looks: RLook[]; contactEmail: string }) {
  const [open, setOpen] = useState<{ look: number; piece: number } | null>(null);
  const [max, setMax] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const prodRef = useRef<HTMLDivElement>(null);

  const show = useCallback((look: number, piece: number) => { setOpen({ look, piece }); }, []);
  const close = useCallback(() => { setOpen(null); setMax(false); }, []);
  const go = useCallback((dir: number) => {
    setOpen((o) => (o ? { look: (o.look + dir + looks.length) % looks.length, piece: 0 } : o));
  }, [looks.length]);

  // Bloquear el scroll de fondo, Escape para cerrar, flechas para cambiar de look
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'Escape') close();
      else if (!/INPUT|SELECT|TEXTAREA/.test(t?.tagName || '')) {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open, close, go]);
  useEffect(() => { if (open) closeRef.current?.focus({ preventScroll: true }); }, [open?.look]);
  useEffect(() => { prodRef.current?.scrollTo({ top: 0 }); }, [open?.look, open?.piece]);

  const look = open ? looks[open.look] : null;
  const piece = look ? look.pieces[open!.piece] : null;

  return (
    <>
      <div className="lb-grid">
        {looks.map((l, li) => (
          <article className="lb-card" id={l.slug} key={l.slug}>
            <button type="button" className="lb-ph" onClick={() => show(li, Math.max(0, l.pieces.findIndex((p) => p.product)))} aria-label={`Ver el look ${l.title}`}>
              <img src={l.photo} alt={l.alt} loading={li < 3 ? 'eager' : 'lazy'} />
              <span className="lb-shop">Compra el look</span>
            </button>
            <div className="lb-body">
              <span className="lb-mood">{l.mood}</span>
              <h2>{l.title}</h2>
              <ul className="lb-pieces">
                {l.pieces.map((pc, pi) => (
                  <li key={pc.label} className={pc.product ? '' : 'lb-store'}>
                    <a href={pieceHref(pc) || '#'} onClick={(e) => { e.preventDefault(); show(li, pi); }}>
                      <span>{pc.label}{pc.color ? <em> · {pc.color}</em> : null}</span>
                      <b className={pc.product ? '' : 'lb-see'}>{pc.product ? money(pc.product.price) : pc.categoryHref ? 'Ver' : 'En tienda'}</b>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      {look && piece && (
        <div className="lbm" role="dialog" aria-modal="true" aria-label={`Look ${look.title}`}>
          <div className="lbm-backdrop" onClick={close} />
          <div className={'lbm-panel' + (max ? ' max' : '')}>
            {/* El look queda siempre a la vista, con la prenda elegida resaltada */}
            <aside className="lbm-look">
              <div className="lbm-ph">
                <img src={look.photo} alt={look.alt} />
                <button type="button" className="lbm-nav prev" onClick={() => go(-1)} aria-label="Look anterior"><Ico d={I_PREV} size={20} /></button>
                <button type="button" className="lbm-nav next" onClick={() => go(1)} aria-label="Look siguiente"><Ico d={I_NEXT} size={20} /></button>
                <span className="lbm-count">{open!.look + 1} / {looks.length}</span>
              </div>
              <div className="lbm-lookinfo">
                <span className="lb-mood">{look.mood}</span>
                <h3>{look.title}</h3>
                <ul className="lbm-pieces" role="tablist" aria-label="Prendas del look">
                  {look.pieces.map((pc, pi) => (
                    <li key={pc.label}>
                      <button type="button" role="tab" aria-selected={pi === open!.piece} className={pi === open!.piece ? 'on' : ''} onClick={() => setOpen({ look: open!.look, piece: pi })}>
                        <span>{pc.label}{pc.color ? <em> · {pc.color}</em> : null}</span>
                        <b>{pc.product ? money(pc.product.price) : pc.categoryHref ? 'Ver' : 'En tienda'}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            <section className="lbm-prod" ref={prodRef}>
              <header className="lbm-head">
                <span className="lbm-crumb">Compra el look · <b>{look.title}</b></span>
                <div className="lbm-tools">
                  {piece.product && (
                    <>
                      <button type="button" className="lbm-ic" onClick={() => setMax((m) => !m)} aria-label={max ? 'Volver al look' : 'Ampliar producto'} title={max ? 'Volver al look' : 'Ampliar producto'}>
                        <Ico d={max ? I_MIN : I_MAX} />
                      </button>
                      <Link className="lbm-ic" href={pieceHref(piece)!} aria-label="Abrir la ficha completa" title="Abrir la ficha completa"><Ico d={I_EXT} /></Link>
                    </>
                  )}
                  <button ref={closeRef} type="button" className="lbm-ic" onClick={close} aria-label="Cerrar"><Ico d={I_CLOSE} /></button>
                </div>
              </header>

              {max && (
                <button type="button" className="lbm-back" onClick={() => setMax(false)}>
                  <img src={look.photo} alt="" /> <span>← Volver al look <b>{look.title}</b></span>
                </button>
              )}

              {piece.product ? (
                <ProductDetail key={piece.product.id + (piece.color || '')} p={piece.product} categoryName={look.title} initialColor={piece.color} compact={!max} />
              ) : (
                <div className="lbm-info">
                  <h2>{piece.label}{piece.color ? ` · ${piece.color}` : ''}</h2>
                  {piece.categoryHref ? (
                    <>
                      <p>Tenemos varios modelos de {piece.categoryName?.toLowerCase() || 'esta prenda'} en la tienda online.</p>
                      <Link className="btn btn-ink" href={piece.categoryHref}>Ver {piece.categoryName || 'la categoría'}</Link>
                    </>
                  ) : (
                    <>
                      <p>Esta prenda está disponible en nuestra tienda física de Écija. Muy pronto también online.</p>
                      <a className="btn btn-ink" href={`mailto:${contactEmail}?subject=${encodeURIComponent('Consulta: ' + piece.label)}`}>Preguntar por esta prenda</a>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
