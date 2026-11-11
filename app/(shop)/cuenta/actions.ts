'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticate, registerCustomer, confirmClaim } from '@/lib/store';
import { sendMail, mailConfigured } from '@/lib/mailer';
import { baseUrl } from '@/lib/base-url';
import { TITULAR } from '@/lib/legal';
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
  if (res.verify) {
    // Ya compró como invitada: confirmamos por email que el correo es suyo
    if (!mailConfigured()) redirect('/cuenta/registro?e=' + encodeURIComponent(`Ya hay pedidos con este correo. Escríbenos a ${TITULAR.email} y activamos tu cuenta.`));
    const link = `${baseUrl()}/cuenta/registro?activar=${res.verify.token}`;
    const r = await sendMail({
      to: res.verify.email,
      subject: 'Activa tu cuenta de EUREKA',
      text: `Hola ${res.verify.name}:\n\nPara activar tu cuenta de EUREKA y ver tus pedidos, abre este enlace (caduca en 24 horas):\n${link}\n\nSi no has sido tú, ignora este correo: no se cambiará nada.\n\nEUREKA · eurekamoda.com`,
      html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#2A2018;max-width:520px;margin:0 auto;padding:24px"><h1 style="font-family:Georgia,serif;font-weight:normal;font-size:24px">Activa tu cuenta</h1><p style="font-size:15px;line-height:1.6">Hola ${res.verify.name.replace(/[<>&"]/g, '')}: para activar tu cuenta de EUREKA y ver tus pedidos, pulsa el botón (caduca en 24 horas).</p><p style="margin:24px 0"><a href="${link}" style="background:#2A2018;color:#fff;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold;font-size:14px">Activar mi cuenta</a></p><p style="font-size:13px;color:#5B4E3F">Si no has sido tú, ignora este correo: no se cambiará nada.</p></div>`,
    });
    if (!r.ok) redirect('/cuenta/registro?e=' + encodeURIComponent('No pudimos enviarte el email de activación. Inténtalo de nuevo en unos minutos.'));
    redirect('/cuenta/registro?enviado=1');
  }
  if (!res.ok) redirect('/cuenta/registro?e=' + encodeURIComponent(res.error || 'Error'));
  setSession(res.customerId!);
  redirect('/cuenta');
}

export async function activate(formData: FormData) {
  const res = await confirmClaim(String(formData.get('t') || ''));
  if (!res.ok) redirect('/cuenta/registro?e=' + encodeURIComponent(res.error || 'Enlace no válido.'));
  setSession(res.customerId!);
  redirect('/cuenta');
}

export async function logout() {
  cookies().delete(CUSTOMER_COOKIE);
  redirect('/cuenta/login');
}
