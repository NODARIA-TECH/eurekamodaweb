'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, registerCustomer } from '@/lib/store';
import { signSession, CUSTOMER_COOKIE } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const setSession = (customerId: string) =>
  cookies().set(CUSTOMER_COOKIE, signSession(customerId), {
    httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, // 30 días
  });

export async function login(formData: FormData) {
  const ip = clientIp();
  if (!rateLimit('login:' + ip, 10, 15 * 60 * 1000).ok) {
    redirect('/cuenta/login?e=' + encodeURIComponent('Demasiados intentos. Espera unos minutos.'));
  }
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const res = await authenticate(email, password);
  if (!res.ok) redirect('/cuenta/login?e=' + encodeURIComponent(res.error || 'Error'));
  setSession(res.customerId!);
  redirect('/cuenta');
}

export async function register(formData: FormData) {
  const ip = clientIp();
  // Antiabuso: máximo 3 registros por IP cada 6 h (evita farmear cuentas para el descuento).
  if (!rateLimit('register:' + ip, 3, 6 * 60 * 60 * 1000).ok) {
    redirect('/cuenta/registro?e=' + encodeURIComponent('Demasiados registros desde tu conexión. Inténtalo más tarde.'));
  }
  const name = String(formData.get('name') || '');
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const res = await registerCustomer({ name, email, password });
  if (!res.ok) redirect('/cuenta/registro?e=' + encodeURIComponent(res.error || 'Error'));
  setSession(res.customerId!);
  redirect('/cuenta');
}

export async function logout() {
  cookies().delete(CUSTOMER_COOKIE);
  redirect('/cuenta/login');
}
