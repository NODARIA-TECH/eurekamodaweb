// API del editor de la portada. GET: estado actual. POST: guardar borrador / publicar / descartar / restaurar.
import { NextResponse } from 'next/server';
import { adminGuard, noCache } from '@/lib/admin-api';
import { getEditorState, saveDraft, publishDraft, discardDraft, restoreVersion } from '@/lib/site-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const deny = adminGuard(req);
  if (deny) return deny;
  return NextResponse.json(await getEditorState(), { headers: noCache });
}

export async function POST(req: Request) {
  const deny = adminGuard(req, { write: true });
  if (deny) return deny;
  if (!(req.headers.get('content-type') || '').includes('application/json')) {
    return NextResponse.json({ error: 'Formato no válido.' }, { status: 415 });
  }
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Datos no válidos.' }, { status: 400 }); }
  const rev = Number(body?.rev);
  if (!Number.isInteger(rev)) return NextResponse.json({ error: 'Falta la revisión.' }, { status: 400 });

  try {
    let r;
    switch (body.action) {
      case 'save': r = await saveDraft(body.content, rev); break;
      case 'publish': r = await publishDraft(rev); break;
      case 'discard': r = await discardDraft(rev); break;
      case 'restore': r = await restoreVersion(String(body.id || ''), rev); break;
      default: return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
    }
    if ('notFound' in r) return NextResponse.json({ error: 'Esa versión ya no existe.' }, { status: 404 });
    if (!r.ok) return NextResponse.json({ conflict: true, state: r.state }, { status: 409, headers: noCache });
    return NextResponse.json({ ok: true, state: r.state }, { headers: noCache });
  } catch (e: any) {
    console.error('[site] Error al guardar:', e);
    return NextResponse.json({ error: 'No se pudo guardar en el servidor. Se reintentará.' }, { status: 500 });
  }
}
