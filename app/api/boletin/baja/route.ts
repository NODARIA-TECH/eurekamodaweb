// Baja del boletín por POST:
//  · "un clic" desde Gmail/Outlook (cabecera List-Unsubscribe-Post, RFC 8058)
//  · el botón "Darme de baja" de /boletin/baja
// La página /boletin/baja (GET) solo pregunta: así los antivirus del correo, que abren los enlaces,
// no dan de baja a nadie sin querer.
import { NextResponse } from 'next/server';
import { unsubscribe } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const u = new URL(req.url);
  let t = u.searchParams.get('t') || '';
  const ct = req.headers.get('content-type') || '';
  let fromForm = false;
  if (ct.includes('form')) {
    try { const fd = await req.formData(); t = String(fd.get('t') || t); fromForm = fd.get('desde') === 'web'; } catch { /* */ }
  }
  const s = await unsubscribe(t);
  if (fromForm) return NextResponse.redirect(new URL(`/boletin/baja?hecho=${s ? 1 : 0}`, u.origin), 303);
  return new NextResponse(s ? 'Baja confirmada' : 'Enlace no válido', { status: s ? 200 : 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
