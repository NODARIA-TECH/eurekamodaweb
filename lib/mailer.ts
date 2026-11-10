// Envío de emails. Tres formas, según lo que haya en .env (se usa la primera que esté):
//
//  1) RESEND_API_KEY=re_…          → Resend (API por HTTPS)        ← recomendado en DigitalOcean
//  2) BREVO_API_KEY=xkeysib-…      → Brevo (API por HTTPS)
//  3) SMTP_HOST / SMTP_USER / SMTP_PASS (+ SMTP_PORT) → SMTP: Amazon SES (puerto 2587, sin límite
//     práctico y muy barato), Gmail, correo del dominio…
//
// OJO: DigitalOcean bloquea en sus servidores los puertos SMTP 25, 465 y 587, así que por SMTP
// el envío se queda colgado hasta que caduca. Las opciones 1 y 2 van por HTTPS (puerto 443) y
// no les afecta. Por SMTP solo funciona con un puerto distinto: Amazon SES admite el 2587 (STARTTLS)
// y el 2465 (TLS, con SMTP_SECURE=true).
//   Amazon SES:  SMTP_HOST=email-smtp.eu-west-1.amazonaws.com  SMTP_PORT=2587
//                SMTP_USER / SMTP_PASS = credenciales SMTP que da SES (no las de la cuenta de AWS)
//
//   MAIL_FROM="EUREKA <hola@eurekamoda.com>"   remitente (en Resend/Brevo, de un dominio verificado)
//   MAIL_REPLY_TO=…                            opcional: a dónde van las respuestas
import nodemailer, { type Transporter } from 'nodemailer';

export type MailProvider = 'resend' | 'brevo' | 'smtp' | null;
export type MailResult = { ok: true; id?: string } | { ok: false; error: string };

const env = (k: string) => (process.env[k] || '').trim();

export function mailProvider(): MailProvider {
  if (env('RESEND_API_KEY')) return 'resend';
  if (env('BREVO_API_KEY')) return 'brevo';
  if (env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS')) return 'smtp';
  return null;
}
export const mailConfigured = () => mailProvider() !== null;
export const providerName = (p = mailProvider()) => (p === 'resend' ? 'Resend' : p === 'brevo' ? 'Brevo' : p === 'smtp' ? `SMTP (${env('SMTP_HOST')}:${smtpPort()})` : 'sin configurar');

export function mailFrom(): string {
  return env('MAIL_FROM') || (env('SMTP_USER') ? `EUREKA <${env('SMTP_USER')}>` : '');
}
function parseFrom(s: string): { name?: string; email: string } {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s);
  return m ? { name: m[1].trim() || undefined, email: m[2].trim() } : { email: s.trim() };
}

type Msg = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };

