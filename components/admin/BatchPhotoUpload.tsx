'use client';
// Fotos en lote (sueltas o ZIP): se suben por trozos con su progreso y, al terminar, se colocan
// en sus productos según el nombre del archivo.
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadFile } from '@/lib/upload-client';

type Row = { name: string; size: number; p: number; status: 'cola' | 'subiendo' | 'ok' | 'error'; error?: string; id?: string };
const mb = (n: number) => (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';

export default function BatchPhotoUpload({ action }: { action: (ids: string[]) => Promise<string> }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<'elegir' | 'subiendo' | 'colocando' | 'fin'>('elegir');
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);

  function pick(list: FileList | null) {
    const fs = Array.from(list || []).filter((f) => f.size > 0);
    setFiles(fs);
    setRows(fs.map((f) => ({ name: f.name, size: f.size, p: 0, status: 'cola' })));
    setErr('');
    setPhase('elegir');
  }

  async function go() {
    if (!files.length) { setErr('Elige primero las fotos o el ZIP.'); return; }
    setPhase('subiendo'); setErr('');
    const ids: string[] = [];
    const cur = rows.map((r) => ({ ...r }));
    for (let i = 0; i < files.length; i++) {
      if (cur[i].status === 'ok' && cur[i].id) { ids.push(cur[i].id!); continue; }
      cur[i].status = 'subiendo'; setRows([...cur]);
      try {
        const r = await uploadFile(files[i], { uso: 'lote', onProgress: (p) => { cur[i].p = p; setRows([...cur]); } });
        if (!r.staged) throw new Error('El servidor no confirmó el archivo.');
        cur[i] = { ...cur[i], status: 'ok', p: 1, id: r.staged }; ids.push(r.staged);
      } catch (e: any) {
        cur[i] = { ...cur[i], status: 'error', error: e?.message || 'No se pudo subir.' };
      }
      setRows([...cur]);
    }
    if (!ids.length) { setPhase('elegir'); setErr('No se pudo subir ningún archivo. Revisa los avisos de cada uno.'); return; }
    setPhase('colocando');
    try {
      const url = await action(ids);
      setPhase('fin');
      router.push(url + '#fotos');
      router.refresh();
    } catch (e: any) {
      setPhase('elegir');
      setErr('Las fotos se subieron pero no se pudieron colocar: ' + (e?.message || 'error del servidor') + '. Pulsa otra vez "Subir y colocar".');
    }
  }

  const total = files.reduce((a, f) => a + f.size, 0);
  const sent = rows.reduce((a, r) => a + r.size * r.p, 0);
  const failed = rows.filter((r) => r.status === 'error').length;

  return (
    <div className={'bpu' + (drag ? ' drag' : '')}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (phase === 'elegir') pick(e.dataTransfer.files); }}>
      <div className="adm-form">
        <label style={{ gridColumn: '1 / -1' }}>Fotos o ZIP
          <button type="button" className="pu-btn" onClick={() => input.current?.click()} disabled={phase !== 'elegir'}>
            {files.length ? `${files.length} archivo(s) · ${mb(total)} — cambiar` : 'Elegir fotos o ZIP (o arrastrarlos aquí)'}
            <small>JPG, PNG, HEIC/HEIF de InShot o iPhone, WebP… y ZIP con fotos dentro</small>
          </button>
          <input ref={input} type="file" multiple hidden accept="image/*,.heic,.heif,.zip,application/zip" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
        </label>
        <button className="btn-sm gold" type="button" style={{ height: 40 }} onClick={go} disabled={phase !== 'elegir' || !files.length}>
          {phase === 'subiendo' ? `Subiendo ${total ? Math.round((sent / total) * 100) : 0} %…` : phase === 'colocando' ? 'Colocando fotos… (HEIC tarda un poco)' : phase === 'fin' ? 'Hecho ✓' : failed ? 'Reintentar las que fallaron y colocar' : 'Subir y colocar'}
        </button>
      </div>
      {err && <p className="pu-err" style={{ marginTop: 8 }}>{err}</p>}
      {rows.length > 0 && rows.length <= 60 && (
        <ul className="pu-list bpu-list">
          {rows.map((r, i) => (
            <li key={i} className={'pu-item ' + r.status}>
              <div className="pu-body">
                <b title={r.name}>{r.name}</b>
                <span className={r.status === 'error' ? 'pu-err' : r.status === 'ok' ? 'pu-ok' : ''}>
                  {r.status === 'cola' ? mb(r.size) : r.status === 'subiendo' ? `Subiendo ${Math.round(r.p * 100)} %` : r.status === 'ok' ? '✓ Subido' : r.error}
                </span>
                {r.status === 'subiendo' && <i className="pu-bar"><i style={{ width: `${Math.round(r.p * 100)}%` }} /></i>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 60 && <p className="adm-help">{rows.filter((r) => r.status === 'ok').length} de {rows.length} subidos{failed ? ` · ${failed} con error` : ''}.</p>}
    </div>
  );
}
