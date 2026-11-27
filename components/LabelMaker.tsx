'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';

type V = { size?: string; color?: string; stock: number; sku?: string };
type Item = { id: string; sku: string; name: string; price: number; category: string; variants?: V[]; sizes?: string[]; colors?: string[] };
type Cat = { slug: string; name: string };

// Rollos Brother DK para la QL-570. `w` × `h` = como los nombra el driver de Brother
// ("29mm x 90mm"): w = ancho del rollo (lo que cruza la impresora), h = largo de la etiqueta.
type Roll = { id: string; name: string; driver: string; w: number; h: number; continuous?: boolean };
const ROLLS: Roll[] = [
  { id: 'dk22205', name: 'DK-22205 · Cinta continua 62 mm (cortada a medida)', driver: '62mm', w: 62, h: 35, continuous: true },
  { id: 'dk11209', name: 'DK-11209 · Dirección pequeña 62 × 29 mm', driver: '62mm x 29mm', w: 62, h: 29 },
  { id: 'dk11201', name: 'DK-11201 · Dirección estándar 29 × 90 mm', driver: '29mm x 90mm', w: 29, h: 90 },
  { id: 'dk11208', name: 'DK-11208 · Dirección grande 38 × 90 mm', driver: '38mm x 90mm', w: 38, h: 90 },
  { id: 'dk11204', name: 'DK-11204 · Multiuso 17 × 54 mm', driver: '17mm x 54mm', w: 17, h: 54 },
  { id: 'dk11203', name: 'DK-11203 · Carpetas 17 × 87 mm', driver: '17mm x 87mm', w: 17, h: 87 },
  { id: 'dk22210', name: 'DK-22210 · Continuo 29 mm (cortado a medida)', driver: '29mm', w: 29, h: 62, continuous: true },
  { id: 'r35x70', name: 'Rollo compatible 70 × 35 mm (35 mm de ancho)', driver: '35mm x 70mm (personalizado)', w: 35, h: 70 },
];

// Hojas A4 de etiquetas adhesivas (impresora normal de tinta o láser).
type Sheet = { id: string; name: string; w: number; h: number; cols: number; rows: number; top: number; left: number };
const SHEETS: Sheet[] = [
  { id: 'a4-70x35', name: 'Hoja A4 · 24 etiquetas 70 × 35 mm (3 × 8)', w: 70, h: 35, cols: 3, rows: 8, top: 8.5, left: 0 },
  { id: 'a4-70x36', name: 'Hoja A4 · 24 etiquetas 70 × 36 mm (3 × 8)', w: 70, h: 36, cols: 3, rows: 8, top: 4.5, left: 0 },
  { id: 'a4-70x37', name: 'Hoja A4 · 24 etiquetas 70 × 37 mm (3 × 8)', w: 70, h: 37, cols: 3, rows: 8, top: 0.5, left: 0 },
  { id: 'a4-70x42', name: 'Hoja A4 · 21 etiquetas 70 × 42,4 mm (3 × 7)', w: 70, h: 42.4, cols: 3, rows: 7, top: 0.2, left: 0 },
];

const DPMM = 300 / 25.4; // la QL-570 imprime a 300 ppp
// Lo que lleva el código de barras: la referencia SIN guiones ni signos (PEK-0897 -> PEK0897).
// Así la pistola lo escribe igual con teclado español o americano (el "-" sale como "'" si no coinciden).
// En FacturaScripts ese valor va en el campo "código de barras" de cada producto.
export const barcodeValue = (sku: string) => sku.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const euros = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type Label = { sku: string; text: string; price: number; vari?: string };

// Tallas × colores de una prenda: de sus variantes (con su stock) o, si no tiene, de sus listas de tallas y colores.
type Combo = { k: string; size?: string; color?: string; stock?: number; sku?: string };
function combosDe(p: Item): Combo[] {
  if (p.variants?.length) return p.variants.map((v) => ({ k: `${v.size || ''}|${v.color || ''}`, size: v.size, color: v.color, stock: v.stock, sku: v.sku }));
  const ss = p.sizes?.length ? p.sizes : [undefined], cs = p.colors?.length ? p.colors : [undefined];
  if (!p.sizes?.length && !p.colors?.length) return [];
  return ss.flatMap((size) => cs.map((color) => ({ k: `${size || ''}|${color || ''}`, size, color })));
}
const textoVariante = (c: { size?: string; color?: string }) => [c.size ? `Talla ${c.size}` : '', c.color || ''].filter(Boolean).join(' · ');
type Opts = { showName: boolean; showPrice: boolean; showSku: boolean };

