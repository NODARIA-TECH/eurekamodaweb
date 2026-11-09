'use client';
import { useRef, useState } from 'react';
import { uploadFile } from '@/lib/upload-client';

type R = { name: string; size: number; ok: boolean; msg: string; src?: string; ms: number };

export default function PhotoTest() {
  const input = useRef<HTMLInputElement>(null);
  const [res, setRes] = useState<R[]>([]);
  const [busy, setBusy] = useState('');

  async function test(list: FileList | null) {
    for (const f of Array.from(list || [])) {
      const t0 = performance.now();
      setBusy(`Probando ${f.name}…`);
      try {
        const r: any = await uploadFile(f, { onProgress: (p, ph) => setBusy(`${f.name}: ${ph === 'procesando' ? 'convirtiendo y optimizando' : `subiendo ${Math.round(p * 100)} %`}…`) });
        setRes((x) => [{ name: f.name, size: f.size, ok: true, src: r.src, ms: performance.now() - t0, msg: `Guardada como ${r.width}×${r.height} px (formato original: ${String(r.kind || '').toUpperCase()}, el servidor tardó ${((r.ms || 0) / 1000).toFixed(1)} s)` }, ...x]);
      } catch (e: any) {
        setRes((x) => [{ name: f.name, size: f.size, ok: false, ms: performance.now() - t0, msg: e?.message || 'Error' }, ...x]);
      }
    }
    setBusy('');
  }

  return (
    <div>
      <button type="button" className="pu-btn" onClick={() => input.current?.click()} disabled={!!busy}>
        {busy || 'Elegir foto(s) de prueba'}
        <small>JPG, PNG, HEIC/HEIF, WebP…</small>
      </button>
      <input ref={input} type="file" multiple hidden accept="image/*,.heic,.heif" onChange={(e) => { test(e.target.files); e.target.value = ''; }} />
      {res.length > 0 && (
        <ul className="pu-list" style={{ marginTop: 10 }}>
          {res.map((r, i) => (
            <li key={i} className={'pu-item ' + (r.ok ? 'ok' : 'error')}>
              <div className="pu-thumb">{r.src ? <img src={r.src} alt="" /> : <span>✕</span>}</div>
              <div className="pu-body">
                <b>{r.name} · {(r.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB · {(r.ms / 1000).toFixed(1)} s en total</b>
                <span className={r.ok ? 'pu-ok' : 'pu-err'}>{r.ok ? '✓ ' : ''}{r.msg}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
