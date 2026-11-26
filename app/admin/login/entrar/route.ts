// Entrada al panel con un formulario normal (POST + redirección): así el navegador del móvil o
// del ordenador reconoce el inicio de sesión y ofrece GUARDAR la contraseña (y luego la rellena sola).
import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_TTL_S, signAdmin } from '@/lib/admin-auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const ir = (to: string) => new NextResponse(null, { status: 303, headers: { Location: to } });

export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  const next = String(fd?.get('next') || '');
  const valido = /^\/admin(\/[\w\-/]*)?$/.test(next) && !next.startsWith('/admin/login');
  const volver = (e: string) => ir(`/admin/login?e=${e}${valido ? '&next=' + encodeURIComponent(next) : ''}`);
  if (!rateLimit('admin-login:' + clientIp(), 8, 15 * 60 * 1000).ok) return volver('2');
  const pass = String(fd?.get('password') || '');
  const expected = process.env.EUREKA_ADMIN_PASSWORD || 'eureka';
  const a = crypto.createHash('sha256').update(pass).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!crypto.timingSafeEqual(a as unknown as Uint8Array, b as unknown as Uint8Array)) return volver('1');
  // Volver a donde iba (solo rutas del panel)
  const res = ir(valido ? next : '/admin');
  res.cookies.set(ADMIN_COOKIE, signAdmin(), { httpOnly: true, path: '/', sameSite: 'lax', maxAge: ADMIN_TTL_S, secure: process.env.NODE_ENV === 'production' });
  return res;
}
