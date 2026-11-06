'use server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE, ADMIN_TTL_S, signAdmin } from '@/lib/admin-auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export async function login(formData: FormData) {
  // Anti fuerza bruta: 8 intentos cada 15 min por IP.
  if (!rateLimit('admin-login:' + clientIp(), 8, 15 * 60 * 1000).ok) redirect('/admin/login?e=2');

  const pass = String(formData.get('password') || '');
  const expected = process.env.EUREKA_ADMIN_PASSWORD || 'eureka';
  const a = crypto.createHash('sha256').update(pass).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (crypto.timingSafeEqual(a as unknown as Uint8Array, b as unknown as Uint8Array)) {
    cookies().set(ADMIN_COOKIE, signAdmin(), {
      httpOnly: true, path: '/', sameSite: 'lax', maxAge: ADMIN_TTL_S,
      secure: process.env.NODE_ENV === 'production',
    });
    redirect('/admin');
  }
  redirect('/admin/login?e=1');
}

export async function logout() {
  cookies().delete(ADMIN_COOKIE);
  redirect('/admin/login');
}
