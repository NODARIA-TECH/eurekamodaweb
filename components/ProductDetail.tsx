'use client';
import { useMemo, useState } from 'react';
import { productImg, imageForColor, swatch } from '@/lib/data';
import { money } from '@/lib/money';
import type { Product } from '@/lib/types';
import { useCart } from './Cart';
import { hasVariants, stockOf, colorAvailable, vlabel } from '@/lib/variants';

const PLACEHOLDER = '26998033';

export default function ProductDetail({ p, categoryName }: { p: Product; categoryName: string }) {
  const { add } = useCart();
  const sizes = p.sizes || [];
  const colors = p.colors || [];
  const out = p.stock <= 0;

  const vmode = hasVariants(p);
  const firstColor = colors.find((c) => colorAvailable(p, c)) ?? colors[0] ?? '';
  const [color, setColor] = useState<string>(firstColor);
  const [size, setSize] = useState<string>(sizes.length === 1 ? sizes[0] : '');
  // Unidades de una talla en el color elegido (sin stock por variante: el total).
  const unitsFor = (s?: string, c: string = color) => stockOf(p, s || undefined, c || undefined);
  const needsSize = sizes.length > 1;
  const chosen = !needsSize || !!size;
  const units = chosen ? unitsFor(size || sizes[0]) : null;
  const comboOut = vmode && units !== null && units <= 0;
  const [needSize, setNeedSize] = useState(false);

  // Galería: principal + extra + fotos de colores, sin repetir.
  const gallery = useMemo(() => {
    const all = [p.image, ...(p.images || []), ...colors.map((c) => p.colorImages?.[c]).filter(Boolean) as string[]];
    const uniq = Array.from(new Set(all.filter((x) => x && x !== PLACEHOLDER)));
    return uniq.length ? uniq : [p.image];
  }, [p, colors]);
  const [shown, setShown] = useState<string>(imageForColor(p, firstColor));

  function pickColor(c: string) {
    setColor(c);
    if (p.colorImages?.[c]) setShown(p.colorImages[c]);
    if (vmode && size && unitsFor(size, c) <= 0) setSize(''); // esa talla no queda en este color
  }

  function addToCart() {
    if (needsSize && !size) { setNeedSize(true); return; }
    if (comboOut) return;
    add({ id: p.id, name: p.name, price: p.price, image: imageForColor(p, color), size: size || undefined, color: color || undefined });
  }

  return (
    <div className="pdp">
      <div className="pdp-media">
        <div className="pdp-img"><img src={productImg(shown, 900, 1200)} alt={p.name + (color ? ` en ${color}` : '')} /></div>
        {gallery.length > 1 && (
          <div className="pdp-thumbs">
            {gallery.map((g) => (
              <button key={g} type="button" className={'pdp-thumb' + (g === shown ? ' on' : '')} onClick={() => setShown(g)} aria-label="Ver foto">
                <img src={productImg(g, 160, 213)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pdp-info">
        <span className="lab">{categoryName}</span>
        <h1>{p.name}</h1>
        <div className="pdp-price">{money(p.price)}</div>
        <p className={'pdp-stock ' + (out || comboOut ? 'ko' : 'ok')}>
          {out ? 'Agotado'
            : comboOut ? `Agotado en ${vlabel(size || undefined, color || undefined)}`
            : units !== null && units <= 3
              ? `${units === 1 ? '¡Última unidad' : `¡Últimas ${units} unidades`}${vmode ? ` en ${vlabel(size || undefined, color || undefined)}` : ''}!`
            : 'En stock · envío en 24–48 h'}
        </p>

        {colors.length > 0 && (
          <div className="pdp-opt">
            <span className="pdp-optl">Color: <b>{color}</b></span>
            <div className="swatches">
              {colors.map((c) => (
                <button key={c} type="button" className={'sw' + (c === color ? ' on' : '') + (vmode && !colorAvailable(p, c) ? ' off' : '')} onClick={() => pickColor(c)} title={vmode && !colorAvailable(p, c) ? `${c} (agotado)` : c} aria-label={vmode && !colorAvailable(p, c) ? `${c}, agotado` : c} aria-pressed={c === color}>
                  <span style={{ background: swatch(c) }} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pdp-opt">
          <span className="pdp-optl">Talla{size ? <>: <b>{size}</b></> : ''}</span>
          {sizes.length ? (
            <div className="sizes">
              {sizes.map((s) => {
                const off = vmode && unitsFor(s) <= 0;
                return (
                  <button key={s} type="button" disabled={off} aria-label={off ? `${s}, agotada` : s}
                    className={'size' + (s === size ? ' on' : '') + (s.length > 3 ? ' wide' : '') + (off ? ' off' : '')}
                    onClick={() => { setSize(s); setNeedSize(false); }}>{s}</button>
                );
              })}
            </div>
          ) : <div className="pdp-unica">Talla única</div>}
          {needSize && <div className="pdp-need">Elige tu talla para añadirla a la cesta.</div>}
        </div>

        {out || comboOut ? (
          <button className="btn btn-o pdp-add" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>{out ? 'Agotado' : 'Agotado en este color y talla'}</button>
        ) : (
          <button className="btn btn-ink pdp-add" onClick={addToCart}>Añadir a la cesta</button>
        )}

        <div className="pdp-acc">
          <details open>
            <summary>Descripción</summary>
            <div className="pdp-acc-b">
              {(p.description || 'Prenda seleccionada de la colección EUREKA.').split(/\n+/).map((t, i) => <p key={i}>{t}</p>)}
              {colors.length > 1 && <p className="pdp-muted">Disponible en {colors.length} colores: {colors.join(', ')}.</p>}
            </div>
          </details>
          {p.details && (
            <details>
              <summary>Composición y cuidados</summary>
              <div className="pdp-acc-b">{p.details.split(/\n+/).map((t, i) => <p key={i}>{t}</p>)}</div>
            </details>
          )}
          <details>
            <summary>Envíos y devoluciones</summary>
            <div className="pdp-acc-b">
              <p>Envío en 24–48 h laborables. Gratis en pedidos desde 50 €.</p>
              <p>Tienes 7 días naturales desde la recepción para devolver la prenda en perfecto estado, tal como la recibiste. <a href="/legal/devoluciones">Ver política de devoluciones</a>.</p>
            </div>
          </details>
        </div>

        {p.sku && <p className="pdp-ref">Ref. {p.sku}</p>}
      </div>
    </div>
  );
}
