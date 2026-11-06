'use client';
import { useState } from 'react';
import { productImg, swatch } from '@/lib/data';

const PRESETS: { label: string; sizes: string[] }[] = [
  { label: 'XS – XL', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { label: 'S – XXL', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
  { label: 'M/L · XL/XXL', sizes: ['M/L', 'XL/XXL'] },
  { label: '36 – 44', sizes: ['36', '38', '40', '42', '44'] },
  { label: 'Calzado 36 – 41', sizes: ['36', '37', '38', '39', '40', '41'] },
];

const splitInput = (v: string) => v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Chips({ values, onChange, placeholder, upper }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; upper?: boolean }) {
  const [text, setText] = useState('');
  const commit = (raw: string) => {
    const add = splitInput(raw).map((x) => (upper ? x.toUpperCase() : cap(x)));
    if (!add.length) return;
    const next = [...values];
    for (const a of add) if (!next.some((n) => n.toLowerCase() === a.toLowerCase())) next.push(a);
    onChange(next);
    setText('');
  };
  return (
    <div className="chips">
      {values.map((v) => (
        <span key={v} className="chip">
          {v}
          <button type="button" aria-label={`Quitar ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>×</button>
        </span>
      ))}
      <input
        value={text}
        placeholder={values.length ? 'Añadir…' : placeholder}
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setText(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(text); }
          if (e.key === 'Backspace' && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={() => commit(text)}
      />
    </div>
  );
}

type Props = {
  sizes: string[];
  colors: string[];
  colorImages: Record<string, string>;
  gallery: string[]; // fotos ya subidas del producto (para elegir la de cada color)
};

export default function VariantEditor({ sizes: s0, colors: c0, colorImages, gallery }: Props) {
  const [sizes, setSizes] = useState<string[]>(s0);
  const [colors, setColors] = useState<string[]>(c0);
  const [picked, setPicked] = useState<Record<string, string>>({});

  return (
    <div className="ve">
      <input type="hidden" name="tallas" value={sizes.join(', ')} />
      <input type="hidden" name="colores" value={colors.join(', ')} />

      <div className="ve-block">
        <div className="ve-head">
          <b>Tallas</b>
          <span className="adm-help">{sizes.length ? `${sizes.length} tallas` : 'Sin tallas = talla única'}</span>
        </div>
        <Chips values={sizes} onChange={setSizes} placeholder="Escribe una talla y pulsa Enter (S, M, 38…)" upper />
        <div className="ve-presets">
          {PRESETS.map((p) => (<button type="button" key={p.label} className="btn-sm ghost" onClick={() => setSizes(p.sizes)}>{p.label}</button>))}
          <button type="button" className="btn-sm ghost" onClick={() => setSizes([])}>Talla única</button>
        </div>
      </div>

      <div className="ve-block">
        <div className="ve-head">
          <b>Colores</b>
          <span className="adm-help">Cada color puede tener su foto: así la clienta ve la prenda en el color que elige.</span>
        </div>
        <Chips values={colors} onChange={setColors} placeholder="Escribe un color y pulsa Enter (Negro, Burdeos…)" />

        {colors.length > 0 && (
          <div className="ve-colors">
            {colors.map((c) => {
              const current = colorImages[c];
              const sel = picked[c] ?? '__keep';
              const shown = sel === '__keep' ? current : sel === '__none' ? '' : sel;
              return (
                <div className="ve-color" key={c}>
                  <div className="ve-cimg">
                    {shown ? <img src={productImg(shown, 120, 160)} alt="" /> : <span className="ve-noimg" style={{ background: swatch(c) }} />}
                  </div>
                  <div className="ve-cbody">
                    <div className="ve-cname"><span className="adm-dot" style={{ background: swatch(c) }} />{c}{!shown && <span className="adm-tag warn">sin foto</span>}</div>
                    <label className="ve-upload">
                      Subir foto de este color
                      <input type="file" name={`cfoto:${c}`} accept="image/*" />
                    </label>
                    {gallery.length > 0 && (
                      <div className="ve-pick">
                        <span>…o elige una de las fotos del producto:</span>
                        <div className="ve-thumbs">
                          {gallery.map((g) => (
                            <label key={g} className={'ve-thumb' + (shown === g ? ' on' : '')}>
                              <input type="radio" name={`cpick:${c}`} value={g} checked={sel === g || (sel === '__keep' && current === g)} onChange={() => setPicked({ ...picked, [c]: g })} />
                              <img src={productImg(g, 80, 106)} alt="" />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <input type="hidden" name={`cpick:${c}`} value={sel === '__keep' || sel === '__none' ? sel : ''} disabled={sel !== '__keep' && sel !== '__none'} />
                    {shown && <button type="button" className="ve-clear" onClick={() => setPicked({ ...picked, [c]: '__none' })}>Quitar foto de este color</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
