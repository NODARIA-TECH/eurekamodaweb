'use client';
// Subida de fotos con estado por foto: se suben en cuanto se eligen (por trozos, da igual el tamaño
// o el formato: JPG, PNG, HEIC de InShot/iPhone…), se ve la miniatura ya convertida y, si algo falla,
// se dice por qué y se puede reintentar. El formulario recibe las fotos ya guardadas (campos ocultos).
import { useEffect, useRef, useState } from 'react';
import { uploadFile, isImageFile } from '@/lib/upload-client';

type Item = {
  key: string;
  file: File;
  status: 'cola' | 'subiendo' | 'procesando' | 'ok' | 'error';
  p: number;
  src?: string;
  preview?: string;
  error?: string;
};

let seq = 0;
const heavy = (f: File) => /\.(heic|heif)$/i.test(f.name) || /hei[cf]/i.test(f.type);

export default function PhotoUploader({ name, multiple = true, label = 'Añadir fotos', hint, onChange }: {
  name: string; multiple?: boolean; label?: string; hint?: string; onChange?: (srcs: string[]) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [aviso, setAviso] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const busy = items.some((i) => i.status === 'cola' || i.status === 'subiendo' || i.status === 'procesando');
  const patch = (key: string, ch: Partial<Item>) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...ch } : i)));

  // De una en una: el servidor convierte cada foto (HEIC tarda 2-3 s) sin saturarse.
  async function run() {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find((i) => i.status === 'cola');
        if (!next) break;
        itemsRef.current = itemsRef.current.map((i) => (i.key === next.key ? { ...i, status: 'subiendo' } : i));
        patch(next.key, { status: 'subiendo', p: 0, error: undefined });
        try {
          const r = await uploadFile(next.file, { onProgress: (p, phase) => patch(next.key, { p, status: phase }) });
          if (!r.src) throw new Error('El servidor no devolvió la foto.');
          itemsRef.current = itemsRef.current.map((i) => (i.key === next.key ? { ...i, status: 'ok', src: r.src } : i));
          patch(next.key, { status: 'ok', src: r.src, p: 1 });
        } catch (e: any) {
          itemsRef.current = itemsRef.current.map((i) => (i.key === next.key ? { ...i, status: 'error' } : i));
          patch(next.key, { status: 'error', error: e?.message || 'No se pudo subir.' });
        }
      }
    } finally { running.current = false; setAviso((a) => (a.startsWith('Espera') ? '' : a)); }
  }

  function add(list: FileList | File[] | null) {
    setAviso('');
    const all = Array.from(list || []);
    const files = all.filter(isImageFile);
    if (all.length > files.length) setAviso(`${all.length - files.length} archivo(s) no son fotos y no se han subido.`);
    if (!files.length) return;
    const chosen = multiple ? files : files.slice(0, 1);
    const nuevos: Item[] = chosen.map((file) => ({
      key: 'u' + ++seq, file, status: 'cola', p: 0,
      preview: heavy(file) ? undefined : URL.createObjectURL(file),
    }));
    setItems((l) => {
      const next = multiple ? [...l, ...nuevos] : nuevos;
      itemsRef.current = next;
      return next;
    });
    setTimeout(run, 0);
  }

  // Avisar al guardar o salir mientras aún se suben
  useEffect(() => {
    const form = box.current?.closest('form');
    const onSubmit = (e: Event) => {
      if (itemsRef.current.some((i) => i.status === 'cola' || i.status === 'subiendo' || i.status === 'procesando')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        setAviso('Espera a que terminen de subirse las fotos y vuelve a pulsar Guardar.');
        box.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };
    form?.addEventListener('submit', onSubmit, true);
    const onLeave = (e: BeforeUnloadEvent) => { if (itemsRef.current.some((i) => i.status !== 'ok' && i.status !== 'error')) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', onLeave);
    return () => { form?.removeEventListener('submit', onSubmit, true); window.removeEventListener('beforeunload', onLeave); };
  }, []);

  const done = items.filter((i) => i.status === 'ok' && i.src).map((i) => i.src!);
  const doneKey = done.join('|');
  useEffect(() => { onChange?.(done); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [doneKey]);

  return (
    <div ref={box} className={'pu' + (drag ? ' drag' : '') + (multiple ? '' : ' single')}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
      {done.map((src) => <input key={src} type="hidden" name={name} value={src} />)}
      <button type="button" className="pu-btn" onClick={() => input.current?.click()}>
        {label}
        {hint && <small>{hint}</small>}
      </button>
      <input ref={input} type="file" accept="image/*,.heic,.heif" multiple={multiple} hidden
        onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {aviso && <p className="pu-aviso">{aviso}</p>}
      {items.length > 0 && (
        <ul className="pu-list">
          {items.map((it) => (
            <li key={it.key} className={'pu-item ' + it.status}>
              <div className="pu-thumb">
                {it.src ? <img src={it.src} alt="" /> : it.preview ? <img src={it.preview} alt="" /> : <span>{(it.file.name.split('.').pop() || 'foto').toUpperCase()}</span>}
              </div>
              <div className="pu-body">
                <b title={it.file.name}>{it.file.name || 'foto'}</b>
                {it.status === 'cola' && <span>En cola…</span>}
                {it.status === 'subiendo' && <span>Subiendo {Math.round(it.p * 100)} %</span>}
                {it.status === 'procesando' && <span>{heavy(it.file) ? 'Convirtiendo HEIC y optimizando…' : 'Optimizando…'}</span>}
                {it.status === 'ok' && <span className="pu-ok">✓ Lista. Se guarda al pulsar Guardar.</span>}
                {it.status === 'error' && <span className="pu-err">{it.error}</span>}
                {(it.status === 'subiendo' || it.status === 'procesando') && <i className="pu-bar"><i style={{ width: `${Math.round(it.p * 100)}%` }} /></i>}
              </div>
              <div className="pu-acts">
                {it.status === 'error' && !/^No es una foto/.test(it.error || '') && <button type="button" className="btn-sm ghost" onClick={() => { const nx = itemsRef.current.map((i) => (i.key === it.key ? { ...i, status: 'cola' as const } : i)); itemsRef.current = nx; setItems(nx); setTimeout(run, 0); }}>Reintentar</button>}
                {(it.status === 'ok' || it.status === 'error') && <button type="button" className="pu-x" aria-label="Quitar" onClick={() => setItems((l) => { const nx = l.filter((i) => i.key !== it.key); itemsRef.current = nx; return nx; })}>×</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="adm-help">Subiendo… puedes seguir editando la ficha.</p>}
    </div>
  );
}
