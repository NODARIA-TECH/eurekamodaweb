'use client';
// Editor de la portada: tarjetas por bloque a la izquierda, vista previa en directo a la derecha.
// Guardado automático del borrador (con cola, reintentos y copia local), publicar, deshacer e historial.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CAT_PHOTO, SECTION_NAMES,
  type SectionId, type SiteContent, type SPick,
} from '@/lib/site-content';
import type { EditorState } from '@/lib/site-store';
import {
  Txt, Switch, LinkField, Href, Seg, Mover, move, ImageField, ProductSelect, Ico, I,
  type PProduct,
} from './PageFields';

type Status = 'saved' | 'pending' | 'saving' | 'error' | 'conflict' | 'auth';
type CardId = SectionId | 'promo';
interface Cat { slug: string; name: string }

const BACKUP_KEY = 'eureka-pagina-copia';
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const realPhoto = (src: string) => /^\/(img|media|uploads)\//.test(src || '');

async function api(body: object, keepalive = false) {
  const r = await fetch('/admin/api/pagina', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive, cache: 'no-store',
  });
  if (r.redirected && r.url.includes('/admin/login')) return { status: 401, error: 'La sesión ha caducado.' } as { status: number; error?: string; ok?: boolean; conflict?: boolean; state?: EditorState };
  let j: any = {};
  try { j = await r.json(); } catch { if (r.ok) j = { error: 'Respuesta inesperada del servidor' }; }
  return { status: r.status, ...j } as { status: number; ok?: boolean; conflict?: boolean; state?: EditorState; error?: string };
}

