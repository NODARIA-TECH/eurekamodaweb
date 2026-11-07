'use client';
// "Crear zoom": encuadra una zona de la foto (recuadro 3:4 que se arrastra y se agranda/achica)
// y el servidor genera una foto ampliada de esa zona a partir del original.
import { useRef, useState } from 'react';
import { productImg } from '@/lib/data';

type Props = {
  productId: string;
  src: string;
  colors: string[];
  defaultTarget?: string; // color al que pertenece la foto ('' = galería general)
  action: (fd: FormData) => void;
};

export default function ZoomCropper({ productId, src, colors, defaultTarget = '', action }: Props) {
  const [open, setOpen] = useState(false);
  const [ratio, setRatio] = useState(0.75);      // ancho/alto de la foto (se lee al cargar)
  const [size, setSize] = useState(0.5);          // ancho del recuadro (fracción del ancho de la foto)
  const [pos, setPos] = useState({ x: 0.25, y: 0.2 }); // esquina sup. izq. (fracciones)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Recuadro 3:4 → alto en fracción de la altura de la foto
  const w = size, h = Math.min(1, (size * ratio) / 0.75);
  const x = Math.min(Math.max(pos.x, 0), 1 - w), y = Math.min(Math.max(pos.y, 0), 1 - h);

  return (
    <>
      <button type="button" className="btn-sm ghost zc-btn" onClick={() => setOpen(true)}>Crear zoom</button>
      {open && (
        <div className="zc" role="dialog" aria-modal="true" aria-label="Crear foto ampliada">
          <div className="zc-panel">
            <div className="zc-head">
              <b>Crear foto ampliada</b>
              <span className="adm-help">Arrastra el recuadro hasta la zona que quieras destacar (cuello, tejido, detalle…) y ajusta el tamaño.</span>
            </div>
            <div className="zc-body">
              <div className="zc-stage" ref={boxRef}>
                <img src={productImg(src, 900, 1200)} alt="" draggable={false}
                  onLoad={(e) => { const i = e.currentTarget; if (i.naturalHeight) setRatio(i.naturalWidth / i.naturalHeight); }} />
                <div className="zc-shade" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${x * 100}% ${y * 100}%,${x * 100}% ${(y + h) * 100}%,${(x + w) * 100}% ${(y + h) * 100}%,${(x + w) * 100}% ${y * 100}%,${x * 100}% ${y * 100}%)` }} />
                <div className="zc-rect" style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
                  onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: x, py: y }; e.currentTarget.setPointerCapture(e.pointerId); }}
                  onPointerMove={(e) => {
                    if (!drag.current || !boxRef.current) return;
                    const r = boxRef.current.getBoundingClientRect();
                    setPos({ x: drag.current.px + (e.clientX - drag.current.x) / r.width, y: drag.current.py + (e.clientY - drag.current.y) / r.height });
                  }}
                  onPointerUp={() => { drag.current = null; }} />
              </div>
              <div className="zc-side">
                <span className="adm-help">Vista previa</span>
                <div className="zc-preview" style={{
                  backgroundImage: `url(${productImg(src, 1200, 1600)})`,
                  backgroundSize: `${100 / w}% ${100 / h}%`,
                  backgroundPosition: `${w < 1 ? (x / (1 - w)) * 100 : 0}% ${h < 1 ? (y / (1 - h)) * 100 : 0}%`,
                }} />
                <label className="zc-l">Tamaño del recuadro
                  <input type="range" min={0.2} max={1} step={0.01} value={size} onChange={(e) => setSize(+e.target.value)} />
                </label>
                <form action={action} onSubmit={() => setTimeout(() => setOpen(false), 50)} className="zc-form">
                  <input type="hidden" name="id" value={productId} />
                  <input type="hidden" name="src" value={src} />
                  <input type="hidden" name="cx" value={x.toFixed(4)} />
                  <input type="hidden" name="cy" value={y.toFixed(4)} />
                  <input type="hidden" name="cw" value={w.toFixed(4)} />
                  <input type="hidden" name="ch" value={h.toFixed(4)} />
                  <label className="zc-l">Añadir a
                    <select name="target" defaultValue={defaultTarget}>
                      <option value="">Galería general</option>
                      {colors.map((c) => <option key={c} value={c}>Fotos del color {c}</option>)}
                    </select>
                  </label>
                  <div className="zc-actions">
                    <button type="button" className="btn-sm ghost" onClick={() => setOpen(false)}>Cancelar</button>
                    <button type="submit" className="btn-sm gold">Guardar zoom</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
