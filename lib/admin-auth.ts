// Sesión del panel: cookie firmada (HMAC-SHA256) con caducidad.
// Antes era eureka_admin=1, falsificable desde el navegador. Ahora: "<exp>.<firma>".
// El middleware verifica la firma (Web Crypto) y cada server action del panel llama a requireAdmin().
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const ADMIN_COOKIE = 'eureka_admin';
export const ADMIN_TTL_S = 60 * 60 * 12; // 12 h

function secret(): string {
  return process.env.EUREKA_AUTH_SECRET || 'eureka-dev-secret-cambiame';
}

export function signAdmin(): string {
  const exp = String(Math.floor(Date.now() / 1000) + ADMIN_TTL_S);
  const sig = crypto.createHmac('sha256', secret()).update('admin:' + exp).digest('hex');
  return `${exp}.${sig}`;
}

export function verifyAdminToken(token?: string): boolean {
  if (!token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  const expected = crypto.createHmac('sha256', secret()).update('admin:' + exp).digest('hex');
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig) as unknown as Uint8Array, Buffer.from(expected) as unknown as Uint8Array);
}

// Para server actions y páginas del panel: si no hay sesión válida, al login.
export function requireAdmin(): void {
  if (!verifyAdminToken(cookies().get(ADMIN_COOKIE)?.value)) redirect('/admin/login');
}
