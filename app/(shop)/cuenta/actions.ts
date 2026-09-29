'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, registerCustomer } from '@/lib/store';
import { signSession, CUSTOMER_COOKIE } from '@/lib/auth';

const setSession = (customerId: string) =>
  cookies().set(CUSTOMER_COOKIE, signSession(customerId), {
    httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, // 30 días
  });

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const res = await authenticate(email, password);
  if (!res.ok) redirect('/cuenta/login?e=' + encodeURIComponent(res.error || 'Error'));
  setSession(res.customerId!);
  redirect('/cuenta');
}

export async function register(formData: FormData) {
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