// ---------- SMTP ----------
let cached: Transporter | null = null;
const smtpPort = () => Number(env('SMTP_PORT') || 465);
function transport(): Transporter {
  if (cached) return cached;
  const port = smtpPort();
  cached = nodemailer.createTransport({
    host: env('SMTP_HOST'),
    port,
    secure: env('SMTP_SECURE') ? env('SMTP_SECURE') === 'true' : port === 465,
    auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return cached;
}
function smtpError(e: any): string {
  const code = e?.code || '';
  const msg = String(e?.message || '');
  if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ESOCKET' && /timeout/i.test(msg) || /Connection timeout|Greeting never received/i.test(msg))
    return `No hay conexión con ${env('SMTP_HOST')}:${smtpPort()}. DigitalOcean bloquea los puertos SMTP (25, 465 y 587): usa un puerto no bloqueado (Amazon SES: SMTP_PORT=2587) o Resend/Brevo por API.`;
  if (code === 'EAUTH' || /535|Invalid login|Username and Password not accepted/i.test(msg))
    return 'El servidor de correo rechaza el usuario o la contraseña (SMTP_USER / SMTP_PASS). En Amazon SES son las "credenciales SMTP" que se crean en SES (no el usuario de AWS); en Gmail, una "contraseña de aplicación".';
  if (/not verified|identities failed the check/i.test(msg))
    return 'Amazon SES rechaza el envío: o el remitente (MAIL_FROM) no está verificado —verifica el dominio eurekamoda.com en SES— o la cuenta sigue en modo de pruebas (sandbox), que solo deja enviar a direcciones verificadas: pide el "acceso de producción". (' + msg + ')';
  if (/Daily message quota exceeded|Maximum sending rate exceeded|Throttling/i.test(msg)) return 'Se ha llegado al límite de envíos del proveedor por ahora; el código se puede reenviar más tarde desde el panel. (' + msg + ')';
  if (code === 'EENVELOPE' || /sender|from address/i.test(msg)) return 'El remitente (MAIL_FROM) no está permitido en ese correo: usa la misma dirección que SMTP_USER. ' + msg;
  if (code === 'EDNS' || code === 'ENOTFOUND') return `No existe el servidor de correo ${env('SMTP_HOST')}: revisa SMTP_HOST.`;
  return msg || 'Error al enviar';
}
async function sendSmtp(m: Msg): Promise<MailResult> {
  try {
    const info = await transport().sendMail({ from: mailFrom(), to: m.to, replyTo: env('MAIL_REPLY_TO') || undefined, subject: m.subject, html: m.html, text: m.text, headers: m.headers });
    return { ok: true, id: info.messageId };
  } catch (e: any) {
    cached = null; // se rehace la conexión en el siguiente envío
    return { ok: false, error: smtpError(e) };
  }
}

// ---------- APIs por HTTPS ----------
async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    let j: any = null;
    try { j = await r.json(); } catch { /* sin cuerpo */ }
    return { status: r.status, ok: r.ok, j };
  } finally { clearTimeout(t); }
}
function apiError(provider: string, status: number, j: any): string {
  const msg = String(j?.message || j?.error || j?.code || '');
  if (status === 401 || /api key is invalid|unauthorized|key not found/i.test(msg)) return `${provider} rechaza la clave (API key): revisa que esté bien copiada en .env.`;
  if (status === 403 || /domain is not verified|not verified|sender.*(invalid|not valid)/i.test(msg))
    return `${provider} no deja enviar desde ${parseFrom(mailFrom()).email || 'ese remitente'}: verifica el dominio (o el remitente) en ${provider} y usa esa dirección en MAIL_FROM. (${msg})`;
  if (status === 422 || status === 400) return `${provider}: datos no válidos (${msg || status}). Revisa MAIL_FROM.`;
  if (status === 429) return `${provider}: límite de envíos alcanzado por ahora; se puede reenviar más tarde.`;
  return `${provider} respondió ${status}${msg ? ': ' + msg : ''}.`;
}
async function sendResend(m: Msg): Promise<MailResult> {
  const url = (env('RESEND_API_URL') || 'https://api.resend.com') + '/emails';
  try {
    const r = await postJson(url, { Authorization: 'Bearer ' + env('RESEND_API_KEY') }, {
      from: mailFrom(), to: [m.to], subject: m.subject, html: m.html, text: m.text,
      reply_to: env('MAIL_REPLY_TO') || undefined, headers: m.headers,
    });
    return r.ok ? { ok: true, id: r.j?.id } : { ok: false, error: apiError('Resend', r.status, r.j) };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'Resend no respondió a tiempo.' : 'No hay conexión con Resend: ' + (e?.cause?.code || e?.message) };
  }
}
async function sendBrevo(m: Msg): Promise<MailResult> {
  const url = (env('BREVO_API_URL') || 'https://api.brevo.com') + '/v3/smtp/email';
  const from = parseFrom(mailFrom());
  try {
    const r = await postJson(url, { 'api-key': env('BREVO_API_KEY') }, {
      sender: { name: from.name || 'EUREKA', email: from.email }, to: [{ email: m.to }], subject: m.subject,
      htmlContent: m.html, textContent: m.text, replyTo: env('MAIL_REPLY_TO') ? { email: env('MAIL_REPLY_TO') } : undefined, headers: m.headers,
    });
    return r.ok ? { ok: true, id: r.j?.messageId } : { ok: false, error: apiError('Brevo', r.status, r.j) };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'Brevo no respondió a tiempo.' : 'No hay conexión con Brevo: ' + (e?.cause?.code || e?.message) };
  }
}

export async function sendMail(opts: Msg): Promise<MailResult> {
  const p = mailProvider();
  if (!p) return { ok: false, error: 'El envío de emails no está configurado: falta RESEND_API_KEY (o BREVO_API_KEY, o los datos SMTP) en el .env del servidor.' };
  if (!mailFrom()) return { ok: false, error: 'Falta MAIL_FROM en .env (p. ej. MAIL_FROM="EUREKA <hola@eurekamoda.com>").' };
  const r = p === 'resend' ? await sendResend(opts) : p === 'brevo' ? await sendBrevo(opts) : await sendSmtp(opts);
  if (!r.ok) console.error('[email]', providerName(p), '→', opts.to, '·', r.error);
  return r;
}

// Comprobación rápida (Panel → Diagnóstico / Boletín): ¿se llega al servidor de correo?
export async function checkMail(): Promise<{ ok: boolean; detail: string }> {
  const p = mailProvider();
  if (!p) return { ok: false, detail: 'Sin configurar' };
  if (!mailFrom()) return { ok: false, detail: 'Falta MAIL_FROM' };
  if (p !== 'smtp') return { ok: true, detail: `${providerName(p)} · remitente ${mailFrom()}` };
  try {
    await Promise.race([transport().verify(), new Promise((_, ko) => setTimeout(() => ko(Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' })), 8000))]);
    return { ok: true, detail: `${providerName(p)} · conexión y contraseña correctas · remitente ${mailFrom()}` };
  } catch (e: any) {
    cached = null;
    return { ok: false, detail: smtpError(e) };
  }
}
