'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';

type Item = { id: string; sku: string; name: string; price: number; category: string };
type Cat = { slug: string; name: string };

// Código de barras Code128 de la referencia (SKU) como SVG escalable (para la vista en pantalla).
function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      try {
        JsBarcode(ref.current, value, { format: 'CODE128', displayValue: false, margin: 0, height: 50, width: 2 });
      } catch { /* valor no codificable */ }
    }
  }, [value]);
  return <svg ref={ref} className="bc-svg" />;
}

const euros = (c: number) => (c / 100).toFixed(2).replace('.', ',') + ' €';

// Genera el PNG del código de barras y su proporción, para meterlo en el PDF.
function barcodePng(value: string): { url: string; ratio: number } | null {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, value, { format: 'CODE128', displayValue: false, margin: 0, height: 60, width: 2 });
    return { url: canvas.toDataURL('image/png'), ratio: canvas.width / canvas.height };
  } catch {
    return null;
  }
}

export default function LabelMaker({ products, categories }: { products: Item[]; categories: Cat[] }) {
  const [cat, setCat] = useState('');
  const [sel, setSel] = useState<Record<string, number>>({});   // id -> nº de copias
  const [texts, setTexts] = useState<Record<string, string>>({}); // id -> texto de la etiqueta
  const [w, setW] = useState(50);
  const [h, setH] = useState(30);
  const [showName, setShowName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [mode, setMode] = useState<'rollo' | 'hoja'>('rollo');

  const visible = useMemo(
    () => (cat ? products.filter((p) => p.category === cat) : products),
    [cat, products]
  );

  const textFor = (p: Item) => (texts[p.id] !== undefined ? texts[p.id] : p.name);
  const setText = (id: string, v: string) => setTexts((t) => ({ ...t, [id]: v }));

  const toggle = (p: Item) => {
    setSel((s) => {
      const n = { ...s };
      if (n[p.id]) delete n[p.id];
      else n[p.id] = 1;
      return n;
    });
    setTexts((t) => (t[p.id] === undefined ? { ...t, [p.id]: p.name } : t));
  };
  const setCopies = (id: string, v: number) => setSel((s) => ({ ...s, [id]: Math.max(1, Math.floor(v) || 1) }));
  const selectAllVisible = () => {
    setSel((s) => { const n = { ...s }; visible.forEach((p) => { if (!n[p.id]) n[p.id] = 1; }); return n; });
    setTexts((t) => { const n = { ...t }; visible.forEach((p) => { if (n[p.id] === undefined) n[p.id] = p.name; }); return n; });
  };
  const clearAll = () => setSel({});

  // lista plana de etiquetas (repitiendo según copias)
  const labels = useMemo(() => {
    const out: Item[] = [];
    for (const p of products) {
      const c = sel[p.id];
      if (c) for (let i = 0; i < c; i++) out.push(p);
    }
    return out;
  }, [sel, products]);

  // Dibuja una etiqueta en el PDF dentro del recuadro (x, y, w, h) en mm.
  const drawLabel = (doc: jsPDF, p: Item, x: number, y: number, bw: number, bh: number) => {
    const pad = 1.5;
    const cx = x + bw / 2;
    let cursor = y + pad + 1.5;

    if (showName) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text(textFor(p) || p.name, cx, cursor, { align: 'center', maxWidth: bw - 2 * pad });
      cursor += 3;
    }

    const bc = barcodePng(p.sku);
    if (bc) {
      const bcW = Math.min(bw - 2 * pad, bh * 1.6);
      const bcH = Math.max(6, Math.min(bh * 0.42, bcW / bc.ratio));
      doc.addImage(bc.url, 'PNG', cx - bcW / 2, cursor, bcW, bcH);
      cursor += bcH + 1;
    }

    doc.setFont('courier', 'normal');
    doc.setFontSize(6);
    doc.text(p.sku, cx, cursor, { align: 'center' });
    cursor += 2.5;

    if (showPrice) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(euros(p.price), cx, cursor + 1, { align: 'center' });
    }
  };

  const makePdf = () => {
    if (!labels.length) return;
    if (mode === 'rollo') {
      const doc = new jsPDF({ unit: 'mm', format: [w, h], orientation: w >= h ? 'landscape' : 'portrait' });
      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      labels.forEach((p, idx) => {
        if (idx > 0) doc.addPage([w, h], w >= h ? 'landscape' : 'portrait');
        drawLabel(doc, p, 0, 0, pw, ph);
      });
      doc.save('etiquetas-eureka.pdf');
    } else {
      const margin = 8, gap = 3, pageW = 210, pageH = 297;
      const cols = Math.max(1, Math.floor((pageW - 2 * margin + gap) / (w + gap)));
      const rows = Math.max(1, Math.floor((pageH - 2 * margin + gap) / (h + gap)));
      const perPage = cols * rows;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      labels.forEach((p, idx) => {
        const onPage = idx % perPage;
        if (idx > 0 && onPage === 0) doc.addPage();
        const r = Math.floor(onPage / cols), c = onPage % cols;
        const x = margin + c * (w + gap), y = margin + r * (h + gap);
        drawLabel(doc, p, x, y, w, h);
      });
      doc.save('etiquetas-eureka.pdf');
    }
  };

  return (
    <div className="etq">
      <style>{`
        .etq-label { width: ${w}mm; height: ${h}mm; }
        @media print {
          body * { visibility: hidden !important; }
          .etq-print, .etq-print * { visibility: visible !important; }
          .etq-print { position: absolute; left: 0; top: 0; width: 100%; gap: ${mode === 'rollo' ? '0' : '3mm'}; }
          .etq-config { display: none !important; }
          .etq-label { border: 0 !important; ${mode === 'rollo' ? 'page-break-after: always;' : 'page-break-inside: avoid;'} }
          @page { size: ${mode === 'rollo' ? `${w}mm ${h}mm` : 'A4'}; margin: ${mode === 'rollo' ? '0' : '8mm'}; }
        }
      `}</style>

      <div className="etq-config adm-card">
        <div className="etq-row">
          <label>Categoría
            <select value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label>Ancho (mm)<input type="number" min={20} value={w} onChange={(e) => setW(+e.target.value || 50)} /></label>
          <label>Alto (mm)<input type="number" min={15} value={h} onChange={(e) => setH(+e.target.value || 30)} /></label>
          <label>Formato
            <select value={mode} onChange={(e) => setMode(e.target.value as 'rollo' | 'hoja')}>
              <option value="rollo">Rollo (1 por etiqueta)</option>
              <option value="hoja">Hoja A4 (rejilla)</option>
            </select>
          </label>
          <label className="chk"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Texto</label>
          <label className="chk"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Precio</label>
        </div>

        <div className="etq-row">
          <button className="btn-sm" onClick={selectAllVisible}>Seleccionar todos ({visible.length})</button>
          <button className="btn-sm ghost" onClick={clearAll}>Limpiar selección</button>
          <button className="btn-sm gold" onClick={makePdf} disabled={!labels.length}>
            Descargar PDF ({labels.length})
          </button>
          <button className="btn-sm" onClick={() => window.print()} disabled={!labels.length}>Imprimir</button>
        </div>

        <table className="adm-table">
          <thead><tr><th></th><th>Ref</th><th>Producto</th><th>Texto etiqueta</th><th>Precio</th><th>Copias</th></tr></thead>
          <tbody>
            {visible.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={!!sel[p.id]} onChange={() => toggle(p)} /></td>
                <td style={{ fontFamily: 'monospace', fontSize: '.82rem' }}>{p.sku}</td>
                <td>{p.name}</td>
                <td>{sel[p.id] ? (
                  <input value={textFor(p)} onChange={(e) => setText(p.id, e.target.value)} placeholder="Blusa Az" style={{ width: 150 }} />
                ) : '—'}</td>
                <td>{euros(p.price)}</td>
                <td>{sel[p.id] ? (
                  <input type="number" min={1} value={sel[p.id]} onChange={(e) => setCopies(p.id, +e.target.value)} style={{ width: 64 }} />
                ) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="etq-print">
        {labels.map((p, i) => (
          <div className="etq-label" key={i}>
            {showName && <div className="etq-name">{textFor(p)}</div>}
            <Barcode value={p.sku} />
            <div className="etq-sku">{p.sku}</div>
            {showPrice && <div className="etq-price">{euros(p.price)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