// Dibuja UNA etiqueta en un canvas a 300 ppp, en horizontal (el lado largo en horizontal),
// que es como se lee la etiqueta pegada en la prenda.
function drawLabel(lab: Label, Wmm: number, Hmm: number, o: Opts): HTMLCanvasElement {
  const W = Math.round(Wmm * DPMM), H = Math.round(Hmm * DPMM);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';

  const mm = (v: number) => v * DPMM;
  const pad = clamp(Hmm * 0.08, 1.6, 3);
  const availW = Wmm - 2 * pad;
  const wide = Wmm / Hmm >= 2.1; // referencia y precio en la misma línea
  const nameEm = clamp(Hmm * 0.2, 2.2, 5);
  const priceEm = clamp(Hmm * (wide ? 0.22 : 0.2), 2.6, 6);
  const skuEm = clamp(Hmm * 0.12, 1.7, 2.8);
  const gap = clamp(Hmm * 0.035, 0.6, 1.5);

  // Texto: en una línea si cabe; si es largo, en dos líneas (mejor que letra diminuta).
  const font = (emMm: number) => `700 ${mm(emMm)}px Arial, Helvetica, sans-serif`;
  const widthPerMm = (t: string) => { ctx.font = font(10); return ctx.measureText(t).width / DPMM / 10; }; // mm de ancho por mm de letra
  const text = (lab.text || '').replace(/\s+/g, ' ').trim();
  let showName = o.showName && !!text;
  let nameLines: string[] = [text];
  let nameSize = Math.min(nameEm, availW / Math.max(0.01, widthPerMm(text)));
  if (showName && nameSize < nameEm) {
    const words = text.split(' ');
    let best: string[] | null = null, bestW = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const w = Math.max(widthPerMm(a), widthPerMm(b));
      if (w < bestW) { bestW = w; best = [a, b]; }
    }
    const size2 = best ? Math.min(nameEm * 0.92, availW / bestW) : 0;
    if (best && size2 > nameSize * 1.2) { nameLines = best; nameSize = size2; }
  }
  nameSize = Math.max(1.8, nameSize);

  let showSku = o.showSku;
  const showPrice = o.showPrice;
  // Talla y color: en su propia franja negra con letra blanca, para verlas de un vistazo en la percha.
  const vari = (lab.vari || '').trim();
  let varEm = clamp(Hmm * 0.13, 2, 3.8);
  if (vari) varEm = Math.max(1.8, Math.min(varEm, (availW - 2) / Math.max(0.01, widthPerMm(vari))));
  const varH = () => (vari ? varEm * 1.35 : 0);
  const nameBlock = () => (showName ? nameLines.length * nameSize * 1.08 + gap : 0) + (vari ? varH() + gap : 0);
  const bottomH = () => (wide ? Math.max(showSku ? skuEm : 0, showPrice ? priceEm : 0) : (showSku ? skuEm + gap : 0) + (showPrice ? priceEm : 0));
  const bcHmm = () => Hmm - 2 * pad - nameBlock() - bottomH() - gap;
  if (bcHmm() < 5 && showSku) showSku = false;
  if (bcHmm() < 6 && vari) varEm = Math.max(1.7, varEm * 0.78);
  if (bcHmm() < 6 && nameLines.length > 1) { nameLines = [text]; nameSize = Math.max(1.8, Math.min(nameEm, availW / widthPerMm(text))); }
  if (bcHmm() < 4 && showName) showName = false;

  let y = pad;
  if (showName) {
    ctx.font = font(nameSize);
    ctx.textAlign = 'center';
    nameLines.forEach((line, i) => {
      let t = line;
      if (ctx.measureText(t).width > mm(availW)) { // ni así cabe: se corta con "…"
        while (ctx.measureText(t + '…').width > mm(availW) && t.length > 1) t = t.slice(0, -1);
        t = t.trimEnd() + '…';
      }
      ctx.fillText(t, W / 2, mm(y + nameSize * 0.8 + i * nameSize * 1.08));
    });
    y += nameLines.length * nameSize * 1.08 + gap;
  }
  if (vari) {
    ctx.fillStyle = '#000';
    const tw = (() => { ctx.font = font(varEm); return ctx.measureText(vari).width; })();
    const bw = Math.min(mm(availW), tw + mm(varEm * 0.9));
    ctx.fillRect(Math.round((W - bw) / 2), Math.round(mm(y)), Math.round(bw), Math.round(mm(varH())));
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText(vari, W / 2, mm(y + varH() / 2 + varEm * 0.36));
    ctx.fillStyle = '#000';
    y += varH() + gap;
  }

  // Código de barras Code128: cada barra ocupa un nº ENTERO de puntos de la impresora (lectura fiable)
  const bcH = Math.max(3, bcHmm());
  try {
    const probe = document.createElement('canvas');
    JsBarcode(probe, barcodeValue(lab.sku), { format: 'CODE128', displayValue: false, margin: 0, width: 1, height: 10 });
    const modules = probe.width;
    const maxW = mm(Math.min(availW, 64));
    const dots = clamp(Math.floor(maxW / modules), 1, 4);
    const bc = document.createElement('canvas');
    JsBarcode(bc, barcodeValue(lab.sku), { format: 'CODE128', displayValue: false, margin: 0, width: dots, height: Math.round(mm(bcH)) });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bc, Math.round((W - bc.width) / 2), Math.round(mm(y)));
  } catch { /* referencia no codificable */ }
  y += bcH + gap;

  // Referencia + precio
  if (wide) {
    const base = mm(Hmm - pad);
    if (showSku) { ctx.font = `400 ${mm(skuEm)}px "Courier New", monospace`; ctx.textAlign = showPrice ? 'left' : 'center'; ctx.fillText(lab.sku, showPrice ? mm(pad) : W / 2, base); }
    if (showPrice) { ctx.font = `700 ${mm(priceEm)}px Arial, Helvetica, sans-serif`; ctx.textAlign = showSku ? 'right' : 'center'; ctx.fillText(euros(lab.price), showSku ? W - mm(pad) : W / 2, base); }
  } else {
    ctx.textAlign = 'center';
    if (showSku) { ctx.font = `400 ${mm(skuEm)}px "Courier New", monospace`; ctx.fillText(lab.sku, W / 2, mm(y + skuEm * 0.8)); y += skuEm + gap; }
    if (showPrice) { ctx.font = `700 ${mm(priceEm)}px Arial, Helvetica, sans-serif`; ctx.fillText(euros(lab.price), W / 2, mm(Hmm - pad)); }
  }
  return cv;
}

