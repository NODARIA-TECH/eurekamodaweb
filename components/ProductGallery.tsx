'use client';
// Galería de ficha de producto al estilo de las tiendas de moda:
// · Escritorio: zoom al pasar el ratón (la imagen se amplía siguiendo el cursor).
// · Móvil: deslizar para cambiar de foto.
// · Clic / toque: pantalla completa con zoom (clic o toque para ampliar, mover para recorrer).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { productImg } from '@/lib/data';

const Ico = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I_EXPAND = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5';
const I_CLOSE = 'M6 6l12 12M18 6L6 18';
const I_PREV = 'M15 5l-7 7 7 7';
const I_NEXT = 'M9 5l7 7-7 7';
// Aumento según la resolución real de la foto: sin pasar de ~1:1 (no pixelar), entre 1,4× y 2,6×.
const zoomFor = (img: HTMLImageElement | null) =>
  img && img.naturalWidth && img.clientWidth ? clamp(img.naturalWidth / img.clientWidth, 1.4, 2.6) : 2;
const clamp = (v: number, a = 0, b = 100) => Math.min(b, Math.max(a, v));

function Lightbox({ images, index, alt, onIndex, onClose }: { images: string[]; index: number; alt: string; onIndex: (i: number) => void; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number; ox: number; oy: number; type: string } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const go = (d: number) => { setZoom(false); onIndex((index + d + images.length) % images.length); };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const pct = (e: React.PointerEvent, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
  };

  return (
    <div className="lbx" role="dialog" aria-modal="true" aria-label={`Fotos de ${alt}`}>
      <div className="lbx-top">
        <span className="lbx-count">{index + 1} / {images.length}</span>
        <button ref={closeRef} type="button" className="lbx-ic" onClick={onClose} aria-label="Cerrar"><Ico d={I_CLOSE} /></button>
      </div>
      <div
        className={'lbx-stage' + (zoom ? ' z' : '')}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, ox: origin.x, oy: origin.y, type: e.pointerType }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => {
          if (!zoom) return;
          if (e.pointerType === 'mouse') setOrigin(pct(e, e.currentTarget));
          else if (start.current) {
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin({ x: clamp(start.current.ox - ((e.clientX - start.current.x) / r.width) * 100), y: clamp(start.current.oy - ((e.clientY - start.current.y) / r.height) * 100) });
          }
        }}
        onPointerUp={(e) => {
          const s = start.current; start.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {          // toque / clic: ampliar o reducir
            if (!zoom) { setOrigin(pct(e, e.currentTarget)); setZoom(true); } else setZoom(false);
          } else if (!zoom && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); // deslizar
        }}
      >
        <img ref={imgRef} key={images[index]} src={productImg(images[index], 1600, 2133)} alt={`${alt} · foto ${index + 1}`} draggable={false}
          style={{ transformOrigin: `${origin.x}% ${origin.y}%`, transform: zoom ? `scale(${zoomFor(imgRef.current)})` : undefined }} />
      </div>
      {images.length > 1 && (
        <>
          <button type="button" className="lbx-nav prev" onClick={() => go(-1)} aria-label="Foto anterior"><Ico d={I_PREV} size={22} /></button>
          <button type="button" className="lbx-nav next" onClick={() => go(1)} aria-label="Foto siguiente"><Ico d={I_NEXT} size={22} /></button>
          <div className="lbx-thumbs">
            {images.map((g, i) => (
              <button key={g} type="button" className={i === index ? 'on' : ''} onClick={() => { setZoom(false); onIndex(i); }} aria-label={`Foto ${i + 1}`}>
                <img src={productImg(g, 120, 160)} alt="" />
              </button>
            ))}
          </div>
        </>
      )}
      <p className="lbx-hint">{zoom ? 'Mueve para recorrer · toca para reducir' : 'Toca la foto para ampliar'}</p>
    </div>
  );
}

export default function ProductGallery({ images, alt, shown, onShow }: { images: string[]; alt: string; shown: string; onShow: (src: string) => void }) {
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [box, setBox] = useState<number | null>(null);
  const [fine, setFine] = useState(false); // ratón (zoom al pasar) o pantalla táctil
  const mainRef = useRef<HTMLImageElement>(null);
  useEffect(() => { setFine(window.matchMedia('(hover: hover) and (pointer: fine)').matches); }, []);
  const start = useRef<{ x: number; y: number; type: string } | null>(null);
  const idx = Math.max(0, images.indexOf(shown));
  const go = (d: number) => onShow(images[(idx + d + images.length) % images.length]);

  return (
    <div className="pdp-media">
      <div
        className={'pdp-img' + (zoom ? ' zoom' : '')}
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return;
          const r = e.currentTarget.getBoundingClientRect();
          setZoom({ x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) });
        }}
        onPointerLeave={() => setZoom(null)}
        onPointerDown={(e) => { start.current = { x: e.clientX, y: e.clientY, type: e.pointerType }; }}
        onPointerUp={(e) => {
          const s = start.current; start.current = null;
          if (!s) return;
          const dx = e.clientX - s.x, dy = e.clientY - s.y;
          if (s.type !== 'mouse' && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
          else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) setBox(idx);
        }}
      >
        <img ref={mainRef} src={productImg(shown, 1200, 1600)} alt={alt} draggable={false}
          style={zoom && fine ? { transformOrigin: `${zoom.x}% ${zoom.y}%`, transform: `scale(${zoomFor(mainRef.current)})` } : undefined} />
        <button type="button" className="pdp-expand" aria-label="Ver en pantalla completa"
          onPointerUp={(e) => e.stopPropagation()} onClick={() => setBox(idx)}><Ico d={I_EXPAND} size={18} /></button>
        {images.length > 1 && (
          <div className="pdp-dots" aria-hidden="true">{images.map((g) => <span key={g} className={g === shown ? 'on' : ''} />)}</div>
        )}
      </div>
      {images.length > 1 && (
        <div className="pdp-thumbs">
          {images.map((g, i) => (
            <button key={g} type="button" className={'pdp-thumb' + (g === shown ? ' on' : '')} onClick={() => onShow(g)} aria-label={`Ver foto ${i + 1}`}>
              <img src={productImg(g, 160, 213)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {box !== null && createPortal(
        <Lightbox images={images} index={box} alt={alt} onIndex={(i) => { setBox(i); onShow(images[i]); }} onClose={() => setBox(null)} />,
        document.body,
      )}
    </div>
  );
}
