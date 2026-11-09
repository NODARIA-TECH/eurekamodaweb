import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Verifica la cookie firmada del panel ("<exp>.<hmac>") con Web Crypto (runtime Edge).
async function validAdmin(token?: string): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  const secret = process.env.EUREKA_AUTH_SECRET || 'eureka-dev-secret-cambiame';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode('admin:' + exp)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Panel interno
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const ok = await validAdmin(req.cookies.get('eureka_admin')?.value);
    if (!ok && pathname.startsWith('/admin/api/')) {
      // Las llamadas del editor reciben un 401 (no la página de login) para avisar de "sesión caducada".
      return NextResponse.json({ error: 'La sesión ha caducado. Vuelve a entrar en el panel.' }, { status: 401 });
    }
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  // Área de cliente (login/registro son públicos).
  // Aquí sólo se comprueba la presencia de la cookie; la firma HMAC se
  // verifica en el servidor (app/(shop)/cuenta/page.tsx).
  if (pathname === '/cuenta' || pathname.startsWith('/cuenta/')) {
    const isPublic = pathname.startsWith('/cuenta/login') || pathname.startsWith('/cuenta/registro');
    if (!isPublic && !req.cookies.get('eureka_customer')?.value) {
      const url = req.nextUrl.clone();
      url.pathname = '/cuenta/login';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/cuenta', '/cuenta/:path*'] };
