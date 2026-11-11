// Autenticación simple para los endpoints de sincronización (servidor-a-servidor con n8n).
// n8n envía la cabecera X-Sync-Secret con el valor de EUREKA_SYNC_SECRET.
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export function checkSyncAuth(req: Request): NextResponse | null {
  const expected = process.env.EUREKA_SYNC_SECRET || '';
  const got = req.headers.get('x-sync-secret') || '';
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'EUREKA_SYNC_SECRET no configurado en el servidor.' }, { status: 500 });
  }
  const a = crypto.createHash('sha256').update(got).digest(), b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a as unknown as Uint8Array, b as unknown as Uint8Array)) {
    return NextResponse.json({ ok: false, error: 'No autorizado.' }, { status: 401 });
  }
  return null; // ok
}
