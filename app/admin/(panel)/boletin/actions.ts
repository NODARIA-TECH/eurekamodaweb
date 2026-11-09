'use server';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { sendMail } from '@/lib/mailer';
import { welcomeEmail, validEmail, normEmail, sendPending } from '@/lib/newsletter';
import { revalidatePath } from 'next/cache';
import { baseUrl } from '@/lib/base-url';

// Envía el email de bienvenida a una dirección, para comprobar que llega bien.
export async function sendTest(fd: FormData) {
  requireAdmin();
  const to = normEmail(String(fd.get('to') || ''));
  if (!validEmail(to)) redirect('/admin/boletin?prueba=mal');
  const m = welcomeEmail(baseUrl(), 'prueba');
  const r = await sendMail({ to, subject: '[Prueba] ' + m.subject, html: m.html, text: m.text });
  redirect('/admin/boletin?' + new URLSearchParams(r.ok ? { prueba: 'ok', a: to } : { prueba: 'error', e: r.error.slice(0, 300) }).toString());
}

// Manda el código a las suscriptoras que no lo recibieron.
export async function sendPendingAction() {
  requireAdmin();
  const r = await sendPending(baseUrl());
  revalidatePath('/admin/boletin');
  redirect('/admin/boletin?' + new URLSearchParams({ pend: '1', s: String(r.sent), f: String(r.failed), ...(r.lastError ? { e: r.lastError.slice(0, 300) } : {}) }).toString());
}
