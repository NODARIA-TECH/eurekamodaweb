'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const pass = String(formData.get('password') || '');
  const expected = process.env.EUREKA_ADMIN_PASSWORD || 'eureka';
  if (pass === expected) {
    cookies().set('eureka_admin', '1', { httpOnly: true, path: '/', sameSite: 'lax', maxAge: 60 * 60 * 8 });
    redirect('/admin');
  }
  redirect('/admin/login?e=1');
}

export async function logout() {
  cookies().delete('eureka_admin');
  redirect('/admin/login');
}
