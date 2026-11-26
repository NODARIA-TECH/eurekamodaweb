'use client';
// Pantalla pensada para el móvil: elegir prenda → «Hacer foto» o «Galería» → se sube, se optimiza
// y se guarda en el producto sin pulsar nada más. También permite crear una prenda nueva.
import { useMemo, useRef, useState } from 'react';
import { uploadFile, isImageFile } from '@/lib/upload-client';
import { productImg } from '@/lib/data';
import { guardarFotos, crearPrenda, type FotoProducto } from '@/app/admin/(panel)/fotos/actions';

type Subida = { key: string; nombre: string; estado: 'cola' | 'subiendo' | 'procesando' | 'ok' | 'error'; p: number; preview?: string; error?: string };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const real = (u?: string) => !!u && /^(\/media\/|\/uploads\/|\/img\/|https?:)/.test(u);
let seq = 0;

export default function FotosMovil({ productos, categorias }: { productos: FotoProducto[]; categorias: { slug: string; name: string }[] }) {
  const [lista, setLista] = useState(productos);
  const [q, setQ] = useState('');
  const [soloSinFoto, setSoloSinFoto] = useState(false);
  const [sel, setSel] = useState<FotoProducto | null>(null);
  const [color, setColor] = useState('');
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [modo, setModo] = useState<'buscar' | 'nueva'>('buscar');
  const [nueva, setNueva] = useState({ name: '', price: '', category: categorias[0]?.slug || '', stock: '1' });
  const [aviso, setAviso] = useState('');
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const cola = useRef<{ key: string; file: File }[]>([]);
  const corriendo = useRef(false);
  const selRef = useRef<FotoProducto | null>(null);
  selRef.current = sel;
  const colorRef = useRef('');
  colorRef.current = color;

  const visibles = useMemo(() => {
    const t = norm(q.trim());
    return lista
      .filter((p) => (!t || norm(`${p.name} ${p.sku || ''}`).includes(t)) && (!soloSinFoto || !real(p.image)))
      .sort((a, b) => Number(real(a.image)) - Number(real(b.image)))
      .slice(0, 60);
  }, [lista, q, soloSinFoto]);

  const patch = (key: string, ch: Partial<Subida>) => setSubidas((l) => l.map((s) => (s.key === key ? { ...s, ...ch } : s)));

  async function procesar() {
    if (corriendo.current) return;
    corriendo.current = true;
    try {
      for (let item = cola.current.shift(); item; item = cola.current.shift()) {
        const { key, file } = item;
        const prod = selRef.current;
        if (!prod) break;
        patch(key, { estado: 'subiendo', p: 0 });
        try {
          const r = await uploadFile(file, { onProgress: (p, fase) => patch(key, { p, estado: fase }) });
          if (!r.src) throw new Error('El servidor no devolvió la foto.');
          const g = await guardarFotos(prod.id, [r.src], colorRef.current);
          if (!g.ok || !g.producto) throw new Error(g.error || 'No se pudo guardar en el producto.');
          const np = g.producto;
          setSel((s) => (s && s.id === np.id ? np : s));
          setLista((l) => l.map((p) => (p.id === np.id ? np : p)));
          patch(key, { estado: 'ok', p: 1 });
        } catch (e: any) {
          patch(key, { estado: 'error', error: e?.message || 'No se pudo subir.' });
        }
      }
    } finally { corriendo.current = false; }
  }

  function anadir(files: FileList | null) {
    setAviso('');
    const fs = Array.from(files || []).filter(isImageFile);
    if (!fs.length) { if (files?.length) setAviso('Eso no parece una foto.'); return; }
    const nuevas = fs.map((file) => ({ key: 'f' + ++seq, file }));
    cola.current.push(...nuevas);
    setSubidas((l) => [...nuevas.map((n) => ({ key: n.key, nombre: n.file.name || 'foto', estado: 'cola' as const, p: 0, preview: /hei[cf]/i.test(n.file.type + n.file.name) ? undefined : URL.createObjectURL(n.file) })), ...l]);
    setTimeout(procesar, 0);
  }

  async function crear() {
    setAviso('');
    const r = await crearPrenda(nueva);
    if (!r.ok || !r.producto) { setAviso(r.error || 'No se pudo crear.'); return; }
    setLista((l) => [r.producto!, ...l]);
    elegir(r.producto);
    setNueva({ name: '', price: '', category: nueva.category, stock: '1' });
    setModo('buscar');
    setAviso('Prenda creada. Ahora hazle las fotos.');
  }

  function elegir(p: FotoProducto | null) {
    if (subidas.some((s) => s.estado === 'cola' || s.estado === 'subiendo' || s.estado === 'procesando')) { setAviso('Espera a que terminen de subirse las fotos de esta prenda.'); return; }
    setSel(p); setColor(''); setSubidas([]); setAviso('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const ocupada = subidas.some((s) => s.estado === 'cola' || s.estado === 'subiendo' || s.estado === 'procesando');
  const fotos = sel ? [sel.image, ...sel.images].filter(real) : [];

  return (
    <div className="fm">
      <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { anadir(e.target.files); e.target.value = ''; }} />
      <input ref={galeria} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { anadir(e.target.files); e.target.value = ''; }} />
      {aviso && <p className="fm-aviso">{aviso}</p>}

      {sel ? (
        <section className="fm-sel adm-card">
          <div className="fm-sel-h">
            <button type="button" className="btn-sm ghost" onClick={() => elegir(null)}>← Otra prenda</button>
            <a className="btn-sm ghost" href={`/admin/productos/${sel.id}`}>Ficha completa</a>
          </div>
          <h2>{sel.name}</h2>
          <p className="adm-help">{sel.sku}{sel.price ? ` · ${(sel.price / 100).toFixed(2).replace('.', ',')} €` : ' · sin precio (no sale en la tienda hasta ponerlo)'}{sel.hidden ? ' · oculto' : ''}</p>
          {sel.colors.length > 0 && (
            <div className="fm-colores">
              <span>¿De qué color es la foto? (opcional)</span>
              <div>
                <button type="button" className={!color ? 'on' : ''} onClick={() => setColor('')}>General</button>
                {sel.colors.map((c) => <button type="button" key={c} className={color === c ? 'on' : ''} onClick={() => setColor(c)}>{c}{sel.colorImages[c] ? ' ✓' : ''}</button>)}
              </div>
            </div>
          )}
          <div className="fm-botones">
            <button type="button" className="fm-big gold" onClick={() => camara.current?.click()}>📷<b>Hacer foto</b></button>
            <button type="button" className="fm-big" onClick={() => galeria.current?.click()}>🖼️<b>Elegir de la galería</b><small>puedes elegir varias</small></button>
          </div>
          {subidas.length > 0 && (
            <ul className="fm-subidas">
              {subidas.map((s) => (
                <li key={s.key} className={s.estado}>
                  {s.preview ? <img src={s.preview} alt="" /> : <span className="fm-ph">foto</span>}
                  <span>
                    {s.estado === 'cola' && 'En cola…'}
                    {s.estado === 'subiendo' && `Subiendo ${Math.round(s.p * 100)} %`}
                    {s.estado === 'procesando' && 'Optimizando…'}
                    {s.estado === 'ok' && '✓ Guardada en la prenda'}
                    {s.estado === 'error' && <em>{s.error}</em>}
                    {(s.estado === 'subiendo' || s.estado === 'procesando') && <i className="pu-bar"><i style={{ width: `${Math.round(s.p * 100)}%` }} /></i>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3>Fotos de la prenda ({fotos.length})</h3>
          {fotos.length ? (
            <div className="fm-galeria">{fotos.map((u, i) => <figure key={u}><img src={productImg(u, 240, 320)} alt="" />{i === 0 && <figcaption>Principal</figcaption>}</figure>)}</div>
          ) : <p className="adm-help">Aún no tiene fotos: la primera que subas será la principal.</p>}
          {!ocupada && fotos.length > 0 && <p className="adm-help">Para cambiar cuál es la principal o quitar alguna, abre la <a href={`/admin/productos/${sel.id}`}>ficha completa</a>.</p>}
        </section>
      ) : (
        <>
          <div className="fm-tabs">
            <button type="button" className={modo === 'buscar' ? 'on' : ''} onClick={() => setModo('buscar')}>Prenda que ya existe</button>
            <button type="button" className={modo === 'nueva' ? 'on' : ''} onClick={() => setModo('nueva')}>＋ Prenda nueva</button>
          </div>
          {modo === 'nueva' ? (
            <section className="adm-card fm-nueva">
              <label>Nombre<input value={nueva.name} onChange={(e) => setNueva({ ...nueva, name: e.target.value })} placeholder="Jersey trenzado cuello alto" /></label>
              <div className="fm-2">
                <label>Precio (€)<input inputMode="decimal" value={nueva.price} onChange={(e) => setNueva({ ...nueva, price: e.target.value })} placeholder="19,90" /></label>
                <label>Unidades<input inputMode="numeric" value={nueva.stock} onChange={(e) => setNueva({ ...nueva, stock: e.target.value })} /></label>
              </div>
              <label>Categoría<select value={nueva.category} onChange={(e) => setNueva({ ...nueva, category: e.target.value })}>{categorias.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
              <button type="button" className="fm-big gold" onClick={crear}>Crear y hacer fotos</button>
              <p className="adm-help">Tallas, colores y descripción se pueden añadir después en la ficha completa.</p>
            </section>
          ) : (
            <section className="adm-card">
              <input className="fm-buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código (PEK-…)" autoComplete="off" />
              <label className="fm-check"><input type="checkbox" checked={soloSinFoto} onChange={(e) => setSoloSinFoto(e.target.checked)} /> Solo las que no tienen foto</label>
              <ul className="fm-lista">
                {visibles.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => elegir(p)}>
                      {real(p.image) ? <img src={productImg(p.image, 120, 160)} alt="" /> : <span className="fm-ph">sin foto</span>}
                      <span><b>{p.name}</b><small>{p.sku}{!p.price ? ' · sin precio' : ''}</small></span>
                      <i>›</i>
                    </button>
                  </li>
                ))}
                {!visibles.length && <li className="adm-help">No hay ninguna con ese nombre. Puedes crearla en «＋ Prenda nueva».</li>}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
