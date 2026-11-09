// Subida de fotos del panel, por trozos (ver lib/chunked.ts).
//   POST /admin/api/fotos?id=<id>&i=<n.º de trozo>&n=<total>&name=<archivo>&uso=foto|lote
//   Cuerpo: los bytes del trozo.
// Con el último trozo: uso=foto → se convierte y optimiza y devuelve { src, width, height };
//                      uso=lote → se guarda entero para colocarlo después y devuelve { staged }.
import { NextResponse } from 'next/server';
import { adminGuard, noCache } from '@/lib/admin-api';
import { putChunk, assemble, stage, sweep, MAX_CHUNK } from '@/lib/chunked';
import { saveBufferDetailed } from '@/lib/uploads';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: noCache });

export async function POST(req: Request) {
  const deny = adminGuard(req, { write: true });
  if (deny) return deny;
  const u = new URL(req.url);
  const id = u.searchParams.get('id') || '';
  const i = Number(u.searchParams.get('i'));
  const n = Number(u.searchParams.get('n'));
  const name = (u.searchParams.get('name') || 'foto').slice(0, 200);
  const uso = u.searchParams.get('uso') === 'lote' ? 'lote' : 'foto';

  let data: Buffer;
  try { data = Buffer.from(await req.arrayBuffer()); } catch { return fail('No llegó el archivo completo. Revisa la conexión y vuelve a intentarlo.'); }
  if (data.length > MAX_CHUNK) return fail('Trozo demasiado grande.', 413);

  try {
    await putChunk(id, i, n, data);
    if (i < n - 1) return NextResponse.json({ ok: true, i }, { headers: noCache });
    const whole = await assemble(id, n);
    sweep().catch(() => undefined);
    if (uso === 'lote') {
      await stage(id, name, whole);
      return NextResponse.json({ staged: id, name, size: whole.length }, { headers: noCache });
    }
    const r = await saveBufferDetailed(whole);
    if (!r.ok) return fail(r.error, r.code === 'disco' ? 500 : 422);
    return NextResponse.json({ src: r.src, width: r.width, height: r.height, kind: r.kind, ms: r.ms }, { headers: noCache });
  } catch (e: any) {
    const msg = e?.code === 'ENOSPC' ? 'El servidor se ha quedado sin espacio en disco.'
      : e?.code === 'EACCES' || e?.code === 'EPERM' ? 'El servidor no tiene permiso para guardar en data/uploads.'
      : e?.message || 'Error al guardar la foto.';
    console.error('[fotos] Subida:', msg);
    return fail(msg, 500);
  }
}
