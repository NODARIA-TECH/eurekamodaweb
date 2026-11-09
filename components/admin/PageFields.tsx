'use client';
// Campos del editor de la portada: textos, enlaces, interruptores, fotos (con punto de foco) y productos.
import { uploadFile as uploadChunked, isImageFile } from '@/lib/upload-client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { productImg } from '@/lib/data';
import { money } from '@/lib/money';
import type { SImg, SLink } from '@/lib/site-content';

export interface PProduct { id: string; name: string; image: string; price: number; stock: number }
export interface MediaItem { src: string; name: string; group: 'web' | 'productos' | 'subidas'; at?: number }

// ---------- Iconos ----------
export const Ico = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
export const I = {
  up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M5 12l7 7 7-7', x: 'M6 6l12 12M18 6L6 18',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4M6.5 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2',
  chev: 'M6 9l6 6 6-6', plus: 'M12 5v14M5 12h14', img: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9.5a1 1 0 100-.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z', ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  desk: 'M3 5h18v11H3zM8 20h8M12 16v4', phone: 'M8 3h8a1 1 0 011 1v16a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM11 18h2',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3', search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  check: 'M5 12.5l4.5 4.5L19 7', tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 7.5h.01',
};

// ---------- Básicos ----------
export function Txt({ label, value, onChange, multiline, rows = 3, max, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; rows?: number; max?: number; placeholder?: string; hint?: string;
}) {
  const near = max && value.length > max * 0.85;
  return (
    <label className="pf">
      <span className="pf-l">{label}{max ? <em className={near ? 'warn' : ''}>{value.length}/{max}</em> : null}</span>
      {multiline
        ? <textarea rows={rows} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input type="text" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {hint && <span className="pf-h">{hint}</span>}
    </label>
  );
}

export function Switch({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="pf-sw">
      <button type="button" role="switch" aria-checked={checked} className={'sw' + (checked ? ' on' : '')} onClick={() => onChange(!checked)}><i /></button>
      <span>{label}{hint && <small>{hint}</small>}</span>
    </label>
  );
}

export function LinkField({ label, value, onChange, hint }: { label: string; value: SLink; onChange: (v: SLink, key: string) => void; hint?: string }) {
  return (
    <div className="pf pf-link">
      <span className="pf-l">{label}</span>
      <div className="pf-row">
        <input type="text" value={value.label} maxLength={60} placeholder="Texto del botón (vacío = sin botón)" onChange={(e) => onChange({ ...value, label: e.target.value }, 'l')} />
        <input type="text" value={value.href} list="pe-links" placeholder="/tienda" onChange={(e) => onChange({ ...value, href: e.target.value }, 'h')} />
      </div>
      {hint && <span className="pf-h">{hint}</span>}
    </div>
  );
}

export function Href({ label, value, onChange, placeholder = '/tienda', hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <label className="pf">
      <span className="pf-l">{label}</span>
      <input type="text" value={value} list="pe-links" placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <span className="pf-h">{hint}</span>}
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Mover({ i, n, onMove, onRemove }: { i: number; n: number; onMove: (to: number) => void; onRemove?: () => void }) {
  return (
    <span className="mover">
      <button type="button" disabled={i === 0} onClick={() => onMove(i - 1)} aria-label="Subir"><Ico d={I.up} size={14} /></button>
      <button type="button" disabled={i === n - 1} onClick={() => onMove(i + 1)} aria-label="Bajar"><Ico d={I.down} size={14} /></button>
      {onRemove && <button type="button" className="rm" onClick={onRemove} aria-label="Quitar"><Ico d={I.x} size={14} /></button>}
    </span>
  );
}

export function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return;
  const [it] = list.splice(from, 1);
  list.splice(to, 0, it);
}

// ---------- Foto con punto de foco ----------
// Se ve la foto entera: tocar o arrastrar marca lo que NO se debe recortar (la cara, la prenda…).
// Al lado, cómo queda recortada en la web.
export function ImageField({ label, value, onChange, ratio = '3 / 4', ratios, hint, onRemove, extra }: {
  label: string; value: SImg; onChange: (v: SImg, key: string) => void; ratio?: string; ratios?: [string, string][];
  hint?: string; onRemove?: () => void; extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragging = useRef(false);
  const setFocus = (e: React.PointerEvent) => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    onChange({ ...value, x, y }, 'focus');
  };
  const crops = ratios || [[ratio, '']];
  return (
    <div className="imf">
      <div className="pf-l">{label}{onRemove && <button type="button" className="lnk danger" onClick={onRemove}>Quitar</button>}</div>
      <div className="imf-body">
        <div className="imf-pick">
          {value.src ? (
            <div className="imf-full"
              onPointerDown={(e) => { dragging.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFocus(e); }}
              onPointerMove={(e) => dragging.current && setFocus(e)}
              onPointerUp={() => { dragging.current = false; }}
              title="Toca para marcar el centro de la foto">
              <img ref={imgRef} src={productImg(value.src, 600, 800)} alt="" draggable={false} />
              <span className="imf-dot" style={{ left: `${value.x}%`, top: `${value.y}%` }} />
            </div>
          ) : (
            <button type="button" className="imf-empty" onClick={() => setOpen(true)}><Ico d={I.img} size={26} />Elegir foto</button>
          )}
        </div>
        <div className="imf-side">
          {value.src && (
            <div className="imf-crops">
              {crops.map(([r, l]) => (
                <figure key={r + l}>
                  <div className="imf-crop" style={{ aspectRatio: r }}><img src={productImg(value.src, 400, 533)} alt="" style={{ objectPosition: `${value.x}% ${value.y}%` }} /></div>
                  <figcaption>{l || 'Así se verá'}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <button type="button" className="btn-s" onClick={() => setOpen(true)}><Ico d={I.img} />{value.src ? 'Cambiar foto' : 'Elegir foto'}</button>
          {extra}
          {value.src && <p className="pf-h">Toca la foto grande para elegir qué parte se ve siempre.</p>}
        </div>
      </div>
      <input type="text" className="imf-alt" value={value.alt} maxLength={160} placeholder="Descripción breve de la foto (ayuda en Google y accesibilidad)"
        onChange={(e) => onChange({ ...value, alt: e.target.value }, 'alt')} />
      {hint && <span className="pf-h">{hint}</span>}
      {open && <MediaPicker onClose={() => setOpen(false)} onPick={(src, name) => { onChange({ ...value, src, x: 50, y: 30, alt: (name || '').replace(/^Look · /, 'Look ') }, 'src'); setOpen(false); }} />}
    </div>
  );
}

// ---------- Biblioteca de fotos ----------
let mediaCache: MediaItem[] | null = null;
async function loadMedia(force = false): Promise<MediaItem[]> {
  if (mediaCache && !force) return mediaCache;
  const r = await fetch('/admin/api/pagina/media', { cache: 'no-store' });
  if (!r.ok) throw new Error(r.status === 401 ? 'La sesión ha caducado: vuelve a entrar.' : 'No se pudo cargar la biblioteca.');
  mediaCache = (await r.json()).items as MediaItem[];
  return mediaCache;
}

// Por trozos (lib/upload-client): sirve para fotos grandes y HEIC aunque Nginx limite el tamaño.
async function uploadFile(file: File, onProgress: (p: number) => void): Promise<string> {
  const r = await uploadChunked(file, { onProgress: (p) => onProgress(p) });
  if (!r.src) throw new Error('El servidor no devolvió la foto.');
  return r.src;
}

const GROUPS: [MediaItem['group'] | 'all', string][] = [['all', 'Todas'], ['web', 'Fotos de la web'], ['productos', 'Productos'], ['subidas', 'Subidas']];

export function MediaPicker({ onClose, onPick }: { onClose: () => void; onPick: (src: string, name?: string) => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(mediaCache);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<MediaItem['group'] | 'all'>('all');
  const [q, setQ] = useState('');
  const [up, setUp] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMedia().then(setItems).catch((e) => setErr(e.message));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const list = useMemo(() => {
    const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return (items || []).filter((i) => (tab === 'all' || i.group === tab) && (!q || n(i.name + ' ' + i.src).includes(n(q))));
  }, [items, tab, q]);

  async function upload(files: FileList | File[] | null) {
    const f = files && Array.from(files).find(isImageFile);
    if (!f) { setErr('Elige un archivo de imagen.'); return; }
    setErr(''); setUp(0);
    try {
      const src = await uploadFile(f, setUp);
      mediaCache = null;
      loadMedia(true).then(setItems).catch(() => undefined);
      onPick(src, '');
    } catch (e: any) { setErr(e.message); } finally { setUp(null); }
  }

  return createPortal(
    <div className="mp-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'mp' + (drag ? ' drag' : '')} role="dialog" aria-modal="true" aria-label="Elegir foto"
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}>
        <div className="mp-top">
          <h3>Elegir foto</h3>
          <button type="button" className="mp-x" onClick={onClose} aria-label="Cerrar"><Ico d={I.x} size={20} /></button>
        </div>
        <div className="mp-tools">
          <div className="seg">{GROUPS.map(([g, l]) => <button key={g} type="button" className={tab === g ? 'on' : ''} onClick={() => setTab(g)}>{l}</button>)}</div>
          <label className="mp-q"><Ico d={I.search} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar (jersey, cuadros…)" /></label>
          <button type="button" className="btn-p" onClick={() => fileRef.current?.click()} disabled={up !== null}><Ico d={I.upload} />Subir foto nueva</button>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </div>
        {up !== null && <div className="mp-prog"><i style={{ width: `${Math.round(up * 100)}%` }} /><span>Subiendo… {Math.round(up * 100)} %</span></div>}
        {err && <p className="mp-err">{err}</p>}
        <div className="mp-grid">
          {!items && !err && Array.from({ length: 12 }).map((_, i) => <div key={i} className="mp-sk" />)}
          {list.map((it) => (
            <button key={it.src} type="button" className="mp-it" onClick={() => onPick(it.src, it.name === 'Foto subida' ? '' : it.name)} title={it.name}>
              <img src={productImg(it.src, 300, 400)} alt="" loading="lazy" />
              <span>{it.name}</span>
            </button>
          ))}
          {items && !list.length && <p className="mp-none">No hay fotos con ese filtro.</p>}
        </div>
        <p className="mp-foot">También puedes arrastrar una foto aquí desde el ordenador.</p>
      </div>
    </div>,
    document.body,
  );
}

// ---------- Selector de producto ----------
export function ProductSelect({ products, value, onChange, placeholder = 'Elegir producto…', exclude = [], allowNone = true }: {
  products: PProduct[]; value: string; onChange: (id: string) => void; placeholder?: string; exclude?: string[]; allowNone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const cur = products.find((p) => p.id === value);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const list = products.filter((p) => !exclude.includes(p.id) && (!q || n(p.name).includes(n(q)))).slice(0, 60);
  return (
    <div className="ps" ref={ref}>
      <button type="button" className="ps-btn" onClick={() => setOpen((o) => !o)}>
        {cur ? <><img src={productImg(cur.image, 80, 106)} alt="" /><span>{cur.name}<small>{money(cur.price)}{cur.stock <= 0 ? ' · agotado' : ''}</small></span></> : <span className="ph">{placeholder}</span>}
        <Ico d={I.chev} />
      </button>
      {open && (
        <div className="ps-pop">
          <label className="mp-q"><Ico d={I.search} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" /></label>
          <div className="ps-list">
            {allowNone && value && <button type="button" className="ps-it none" onClick={() => { onChange(''); setOpen(false); }}>Sin producto (usar enlace manual)</button>}
            {list.map((p) => (
              <button type="button" key={p.id} className={'ps-it' + (p.id === value ? ' on' : '')} onClick={() => { onChange(p.id); setOpen(false); setQ(''); }}>
                <img src={productImg(p.image, 80, 106)} alt="" loading="lazy" />
                <span>{p.name}<small>{money(p.price)}{p.stock <= 0 ? ' · agotado' : ''}</small></span>
              </button>
            ))}
            {!list.length && <p className="mp-none">Ningún producto coincide.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
