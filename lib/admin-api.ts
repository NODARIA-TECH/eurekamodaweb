// Comprobaciones comunes de las rutas /admin/api/*: sesión de administradora y mismo origen.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, verifyAdminToken } from './admin-auth';

export function adminGuard(req: Request, { write = false } = {}): NextResponse | null {
  if (!verifyAdminToken(cookies().get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: 'La sesión ha caducado. Vuelve a entrar en el panel.' }, { status: 401 });
  }
  if (write) {
    // Protección CSRF: las escrituras solo se aceptan desde la propia web.
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: 'Origen no permitido.' }, { status: 403 });
    }
  }
  return null;
}

export const noCache = { 'Cache-Control': 'no-store' };
