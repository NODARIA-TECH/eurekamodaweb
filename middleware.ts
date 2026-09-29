import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Panel interno
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const ok = req.cookies.get('eureka_admin')?.value === '1';
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