// Gira 90° un canvas (para rollos cuya etiqueta es más larga que el ancho del rollo).
function rotate(cv: HTMLCanvasElement): HTMLCanvasElement {
  const r = document.createElement('canvas');
  r.width = cv.height; r.height = cv.width;
  const ctx = r.getContext('2d')!;
  ctx.translate(r.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(cv, 0, 0);
  return r;
}

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
};

export default function LabelMaker({ products, categories }: { products: Item[]; categories: Cat[] }) {
  const [cat, setCat] = useState('');
  const [sel, setSel] = useState<Record<string, number>>({});   // id -> nº de copias
  const [texts, setTexts] = useState<Record<string, string>>({}); // id -> texto de la etiqueta
  const [rollId, setRollId] = useState('dk22205');
  const [len, setLen] = useState(35);                            // largo para rollos continuos
  const [custom, setCustom] = useState({ w: 62, h: 29 });
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [perVariant, setPerVariant] = useState(true);            // por talla y color
  const [vsel, setVsel] = useState<Record<string, Record<string, number>>>({}); // id -> talla|color -> copias
  const [preview, setPreview] = useState<string>('');
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // ajuste fino de la hoja A4 (mm)
  const [startAt, setStartAt] = useState(1);             // empezar en la etiqueta nº (hojas ya usadas)

  useEffect(() => {
    const r = store.get('eureka_label_roll'); if (r) setRollId(r);
    if (store.get('eureka_label_porvar') === '0') setPerVariant(false);
    const l = Number(store.get('eureka_label_len')); if (l >= 15) setLen(l);
  }, []);
  useEffect(() => { store.set('eureka_label_roll', rollId); store.set('eureka_label_len', String(len)); }, [rollId, len]);
  useEffect(() => { store.set('eureka_label_porvar', perVariant ? '1' : '0'); }, [perVariant]);

  const sheet = SHEETS.find((x) => x.id === rollId);
  const roll: Roll = sheet
    ? { id: sheet.id, name: sheet.name, driver: 'A4', w: sheet.w, h: sheet.h }
    : rollId === 'custom'
    ? { id: 'custom', name: 'Personalizado', driver: `${custom.w}mm x ${custom.h}mm`, w: custom.w, h: custom.h }
    : (() => { const r = ROLLS.find((x) => x.id === rollId) || ROLLS[0]; return r.continuous ? { ...r, h: len } : r; })();
  // Página del PDF = medida del driver (vertical). Se dibuja en horizontal y se gira si hace falta.
  const pageW = roll.w, pageH = roll.h;
  const needRotate = !sheet && pageH > pageW;
  const labW = Math.max(pageW, pageH), labH = Math.min(pageW, pageH);
  const opts: Opts = { showName, showPrice, showSku };

  const visible = useMemo(() => (cat ? products.filter((p) => p.category === cat) : products), [cat, products]);
  const textFor = (p: Item) => (texts[p.id] !== undefined ? texts[p.id] : p.name);
  const setText = (id: string, v: string) => setTexts((t) => ({ ...t, [id]: v }));
  const toggle = (p: Item) => {
    setSel((s) => { const n = { ...s }; if (n[p.id]) delete n[p.id]; else n[p.id] = 1; return n; });
    setTexts((t) => (t[p.id] === undefined ? { ...t, [p.id]: p.name } : t));
  };
  // Copias de cada talla/color: lo que se haya escrito; si no, su stock (o 1 si la prenda no tiene stock por talla).
  const porDefecto = (c: Combo) => (c.stock !== undefined ? Math.max(0, c.stock) : 1);
  const copiasVar = (p: Item, c: Combo) => vsel[p.id]?.[c.k] ?? porDefecto(c);
  const setCopiasVar = (id: string, k: string, v: number) => setVsel((s) => ({ ...s, [id]: { ...(s[id] || {}), [k]: Math.max(0, Math.floor(v) || 0) } }));
  const rellenar = (p: Item, f: (c: Combo) => number) => setVsel((s) => ({ ...s, [p.id]: Object.fromEntries(combosDe(p).map((c) => [c.k, f(c)])) }));
  const setCopies = (id: string, v: number) => setSel((s) => ({ ...s, [id]: Math.max(1, Math.floor(v) || 1) }));
  const selectAllVisible = () => {
    setSel((s) => { const n = { ...s }; visible.forEach((p) => { if (!n[p.id]) n[p.id] = 1; }); return n; });
    setTexts((t) => { const n = { ...t }; visible.forEach((p) => { if (n[p.id] === undefined) n[p.id] = p.name; }); return n; });
  };

  // Lista de etiquetas. «Por talla y color»: para cada talla/color las copias que digas (de entrada, su stock),
  // con la talla y el color en su franja. El código de barras es el de la prenda (FacturaScripts no tiene tallas).
  const labels = useMemo(() => {
    const out: Label[] = [];
    for (const p of products) {
      const c = sel[p.id];
      if (!c) continue;
      const base = textFor(p);
      const cs = perVariant ? combosDe(p) : [];
      if (cs.length) {
        for (const v of cs) {
          const n = copiasVar(p, v), vari = textoVariante(v);
          // Cada talla/color lleva el código de SU variante (PEK-0970-01 → PEK097001): así el TPV sabe qué talla se vende
          for (let i = 0; i < n; i++) out.push({ sku: v.sku || p.sku, text: base, price: p.price, vari });
        }
      } else for (let i = 0; i < c; i++) out.push({ sku: p.sku, text: base, price: p.price });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, vsel, products, texts, perVariant]);

  // Vista previa de la primera etiqueta, tal cual saldrá (en horizontal)
  const sample: Label = labels[0] || { sku: products[0]?.sku || 'PEK-0001', text: products[0] ? textFor(products[0]) : 'Blusa Az', price: products[0]?.price || 1990, ...(perVariant ? { vari: 'Talla M · Negro' } : {}) };
  useEffect(() => {
    try { setPreview(drawLabel(sample, labW, labH, opts).toDataURL('image/png')); } catch { setPreview(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labW, labH, showName, showPrice, showSku, sample.sku, sample.text, sample.price, sample.vari]);

  function buildPdf(): jsPDF | null {
    if (!labels.length) return null;
    if (sheet) {
      // Rejilla en A4: se salta las primeras etiquetas si la hoja ya está empezada.
      const per = sheet.cols * sheet.rows;
      const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      const skip = clamp(startAt, 1, per) - 1;
      labels.forEach((lab, i) => {
        const slot = i + skip;
        if (slot > 0 && slot % per === 0) doc.addPage('a4', 'portrait');
        const k = slot % per, r = Math.floor(k / sheet.cols), c = k % sheet.cols;
        const cv = drawLabel(lab, sheet.w, sheet.h, opts);
        doc.addImage(cv.toDataURL('image/png'), 'PNG', sheet.left + offset.x + c * sheet.w, sheet.top + offset.y + r * sheet.h, sheet.w, sheet.h, undefined, 'FAST');
      });
      return doc;
    }
    const orient = pageW > pageH ? 'landscape' : 'portrait';
    const doc = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation: orient, compress: true });
    labels.forEach((lab, i) => {
      if (i > 0) doc.addPage([pageW, pageH], orient);
      let cv = drawLabel(lab, labW, labH, opts);
      if (needRotate) cv = rotate(cv);
      doc.addImage(cv.toDataURL('image/png'), 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
    });
    return doc;
  }
  const download = () => buildPdf()?.save(`etiquetas-eureka-${roll.id}.pdf`);
  const print = () => {
    const doc = buildPdf();
    if (!doc) return;
    doc.autoPrint();
    const url = doc.output('bloburl') as unknown as string;
    const win = window.open(url, '_blank');
    if (!win) doc.save(`etiquetas-eureka-${roll.id}.pdf`); // bloqueador de ventanas: se descarga
  };

  return (
    <div className="etq">
      <div className="etq-config adm-card">
        <div className="etq-setup">
          <div className="etq-fields">
            <label>Etiquetas
              <select value={rollId} onChange={(e) => setRollId(e.target.value)}>
                <optgroup label="Rollo en la Brother QL-570">
                  {ROLLS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  <option value="custom">Rollo personalizado…</option>
                </optgroup>
                <optgroup label="Hoja A4 (impresora normal)">
                  {SHEETS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </optgroup>
              </select>
            </label>
            {roll.continuous && (
              <label>Largo de cada etiqueta (mm)<input type="number" min={15} max={200} value={len} onChange={(e) => setLen(clamp(+e.target.value || 29, 15, 200))} /></label>
            )}
            {sheet && (
              <>
                <label>Empezar en la etiqueta nº<input type="number" min={1} max={sheet.cols * sheet.rows} value={startAt} onChange={(e) => setStartAt(clamp(+e.target.value || 1, 1, sheet.cols * sheet.rows))} /></label>
                <label>Ajuste → (mm)<input type="number" step={0.5} value={offset.x} onChange={(e) => setOffset({ ...offset, x: +e.target.value || 0 })} /></label>
                <label>Ajuste ↓ (mm)<input type="number" step={0.5} value={offset.y} onChange={(e) => setOffset({ ...offset, y: +e.target.value || 0 })} /></label>
              </>
            )}
            {rollId === 'custom' && (
              <>
                <label>Ancho del rollo (mm)<input type="number" min={12} max={62} value={custom.w} onChange={(e) => setCustom({ ...custom, w: clamp(+e.target.value || 29, 12, 62) })} /></label>
                <label>Largo (mm)<input type="number" min={15} max={200} value={custom.h} onChange={(e) => setCustom({ ...custom, h: clamp(+e.target.value || 29, 15, 200) })} /></label>
              </>
            )}
            <label>Categoría
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">Todas</option>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <div className="etq-checks">
              <label className="chk"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Texto</label>
              <label className="chk"><input type="checkbox" checked={showSku} onChange={(e) => setShowSku(e.target.checked)} /> Referencia</label>
              <label className="chk"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Precio</label>
              <label className="chk"><input type="checkbox" checked={perVariant} onChange={(e) => setPerVariant(e.target.checked)} /> Por talla y color (cada etiqueta con su talla y su color)</label>
            </div>
          </div>
          <div className="etq-preview">
            <span className="adm-help">Vista previa · {labW} × {labH} mm</span>
            {preview && <img src={preview} alt="Vista previa de la etiqueta" style={{ width: `${Math.min(300, labW * 4)}px` }} />}
          </div>
        </div>

        <div className="etq-howto">
          {sheet ? (
            <>
              <b>Al imprimir:</b> en tu impresora normal (no la Brother) · Papel <b>A4</b> · Escala <b>100 % / Tamaño real</b> (no "Ajustar") · Márgenes <b>Ninguno</b>.
              Prueba primero en una hoja de papel normal y ponla a contraluz sobre la de etiquetas: si no cuadra, corrige con "Ajuste → / ↓".
              Si la hoja ya está empezada, pon en "Empezar en la etiqueta nº" la primera libre (se cuentan de izquierda a derecha y de arriba abajo).
            </>
          ) : (
            <>
              <b>Al imprimir:</b> impresora <b>Brother QL-570</b> · Tamaño del papel <b>{roll.driver}{roll.continuous ? ' (cinta continua)' : ''}</b>{roll.continuous ? <>, largo <b>{len} mm</b></> : null} ·
              Orientación <b>Vertical</b> · Escala <b>100 % / Tamaño real</b> (no "Ajustar") · Márgenes <b>Ninguno</b>.
              {needRotate && <> El PDF ya va girado para este rollo: verás la etiqueta de lado en la vista previa de impresión, es normal.</>}
              {roll.id === 'r35x70' && <> Este tamaño no viene en la lista de la Brother: créalo una vez en <i>Preferencias de impresión → Ajustes de tamaño de papel</i> con 35 mm de ancho y 70 mm de largo.</>}
            </>
          )}
        </div>

        <div className="etq-row">
          <button className="btn-sm" onClick={selectAllVisible}>Seleccionar todos ({visible.length})</button>
          <button className="btn-sm ghost" onClick={() => setSel({})}>Limpiar selección</button>
          <button className="btn-sm gold" onClick={print} disabled={!labels.length}>Imprimir ({labels.length})</button>
          <button className="btn-sm" onClick={download} disabled={!labels.length}>Descargar PDF</button>
        </div>

        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th></th><th>Ref</th><th>Producto</th><th>Texto etiqueta</th><th>Precio</th><th>Copias</th></tr></thead>
            <tbody>
              {visible.map((p) => { const cs = perVariant && sel[p.id] ? combosDe(p) : []; return (
                <Fragment key={p.id}>
                <tr>
                  <td><input type="checkbox" checked={!!sel[p.id]} onChange={() => toggle(p)} aria-label={`Seleccionar ${p.name}`} /></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{p.sku}</td>
                  <td>{p.name}{p.variants?.length ? <div className="adm-sku">{p.variants.length} tallas/colores · {p.variants.reduce((a, v) => a + v.stock, 0)} uds</div> : combosDe(p).length ? <div className="adm-sku">{combosDe(p).length} tallas/colores</div> : null}</td>
                  <td>{sel[p.id] ? (
                    <input value={textFor(p)} onChange={(e) => setText(p.id, e.target.value)} placeholder="Blusa Az" style={{ width: 150 }} />
                  ) : '—'}</td>
                  <td>{euros(p.price)}</td>
                  <td>{sel[p.id] ? (
                    cs.length
                      ? <b>{cs.reduce((a, c) => a + copiasVar(p, c), 0)}</b>
                      : <input type="number" min={1} value={sel[p.id]} onChange={(e) => setCopies(p.id, +e.target.value)} style={{ width: 64 }} />
                  ) : '—'}</td>
                </tr>
                {cs.length > 0 && (
                  <tr className="etq-vars">
                    <td></td>
                    <td colSpan={5}>
                      <div className="etq-vgrid">
                        {cs.map((c) => (
                          <label key={c.k} className={copiasVar(p, c) ? '' : 'cero'}>
                            <span>{textoVariante(c) || 'Única'}{c.stock !== undefined && <small> · {c.stock} en stock</small>}</span>
                            <input type="number" min={0} value={copiasVar(p, c)} onChange={(e) => setCopiasVar(p.id, c.k, +e.target.value)} aria-label={`Copias de ${p.name} ${textoVariante(c)}`} />
                          </label>
                        ))}
                      </div>
                      <div className="etq-vbtns">
                        {cs.some((c) => c.stock !== undefined) && <button type="button" className="btn-sm ghost" onClick={() => rellenar(p, porDefecto)}>Según stock</button>}
                        <button type="button" className="btn-sm ghost" onClick={() => rellenar(p, () => 1)}>Una de cada</button>
                        <button type="button" className="btn-sm ghost" onClick={() => rellenar(p, () => 0)}>Ninguna</button>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ); })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