export default function PageEditor({ initial, products, categories }: { initial: EditorState; products: PProduct[]; categories: Cat[] }) {
  const [c, setC] = useState<SiteContent>(initial.content);
  const cRef = useRef(c);
  const [open, setOpen] = useState<CardId | null>('hero');
  const [status, setStatus] = useState<Status>('saved');
  const [errMsg, setErrMsg] = useState('');
  const [meta, setMeta] = useState({ dirty: initial.dirty, publishedAt: initial.publishedAt, draftAt: initial.draftAt, history: initial.history });
  const [conflict, setConflict] = useState<EditorState | null>(null);
  const [backup, setBackup] = useState<{ content: SiteContent; at: number } | null>(null);
  const [modal, setModal] = useState<null | 'history' | 'discard' | 'publish'>(null);
  const [toast, setToast] = useState('');
  const [device, setDevice] = useState<'desk' | 'phone'>('desk');
  const [showPrev, setShowPrev] = useState(false);   // en pantallas pequeñas la vista previa va a pantalla completa
  const [busy, setBusy] = useState(false);
  const [, force] = useState(0);

  // ---------- Deshacer / rehacer ----------
  const past = useRef<SiteContent[]>([]);
  const future = useRef<SiteContent[]>([]);
  const lastKey = useRef<{ key?: string; t: number }>({ t: 0 });

  const replace = useCallback((next: SiteContent, undoable = true) => {
    if (undoable) { past.current.push(cRef.current); if (past.current.length > 100) past.current.shift(); future.current = []; }
    lastKey.current = { t: 0 };
    cRef.current = next;
    setC(next);
  }, []);

  // Cambia el contenido. `key` agrupa las pulsaciones seguidas en un mismo campo en un único paso de "Deshacer".
  const patch = useCallback((fn: (d: SiteContent) => void, key?: string) => {
    const prev = cRef.current;
    const next = clone(prev);
    fn(next);
    const now = Date.now();
    if (!(key && lastKey.current.key === key && now - lastKey.current.t < 1500)) {
      past.current.push(prev);
      if (past.current.length > 100) past.current.shift();
    }
    lastKey.current = { key, t: now };
    future.current = [];
    cRef.current = next;
    setC(next);
  }, []);

  const undo = useCallback(() => {
    const p = past.current.pop();
    if (!p) return;
    future.current.push(cRef.current);
    lastKey.current = { t: 0 };
    cRef.current = p; setC(p); force((x) => x + 1);
  }, []);
  const redo = useCallback(() => {
    const f = future.current.pop();
    if (!f) return;
    past.current.push(cRef.current);
    lastKey.current = { t: 0 };
    cRef.current = f; setC(f); force((x) => x + 1);
  }, []);

  // ---------- Guardado automático ----------
  const rev = useRef(initial.rev);
  const savedJson = useRef(JSON.stringify(initial.content));
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const retries = useRef(0);
  const blocked = useRef(false);   // conflicto o sesión caducada: no reintentar solo

  const unsaved = () => JSON.stringify(cRef.current) !== savedJson.current;

  const saveOnce = useCallback(async (): Promise<boolean> => {
    const content = cRef.current;
    const json = JSON.stringify(content);
    if (json === savedJson.current) return true;
    setStatus('saving');
    try {
      const r = await api({ action: 'save', rev: rev.current, content });
      if (r.status === 409 && r.state) { blocked.current = true; setConflict(r.state); setStatus('conflict'); return false; }
      if (r.status === 401) { blocked.current = true; setStatus('auth'); setErrMsg(r.error || ''); return false; }
      if (!r.ok || !r.state) throw new Error(r.error || 'Error al guardar');
      rev.current = r.state.rev;
      savedJson.current = json;
      retries.current = 0;
      setMeta({ dirty: r.state.dirty, publishedAt: r.state.publishedAt, draftAt: r.state.draftAt, history: r.state.history });
      return true;
    } catch (e: any) {
      setStatus('error');
      setErrMsg(!navigator.onLine ? 'sin conexión a internet' : e instanceof TypeError ? 'no hay conexión con la web' : (e?.message || 'error del servidor'));
      const wait = Math.min(30000, 2000 * 2 ** retries.current++);
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => { flush(); }, wait);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarda hasta que no quede nada pendiente. Nunca hay dos guardados a la vez.
  const flush = useCallback((): Promise<boolean> => {
    if (blocked.current) return Promise.resolve(false);
    if (running.current) return running.current.then((ok) => (ok && unsaved() ? flush() : ok));
    clearTimeout(timer.current);
    const p = (async () => {
      let ok = true;
      do { ok = await saveOnce(); } while (ok && unsaved());
      if (ok) {
        setStatus('saved'); setErrMsg('');
        try { localStorage.removeItem(BACKUP_KEY); } catch { /* modo privado */ }   // ya está en el servidor
      }
      return ok;
    })();
    running.current = p;
    p.finally(() => { running.current = null; });
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveOnce]);

  // Cada cambio: vista previa al instante, copia local y guardado a los 0,7 s.
  const frame = useRef<HTMLIFrameElement>(null);
  const sendPreview = useCallback((msg: object) => frame.current?.contentWindow?.postMessage(msg, location.origin), []);
  const first = useRef(true);
  useEffect(() => {
    sendPreview({ type: 'eureka:content', content: c });
    if (first.current) { first.current = false; return; }
    const json = JSON.stringify(c);
    try {
      if (json !== savedJson.current) localStorage.setItem(BACKUP_KEY, JSON.stringify({ rev: rev.current, at: Date.now(), content: c }));
      else localStorage.removeItem(BACKUP_KEY);
    } catch { /* modo privado */ }
    if (json === savedJson.current) { if (!running.current && !blocked.current) setStatus('saved'); return; }
    if (blocked.current) return;
    setStatus((s) => (s === 'saving' ? s : 'pending'));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { flush(); }, 700);
  }, [c, flush, sendPreview]);

  // Copia local de una sesión anterior que no llegó a guardarse (corte de luz, sin conexión…).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return;
      const b = JSON.parse(raw);
      if (b?.content && JSON.stringify(b.content) !== savedJson.current) setBackup({ content: b.content, at: b.at });
      else localStorage.removeItem(BACKUP_KEY);
    } catch { /* */ }
  }, []);

  // No perder nada al cerrar: aviso si queda algo sin guardar y último intento de guardado.
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (unsaved()) { e.preventDefault(); e.returnValue = ''; } };
    const hide = () => {
      if (unsaved() && !blocked.current && !running.current) {
        api({ action: 'save', rev: rev.current, content: cRef.current }, true).catch(() => undefined);
      }
    };
    const online = () => { if (unsaved()) flush(); };
    window.addEventListener('beforeunload', before);
    window.addEventListener('pagehide', hide);
    window.addEventListener('online', online);
    return () => { window.removeEventListener('beforeunload', before); window.removeEventListener('pagehide', hide); window.removeEventListener('online', online); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atajos: Ctrl/Cmd+Z deshacer, Ctrl/Cmd+Shift+Z o Ctrl+Y rehacer, Ctrl/Cmd+S guardar ya.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const inField = (e.target as HTMLElement)?.closest?.('input, textarea');
      if (k === 's') { e.preventDefault(); flush(); return; }
      if (inField) return;               // dentro de un campo, el deshacer del propio texto
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flush, undo, redo]);

  // ---------- Vista previa ----------
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data || {};
      if (d.type === 'eureka:ready') { sendPreview({ type: 'eureka:content', content: cRef.current }); }
      if (d.type === 'eureka:select' && d.id) {
        setOpen(d.id);
        sendPreview({ type: 'eureka:focus', id: d.id, scroll: false });
        setTimeout(() => document.getElementById('card-' + d.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [sendPreview]);

  const toggleCard = (id: CardId) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next) sendPreview({ type: 'eureka:focus', id: next });
  };

  const paneRef = useRef<HTMLDivElement>(null);
  const [pane, setPane] = useState({ w: 800, h: 700 });
  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setPane({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [showPrev]);
  const devW = device === 'desk' ? 1280 : 390;
  const devH = device === 'desk' ? pane.h : Math.max(300, pane.h - 32);
  const scale = Math.min(1, (pane.w - (device === 'desk' ? 0 : 24)) / devW);

  // ---------- Acciones ----------
  const flashToast = (t: string) => { setToast(t); setTimeout(() => setToast((x) => (x === t ? '' : x)), 3200); };

  async function afterSaved<T>(fn: () => Promise<T>) {
    clearTimeout(timer.current);
    const ok = await flush();
    if (!ok) { flashToast('Primero hay que resolver el aviso de guardado.'); return null; }
    return fn();
  }

  function applyState(st: EditorState, undoable: boolean) {
    rev.current = st.rev;
    savedJson.current = JSON.stringify(st.content);
    setMeta({ dirty: st.dirty, publishedAt: st.publishedAt, draftAt: st.draftAt, history: st.history });
    if (JSON.stringify(cRef.current) !== savedJson.current) replace(st.content, undoable);
  }

  async function publish() {
    setBusy(true);
    try {
      await afterSaved(async () => {
        const r = await api({ action: 'publish', rev: rev.current });
        if (r.status === 409 && r.state) { blocked.current = true; setConflict(r.state); setStatus('conflict'); return; }
        if (!r.ok || !r.state) { flashToast(r.error || 'No se pudo publicar. Inténtalo de nuevo.'); return; }
        applyState(r.state, false);
        setStatus('saved');
        flashToast('¡Publicado! Ya se ve así en eurekamoda.com');
      });
    } finally { setBusy(false); setModal(null); }
  }

  async function discard() {
    setBusy(true);
    try {
      clearTimeout(timer.current);
      if (running.current) await running.current;
      const r = await api({ action: 'discard', rev: rev.current });
      if (r.status === 409 && r.state) { blocked.current = true; setConflict(r.state); setStatus('conflict'); return; }
      if (!r.ok || !r.state) { flashToast(r.error || 'No se pudo descartar.'); return; }
      applyState(r.state, true);
      setStatus('saved');
      flashToast('Cambios descartados. Puedes deshacerlo con «Deshacer».');
    } finally { setBusy(false); setModal(null); }
  }

  async function restore(id: string) {
    setBusy(true);
    try {
      await afterSaved(async () => {
        const r = await api({ action: 'restore', id, rev: rev.current });
        if (r.status === 409 && r.state) { blocked.current = true; setConflict(r.state); setStatus('conflict'); return; }
        if (!r.ok || !r.state) { flashToast(r.error || 'No se pudo cargar esa versión.'); return; }
        applyState(r.state, true);
        setStatus('saved');
        flashToast('Versión cargada como borrador. Revísala y pulsa «Publicar».');
      });
    } finally { setBusy(false); setModal(null); }
  }

  function resolveConflict(keepMine: boolean) {
    const st = conflict;
    if (!st) return;
    setConflict(null);
    blocked.current = false;
    rev.current = st.rev;
    setMeta({ dirty: st.dirty, publishedAt: st.publishedAt, draftAt: st.draftAt, history: st.history });
    if (keepMine) { savedJson.current = JSON.stringify(st.content); flush(); }
    else { savedJson.current = JSON.stringify(st.content); replace(st.content, true); setStatus('saved'); }
  }

  function recoverBackup(use: boolean) {
    if (use && backup) replace(backup.content, true);
    try { localStorage.removeItem(BACKUP_KEY); } catch { /* */ }
    setBackup(null);
  }

  // ---------- Ayudas de edición ----------
  const pmap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const catName = (slug: string) => categories.find((x) => x.slug === slug)?.name || slug;
  const sec = (id: SectionId) => c.sections.find((s) => s.id === id)!;

  // Elegir un producto para una pieza destacada: nombre y foto del producto si aún no tiene.
  const pickProduct = (get: (d: SiteContent) => SPick, id: string) => patch((d) => {
    const pk = get(d);
    const p = pmap.get(id);
    pk.productId = id;
    if (p) { pk.name = p.name; if (realPhoto(p.image) && !pk.img.src) pk.img = { src: p.image, x: 50, y: 25, alt: p.name }; }
  });

  const statusView = {
    saved: { cls: 'ok', text: meta.dirty ? 'Borrador guardado' : 'Todo publicado' },
    pending: { cls: 'wait', text: 'Cambios sin guardar…' },
    saving: { cls: 'wait', text: 'Guardando…' },
    error: { cls: 'bad', text: `No se pudo guardar · reintentando${errMsg ? ` (${errMsg})` : ''}` },
    conflict: { cls: 'bad', text: 'Editado desde otro sitio' },
    auth: { cls: 'bad', text: 'Sesión caducada' },
  }[status];

  // ---------- Tarjetas ----------
  const cardHead = (id: CardId, sub: string, i?: number) => {
    const s = id === 'promo' ? null : sec(id);
    const shown = id === 'promo' ? c.promo.show : s!.show;
    const n = c.sections.length;
    return (
      <div className="pc-head">
        <button type="button" className="pc-toggle" onClick={() => toggleCard(id)} aria-expanded={open === id}>
          <Ico d={I.chev} />
          <span><b>{id === 'promo' ? 'Barra de aviso' : SECTION_NAMES[id]}</b><small>{shown ? sub : 'Oculto en la web'}</small></span>
        </button>
        <span className="pc-acts">
          {i !== undefined && (
            <>
              <button type="button" disabled={i === 0} aria-label="Subir bloque" title="Subir" onClick={() => patch((d) => move(d.sections, i, i - 1))}><Ico d={I.up} /></button>
              <button type="button" disabled={i === n - 1} aria-label="Bajar bloque" title="Bajar" onClick={() => patch((d) => move(d.sections, i, i + 1))}><Ico d={I.down} /></button>
            </>
          )}
          <button type="button" className={shown ? '' : 'off'} title={shown ? 'Ocultar en la web' : 'Mostrar en la web'} aria-label={shown ? 'Ocultar' : 'Mostrar'}
            onClick={() => patch((d) => { if (id === 'promo') d.promo.show = !d.promo.show; else { const x = d.sections.find((q) => q.id === id)!; x.show = !x.show; } })}>
            <Ico d={shown ? I.eye : I.eyeOff} />
          </button>
        </span>
      </div>
    );
  };

  const pickEditor = (label: string, get: (d: SiteContent) => SPick, k: string, big: boolean) => {
    const pk = get(c);
    const prod = pk.productId ? pmap.get(pk.productId) : undefined;
    return (
      <div className="pc-group">
        <h5>{label}</h5>
        <div className="pf">
          <span className="pf-l">Producto enlazado</span>
          <ProductSelect products={products} value={pk.productId} onChange={(id) => (id ? pickProduct(get, id) : patch((d) => { get(d).productId = ''; }))} />
          <span className="pf-h">{prod ? 'Al pulsar se abre su ficha y se muestra su precio actual.' : 'Sin producto: elige a dónde lleva con el enlace de abajo.'}</span>
        </div>
        {!prod && <Href label="Enlace" value={pk.href} onChange={(v) => patch((d) => { get(d).href = v; }, k + 'href')} />}
        <ImageField label="Foto" value={pk.img} ratio={big ? '4 / 5' : '1 / 1'} onChange={(v, kk) => patch((d) => { get(d).img = v; }, k + 'img' + kk)}
          extra={prod && realPhoto(prod.image) && prod.image !== pk.img.src
            ? <button type="button" className="btn-s ghost" onClick={() => patch((d) => { get(d).img = { src: prod.image, x: 50, y: 25, alt: prod.name }; })}>Usar la foto del producto</button>
            : undefined} />
        <Txt label="Nombre que se muestra" value={pk.name} max={90} onChange={(v) => patch((d) => { get(d).name = v; }, k + 'name')} />
        {big ? (
          <div className="pf-2">
            <Txt label="Etiqueta pequeña" value={pk.tag} max={60} placeholder="Pieza destacada" onChange={(v) => patch((d) => { get(d).tag = v; }, k + 'tag')} />
            <Txt label="Frase manuscrita" value={pk.script} max={60} placeholder="Fashion mood ♥" onChange={(v) => patch((d) => { get(d).script = v; }, k + 'script')} />
          </div>
        ) : (
          <Txt label="Detalle" value={pk.sub} max={90} placeholder="Punto · canalé" onChange={(v) => patch((d) => { get(d).sub = v; }, k + 'sub')} />
        )}
      </div>
    );
  };

  const heads = (id: 'cats' | 'edit' | 'rail' | 'collage', withScript: boolean) => {
    const o = c[id] as { label: string; title: string; script?: string };
    return (
      <div className="pf-2">
        {withScript && <Txt label="Frase manuscrita" value={o.script || ''} max={40} onChange={(v) => patch((d) => { (d[id] as any).script = v; }, id + 'script')} />}
        <Txt label="Antetítulo" value={o.label} max={60} onChange={(v) => patch((d) => { (d[id] as any).label = v; }, id + 'label')} />
        <Txt label="Título" value={o.title} max={80} onChange={(v) => patch((d) => { (d[id] as any).title = v; }, id + 'title')} />
      </div>
    );
  };

  const body = (id: CardId): React.ReactNode => {
    switch (id) {
      case 'promo': return (
        <>
          <Txt label="Texto de la barra" value={c.promo.text} max={200} onChange={(v) => patch((d) => { d.promo.text = v; }, 'promo')}
            hint="Lo que pongas entre **dos asteriscos** sale en negrita. Ej.: Envío **gratis** desde 50 €" />
        </>
      );
      case 'hero': {
        const h = c.hero;
        return (
          <>
            <div className="pc-group">
              <h5>Fotos <small>({h.images.length} de 3 · en móvil se ve solo una)</small></h5>
              <div className="pc-list">
                {h.images.map((im, i) => (
                  <div className="pc-item" key={i}>
                    <div className="pc-item-h">
                      <b>Foto {i + 1}</b>
                      <label className="radio"><input type="radio" name="hero-mob" checked={h.mobile === i} onChange={() => patch((d) => { d.hero.mobile = i; })} />Se ve en el móvil</label>
                      <Mover i={i} n={h.images.length}
                        onMove={(to) => patch((d) => { const m = d.hero.images[d.hero.mobile]; move(d.hero.images, i, to); d.hero.mobile = d.hero.images.indexOf(m); })}
                        onRemove={h.images.length > 1 ? () => patch((d) => { const m = d.hero.images[d.hero.mobile]; d.hero.images.splice(i, 1); d.hero.mobile = Math.max(0, d.hero.images.indexOf(m)); }) : undefined} />
                    </div>
                    <ImageField label="" value={im} ratios={h.images.length === 1 ? [['16 / 9', 'Ordenador'], ['9 / 16', 'Móvil']] : [['3 / 5', 'Ordenador'], ['9 / 16', 'Móvil']]}
                      onChange={(v, k) => patch((d) => { d.hero.images[i] = v; }, `hero${i}${k}`)} />
                  </div>
                ))}
              </div>
              {h.images.length < 3 && (
                <button type="button" className="btn-s ghost" onClick={() => patch((d) => { d.hero.images.push({ src: '', x: 50, y: 20, alt: '' }); })}><Ico d={I.plus} />Añadir foto</button>
              )}
              <label className="pf">
                <span className="pf-l">Oscurecer la foto <em>{h.shade}%</em></span>
                <input type="range" min={0} max={85} value={h.shade} onChange={(e) => patch((d) => { d.hero.shade = Number(e.target.value); }, 'shade')} />
                <span className="pf-h">Para que el texto blanco se lea bien encima de la foto.</span>
              </label>
            </div>
            <div className="pc-group">
              <h5>Textos</h5>
              <div className="pf-2">
                <Txt label="Antetítulo" value={h.kicker} max={60} onChange={(v) => patch((d) => { d.hero.kicker = v; }, 'kicker')} />
                <Txt label="Título grande" value={h.title} max={40} onChange={(v) => patch((d) => { d.hero.title = v; }, 'title')} />
              </div>
              <Txt label="Frase manuscrita" value={h.script} max={60} onChange={(v) => patch((d) => { d.hero.script = v; }, 'script')} />
              <Txt label="Texto" multiline value={h.sub} max={300} onChange={(v) => patch((d) => { d.hero.sub = v; }, 'sub')} />
            </div>
            <div className="pc-group">
              <h5>Botones</h5>
              <LinkField label="Botón principal" value={h.cta1} onChange={(v, k) => patch((d) => { d.hero.cta1 = v; }, 'cta1' + k)} />
              <LinkField label="Botón secundario" value={h.cta2} onChange={(v, k) => patch((d) => { d.hero.cta2 = v; }, 'cta2' + k)} />
            </div>
            <div className="pc-group">
              <h5>Frases de las esquinas <small>(solo en ordenador · vacío = no se muestra)</small></h5>
              <div className="pf-2">
                <Txt label="Arriba izquierda" multiline rows={2} value={h.capTL} max={80} onChange={(v) => patch((d) => { d.hero.capTL = v; }, 'capTL')} />
                <Txt label="Arriba derecha" multiline rows={2} value={h.capTR} max={80} onChange={(v) => patch((d) => { d.hero.capTR = v; }, 'capTR')} />
                <Txt label="Abajo izquierda" multiline rows={2} value={h.capBL} max={80} onChange={(v) => patch((d) => { d.hero.capBL = v; }, 'capBL')} />
                <Txt label="Abajo derecha" multiline rows={2} value={h.capBR} max={80} onChange={(v) => patch((d) => { d.hero.capBR = v; }, 'capBR')} />
              </div>
            </div>
          </>
        );
      }
      case 'strip': return (
        <>
          <div className="pc-list">
            {c.strip.items.map((it, i) => (
              <div className="pc-row" key={i}>
                <input type="text" value={it.text} maxLength={60} placeholder="Frase" onChange={(e) => patch((d) => { d.strip.items[i].text = e.target.value; }, 'strip' + i)} />
                <label className="chk"><input type="checkbox" checked={it.script} onChange={(e) => patch((d) => { d.strip.items[i].script = e.target.checked; })} />Manuscrita</label>
                <Mover i={i} n={c.strip.items.length} onMove={(to) => patch((d) => move(d.strip.items, i, to))} onRemove={() => patch((d) => { d.strip.items.splice(i, 1); })} />
              </div>
            ))}
          </div>
          {c.strip.items.length < 8 && <button type="button" className="btn-s ghost" onClick={() => patch((d) => { d.strip.items.push({ text: '', script: false }); })}><Ico d={I.plus} />Añadir frase</button>}
          <p className="pf-h">Entre frases se pone un corazón dorado automáticamente.</p>
        </>
      );
      case 'cats': {
        const manual = c.cats.items.length > 0;
        const free = categories.filter((x) => !c.cats.items.some((i) => i.slug === x.slug));
        return (
          <>
            {heads('cats', false)}
            <Seg value={manual ? 'manual' : 'auto'} options={[['auto', 'Automático'], ['manual', 'Elegir yo']]}
              onChange={(v) => patch((d) => {
                if (v === 'auto') d.cats.items = [];
                else if (!d.cats.items.length) d.cats.items = categories.filter((x) => CAT_PHOTO[x.slug]).slice(0, 4).map((x) => ({ slug: x.slug, img: null }));
              })} />
            {!manual ? <p className="pf-h">Se muestran 4 categorías: primero las que tienen foto y productos a la venta.</p> : (
              <>
                <div className="pc-list">
                  {c.cats.items.map((it, i) => (
                    <div className="pc-item" key={it.slug}>
                      <div className="pc-item-h"><b>{catName(it.slug)}</b>
                        <Mover i={i} n={c.cats.items.length} onMove={(to) => patch((d) => move(d.cats.items, i, to))} onRemove={c.cats.items.length > 1 ? () => patch((d) => { d.cats.items.splice(i, 1); }) : undefined} />
                      </div>
                      {it.img ? (
                        <ImageField label="Foto" value={it.img} ratio="3 / 4" onRemove={() => patch((d) => { d.cats.items[i].img = null; })}
                          onChange={(v, k) => patch((d) => { d.cats.items[i].img = v; }, 'cat' + it.slug + k)} />
                      ) : (
                        <div className="pc-def">
                          {CAT_PHOTO[it.slug] && <img src={CAT_PHOTO[it.slug]} alt="" />}
                          <span>{CAT_PHOTO[it.slug] ? 'Foto por defecto' : 'Foto de la categoría'}</span>
                          <button type="button" className="btn-s ghost" onClick={() => patch((d) => { d.cats.items[i].img = { src: CAT_PHOTO[it.slug] || '', x: 50, y: 30, alt: catName(it.slug) }; })}>Poner otra foto</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {free.length > 0 && c.cats.items.length < 8 && (
                  <select className="pf-sel" value="" onChange={(e) => e.target.value && patch((d) => { d.cats.items.push({ slug: e.target.value, img: null }); })}>
                    <option value="">+ Añadir categoría…</option>
                    {free.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
                  </select>
                )}
                <p className="pf-h">Se ven de 4 en 4 por fila. Lo ideal: 4 u 8.</p>
              </>
            )}
          </>
        );
      }
      case 'edit': return (
        <>
          {heads('edit', true)}
          {pickEditor('Pieza grande', (d) => d.edit.big, 'big', true)}
          {pickEditor('Pieza pequeña 1', (d) => d.edit.minis[0], 'm0', false)}
          {pickEditor('Pieza pequeña 2', (d) => d.edit.minis[1], 'm1', false)}
          <LinkField label="Botón inferior" value={c.edit.btn} onChange={(v, k) => patch((d) => { d.edit.btn = v; }, 'ebtn' + k)} />
        </>
      );
      case 'rail': {
        const r = c.rail;
        return (
          <>
            {heads('rail', false)}
            <Seg value={r.mode} options={[['auto', 'Automático'], ['manual', 'Elegir yo']]}
              onChange={(v) => patch((d) => { d.rail.mode = v; if (v === 'manual' && !d.rail.ids.length) d.rail.ids = products.filter((p) => realPhoto(p.image) && p.stock > 0).slice(0, 8).map((p) => p.id); })} />
            {r.mode === 'auto' ? (
              <>
                <label className="pf">
                  <span className="pf-l">Cuántos productos <em>{r.max}</em></span>
                  <input type="range" min={4} max={24} value={r.max} onChange={(e) => patch((d) => { d.rail.max = Number(e.target.value); }, 'rmax')} />
                </label>
                <p className="pf-h">Primero los que tienen foto y stock, después los últimos que has tocado. Nunca se repite una prenda.</p>
              </>
            ) : (
              <>
                <div className="pc-list">
                  {r.ids.map((id, i) => {
                    const p = pmap.get(id);
                    return (
                      <div className="pc-row prod" key={id}>
                        {p ? <><img src={p.image.startsWith('/') ? p.image : '/eureka-logo.png'} alt="" /><span>{p.name}{p.stock <= 0 && <small className="warn"> · agotado</small>}</span></> : <span className="warn">Producto borrado</span>}
                        <Mover i={i} n={r.ids.length} onMove={(to) => patch((d) => move(d.rail.ids, i, to))} onRemove={() => patch((d) => { d.rail.ids.splice(i, 1); })} />
                      </div>
                    );
                  })}
                </div>
                {r.ids.length < 24 && <ProductSelect products={products} value="" exclude={r.ids} allowNone={false} placeholder="+ Añadir producto…" onChange={(id) => id && patch((d) => { d.rail.ids.push(id); })} />}
              </>
            )}
          </>
        );
      }
      case 'collage': return (
        <>
          {heads('collage', true)}
          <div className="pc-list">
            {c.collage.items.map((it, i) => (
              <div className="pc-item" key={i}>
                <div className="pc-item-h"><b>Look {i + 1}</b>
                  <Mover i={i} n={c.collage.items.length} onMove={(to) => patch((d) => move(d.collage.items, i, to))} />
                </div>
                <ImageField label="" value={it.img} ratio={i === 1 ? '3 / 4.4' : '3 / 4'} onChange={(v, k) => patch((d) => { d.collage.items[i].img = v; }, `col${i}${k}`)} />
                <div className="pf-2">
                  <Txt label="Frase sobre la foto" value={it.label} max={50} onChange={(v) => patch((d) => { d.collage.items[i].label = v; }, `coll${i}`)} />
                  <Href label="Al pulsar, lleva a" value={it.href} placeholder="/lookbook (vacío = sin enlace)" onChange={(v) => patch((d) => { d.collage.items[i].href = v; }, `colh${i}`)} />
                </div>
              </div>
            ))}
          </div>
          <LinkField label="Botón inferior" value={c.collage.btn} onChange={(v, k) => patch((d) => { d.collage.btn = v; }, 'cbtn' + k)} />
        </>
      );
      case 'real': return (
        <>
          <div className="pf-2">
            <Txt label="Antetítulo" value={c.real.kicker} max={60} onChange={(v) => patch((d) => { d.real.kicker = v; }, 'rk')} />
            <Txt label="Frase manuscrita" value={c.real.script} max={40} onChange={(v) => patch((d) => { d.real.script = v; }, 'rs')} />
          </div>
          <Txt label="Título" value={c.real.title} max={80} onChange={(v) => patch((d) => { d.real.title = v; }, 'rt')} />
          <Txt label="Texto" multiline rows={4} value={c.real.text} max={500} onChange={(v) => patch((d) => { d.real.text = v; }, 'rx')} />
          <LinkField label="Botón" value={c.real.btn} onChange={(v, k) => patch((d) => { d.real.btn = v; }, 'rbtn' + k)} />
        </>
      );
      case 'news': return (
        <>
          <Txt label="Frase manuscrita" value={c.news.script} max={40} onChange={(v) => patch((d) => { d.news.script = v; }, 'ns')} />
          <Txt label="Título" value={c.news.title} max={80} onChange={(v) => patch((d) => { d.news.title = v; }, 'nt')} />
          <Txt label="Texto" multiline value={c.news.text} max={300} onChange={(v) => patch((d) => { d.news.text = v; }, 'nx')} />
          <p className="pf-h">El código de descuento (BIENVENIDA20) se gestiona en Stripe.</p>
        </>
      );
    }
  };

  const summary = (id: CardId): string => {
    switch (id) {
      case 'promo': return c.promo.text.replace(/\*\*/g, '');
      case 'hero': return `${c.hero.images.length} foto${c.hero.images.length > 1 ? 's' : ''} · ${c.hero.script || c.hero.title}`;
      case 'strip': return c.strip.items.map((i) => i.text).filter(Boolean).join(' · ');
      case 'cats': return c.cats.items.length ? c.cats.items.map((i) => catName(i.slug)).join(', ') : 'Automático';
      case 'edit': return [c.edit.big, ...c.edit.minis].map((p) => p.name).join(' · ');
      case 'rail': return c.rail.mode === 'auto' ? `Automático · ${c.rail.max} productos` : `${c.rail.ids.length} elegidos a mano`;
      case 'collage': return c.collage.items.map((i) => i.label).join(' · ');
      case 'real': return c.real.title;
      case 'news': return c.news.title;
    }
  };

  const card = (id: CardId, i?: number) => (
    <div key={id} id={'card-' + id} className={'pc' + (open === id ? ' open' : '')}>
      {cardHead(id, summary(id), i)}
      {open === id && <div className="pc-body">{body(id)}</div>}
    </div>
  );

  const linkOptions = useMemo(() => [
    ['/tienda', 'Tienda (todo)'], ['/lookbook', 'Lookbook'], ['#edit', 'Selección destacada (en la portada)'], ['#rail', 'Novedades (en la portada)'],
    ...categories.map((x) => [`/categoria/${x.slug}`, `Categoría: ${x.name}`]),
    ...products.slice(0, 200).map((p) => [`/producto/${p.id}`, `Producto: ${p.name}`]),
  ], [categories, products]);

  const canPublish = meta.dirty || status !== 'saved';

  return (
    <div className="pe">
      <datalist id="pe-links">{linkOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</datalist>

      <div className="pe-top">
      <header className="pe-bar">
        <div className="pe-title">
          <h1>Página de inicio</h1>
          <span className={'pe-st ' + statusView.cls} role="status" aria-live="polite"><i />{statusView.text}</span>
        </div>
        <div className="pe-acts">
          <button type="button" className="ic" onClick={undo} disabled={!past.current.length} title="Deshacer (Ctrl+Z)" aria-label="Deshacer"><Ico d={I.undo} size={18} /></button>
          <button type="button" className="ic" onClick={redo} disabled={!future.current.length} title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer"><Ico d={I.redo} size={18} /></button>
          <button type="button" className="btn-s ghost" onClick={() => setModal('history')}><Ico d={I.clock} />Versiones</button>
          <button type="button" className="btn-s ghost" onClick={() => setModal('discard')} disabled={!meta.dirty && status === 'saved'}>Descartar</button>
          <button type="button" className="btn-s ghost pe-prev-btn" onClick={() => setShowPrev(true)}><Ico d={I.eye} />Vista previa</button>
          <button type="button" className="btn-p" onClick={() => setModal('publish')} disabled={!canPublish || busy}>Publicar</button>
        </div>
      </header>

      {status === 'auth' && (
        <div className="pe-alert bad">
          <b>La sesión ha caducado.</b> Tus cambios están guardados en este navegador.
          <a className="btn-s" href="/admin/login" target="_blank" rel="noreferrer">Entrar de nuevo</a>
          <button type="button" className="btn-s ghost" onClick={() => { blocked.current = false; flush(); }}>Ya he entrado, guardar</button>
        </div>
      )}
      {conflict && (
        <div className="pe-alert bad">
          <b>La página se ha cambiado desde otra pestaña u otro dispositivo</b> ({fmt(conflict.draftAt || conflict.publishedAt)}).
          <button type="button" className="btn-s" onClick={() => resolveConflict(false)}>Cargar esa versión</button>
          <button type="button" className="btn-s ghost" onClick={() => resolveConflict(true)}>Quedarme con la mía</button>
        </div>
      )}
      {backup && (
        <div className="pe-alert">
          <b>Hay cambios del {fmt(new Date(backup.at).toISOString())} que no llegaron a guardarse.</b>
          <button type="button" className="btn-s" onClick={() => recoverBackup(true)}>Recuperarlos</button>
          <button type="button" className="btn-s ghost" onClick={() => recoverBackup(false)}>Descartarlos</button>
        </div>
      )}
      </div>

      <div className="pe-grid">
        <div className="pe-cards">
          <p className="pe-tip">Los cambios se guardan solos como <b>borrador</b>. La web no cambia hasta que pulsas <b>Publicar</b>. Toca un bloque en la vista previa para editarlo.</p>
          {card('promo')}
          {c.sections.map((s, i) => card(s.id, i))}
          <p className="pe-foot">{meta.publishedAt ? `Última publicación: ${fmt(meta.publishedAt)}` : 'Aún no se ha publicado ningún cambio desde el panel.'}</p>
        </div>

        <div className={'pe-preview' + (showPrev ? ' full' : '')}>
          <div className="pe-ptools">
            <div className="seg">
              <button type="button" className={device === 'desk' ? 'on' : ''} onClick={() => setDevice('desk')}><Ico d={I.desk} />Ordenador</button>
              <button type="button" className={device === 'phone' ? 'on' : ''} onClick={() => setDevice('phone')}><Ico d={I.phone} />Móvil</button>
            </div>
            <a className="btn-s ghost" href="/admin/vista-previa" target="_blank" rel="noreferrer"><Ico d={I.ext} />Pantalla completa</a>
            <button type="button" className="btn-s ghost pe-close" onClick={() => setShowPrev(false)}><Ico d={I.x} />Cerrar</button>
          </div>
          <div className="pe-pane" ref={paneRef}>
            <div className={'pe-device ' + device} style={{ width: devW * scale, height: devH }}>
              <iframe ref={frame} src="/admin/vista-previa" title="Vista previa de la portada"
                style={{ width: devW, height: devH / scale, transform: `scale(${scale})` }} />
            </div>
          </div>
        </div>
      </div>

      {modal === 'publish' && (
        <Modal onClose={() => setModal(null)} title="¿Publicar los cambios?">
          <p>La portada de <b>eurekamoda.com</b> pasará a verse como en la vista previa. La versión actual se guarda en «Versiones» por si quieres volver a ella.</p>
          <div className="md-acts">
            <button type="button" className="btn-s ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button type="button" className="btn-p" onClick={publish} disabled={busy}>{busy ? 'Publicando…' : 'Publicar ahora'}</button>
          </div>
        </Modal>
      )}
      {modal === 'discard' && (
        <Modal onClose={() => setModal(null)} title="¿Descartar el borrador?">
          <p>Se pierden los cambios sin publicar y el editor vuelve a mostrar lo que está ahora en la web.</p>
          <div className="md-acts">
            <button type="button" className="btn-s ghost" onClick={() => setModal(null)}>Cancelar</button>
            <button type="button" className="btn-p danger" onClick={discard} disabled={busy}>Descartar cambios</button>
          </div>
        </Modal>
      )}
      {modal === 'history' && (
        <Modal onClose={() => setModal(null)} title="Versiones publicadas">
          <p className="pf-h">Cargar una versión la pone como borrador: podrás revisarla antes de publicarla.</p>
          <ul className="md-list">
            {meta.publishedAt && <li><span><b>Ahora en la web</b><small>Publicada el {fmt(meta.publishedAt)}</small></span><em>Actual</em></li>}
            {meta.history.map((h) => (
              <li key={h.id}><span><b>Versión anterior</b><small>Publicada el {fmt(h.at)}</small></span>
                <button type="button" className="btn-s ghost" disabled={busy} onClick={() => restore(h.id)}>Cargar</button></li>
            ))}
            <li><span><b>Diseño original</b><small>Cómo se entregó la web</small></span>
              <button type="button" className="btn-s ghost" disabled={busy} onClick={() => restore('original')}>Cargar</button></li>
          </ul>
        </Modal>
      )}
      {toast && <div className="pe-toast" role="status">{toast}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return createPortal(
    <div className="mp-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="md" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}
