// Boletín (Club EUREKA): suscriptoras en data/boletin.json y email de bienvenida con el código.
import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import { sendMail, type MailResult } from './mailer';

const FILE = path.join(process.cwd(), 'data', 'boletin.json');

export interface Subscriber {
  email: string;
  token: string;               // para el enlace de baja
  createdAt: string;
  status: 'activa' | 'baja';
  sentAt?: string;             // último email de bienvenida enviado
  sends?: number;
  lastError?: string;
  bajaAt?: string;
}

export const welcomeCode = () => (process.env.NEWSLETTER_CODE || 'BIENVENIDA20').trim();
export const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^@\s"'<>]+@[^@\s"'<>]+\.[a-z]{2,}$/i.test(e) && e.length <= 160;

async function load(): Promise<Subscriber[]> {
  try { const j = JSON.parse(await fs.readFile(FILE, 'utf8')); return Array.isArray(j.subscribers) ? j.subscribers : []; }
  catch (e: any) { if (e?.code !== 'ENOENT') console.error('[boletín] No se pudo leer boletin.json:', e?.message); return []; }
}
async function save(list: Subscriber[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify({ subscribers: list }, null, 1) + '\n', 'utf8');
  await fs.rename(tmp, FILE);
}
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function listSubscribers(): Promise<Subscriber[]> {
  return (await load()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---------- Email ----------
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function welcomeEmail(base: string, token: string) {
  const code = welcomeCode();
  const shop = `${base}/tienda`;
  const baja = `${base}/boletin/baja?t=${encodeURIComponent(token)}`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bienvenida al Club EUREKA</title></head>
<body style="margin:0;padding:0;background:#F4EEE3;font-family:Helvetica,Arial,sans-serif;color:#2A2018">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EEE3;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF8;border-radius:18px;overflow:hidden;border:1px solid #E7DCC8">
<tr><td align="center" style="padding:34px 28px 10px"><img src="${esc(base)}/eureka-logo.png" width="170" alt="EUREKA" style="display:block;width:170px;max-width:60%;height:auto;border:0"></td></tr>
<tr><td align="center" style="padding:6px 32px 0">
<p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#A8873F">Club EUREKA</p>
<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:30px;line-height:1.2;color:#2A2018">¡Bienvenida!</h1>
<p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#5B4E3F">Gracias por unirte. Aquí tienes tu regalo: un <b>20&nbsp;% de descuento</b> en tu primera compra online.</p>
</td></tr>
<tr><td align="center" style="padding:24px 32px 6px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="border:2px dashed #C2A053;border-radius:14px;padding:16px 30px;background:#FBF6EC">
<p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8C7650">Tu código</p>
<p style="margin:0;font-size:28px;letter-spacing:4px;font-weight:bold;color:#2A2018">${esc(code)}</p>
</td></tr></table>
<p style="margin:12px 0 0;font-size:13px;color:#8C7650">Escríbelo en el campo de código al pagar.</p>
</td></tr>
<tr><td align="center" style="padding:22px 32px 30px">
<a href="${esc(shop)}" style="display:inline-block;background:#2A2018;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;padding:14px 30px;border-radius:999px">Descubrir la colección</a>
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#5B4E3F">Además, serás de las primeras en enterarte de las novedades y rebajas.</p>
</td></tr>
<tr><td style="padding:18px 28px;background:#F7F1E6;border-top:1px solid #EFE5D4" align="center">
<p style="margin:0;font-size:12px;line-height:1.6;color:#8C7E6A">EUREKA · Moda de mujer · Écija<br>
<a href="${esc(base)}" style="color:#8C7650">eurekamoda.com</a> · 654 382 023</p>
<p style="margin:8px 0 0;font-size:11px;color:#A0937F">Recibes este correo porque te has suscrito en eurekamoda.com. <a href="${esc(baja)}" style="color:#A0937F">Darme de baja</a></p>
</td></tr>
</table></td></tr></table></body></html>`;
  const text = `¡Bienvenida al Club EUREKA!\n\nTu código de descuento: ${code}\n20 % en tu primera compra online. Escríbelo al pagar.\n\nDescubre la colección: ${shop}\n\nEUREKA · eurekamoda.com · 654 382 023\nDarte de baja: ${baja}\n`;
  return { subject: `Tu 20 % de bienvenida: ${code}`, html, text, baja };
}

// ---------- Alta ----------
export type SubscribeResult = { ok: true; code: string; sent: boolean; already: boolean; mailError?: string } | { ok: false; error: string };

export async function subscribe(rawEmail: string, base: string): Promise<SubscribeResult> {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) return { ok: false, error: 'Introduce un correo válido.' };

  // 1) Guardar (o reactivar) la suscripción
  const { sub, already, sendNow } = await exclusive(async () => {
    const list = await load();
    let s = list.find((x) => x.email === email);
    const already = !!s && s.status === 'activa';
    if (!s) {
      s = { email, token: randomBytes(18).toString('base64url'), createdAt: new Date().toISOString(), status: 'activa', sends: 0 };
      list.push(s);
    } else if (s.status === 'baja') { s.status = 'activa'; delete s.bajaAt; }
    // No reenviar más de una vez cada 10 minutos al mismo correo
    const sendNow = !s.sentAt || Date.now() - Date.parse(s.sentAt) > 10 * 60 * 1000;
    await save(list);
    return { sub: { ...s }, already, sendNow };
  });

  // 2) Enviar el email de bienvenida con el código
  let mail: MailResult = { ok: false, error: 'reciente' };
  if (sendNow) {
    const m = welcomeEmail(base, sub.token);
    const job = sendMail({ to: email, subject: m.subject, html: m.html, text: m.text, headers: { 'List-Unsubscribe': `<${m.baja}>` } })
      .then(async (r) => {
        await exclusive(async () => {
          const list = await load();
          const s = list.find((x) => x.email === email);
          if (!s) return;
          if (r.ok) { s.sentAt = new Date().toISOString(); s.sends = (s.sends || 0) + 1; delete s.lastError; }
          else s.lastError = (r as { error: string }).error;
          await save(list);
        });
        return r;
      });
    // La clienta no espera más de 5 s: si el correo va lento, se termina de enviar por detrás.
    mail = await Promise.race([job, new Promise<MailResult>((ok) => setTimeout(() => ok({ ok: false, error: 'enviando' }), 5000))]);
    if (!mail.ok && (mail as { error: string }).error === 'enviando') return { ok: true, code: welcomeCode(), sent: false, already };   // el código se ve en pantalla igualmente
  }
  return { ok: true, code: welcomeCode(), sent: mail.ok || (!sendNow && !!sub.sentAt), already, mailError: mail.ok ? undefined : (mail as { error: string }).error };
}

// Envía el código a las suscriptoras activas que todavía no lo recibieron (p. ej. las que se
// apuntaron antes de configurar el email). De una en una, sin repetir a quien ya lo tiene.
export async function sendPending(base: string): Promise<{ sent: number; failed: number; lastError?: string }> {
  const pend = (await load()).filter((s) => s.status === 'activa' && !s.sentAt);
  let sent = 0, failed = 0, lastError: string | undefined;
  for (const p of pend.slice(0, 200)) {
    const m = welcomeEmail(base, p.token);
    const mail = await sendMail({ to: p.email, subject: m.subject, html: m.html, text: m.text, headers: { 'List-Unsubscribe': `<${m.baja}>` } });
    await exclusive(async () => {
      const list = await load();
      const s = list.find((x) => x.email === p.email);
      if (!s) return;
      if (mail.ok) { s.sentAt = new Date().toISOString(); s.sends = (s.sends || 0) + 1; delete s.lastError; }
      else s.lastError = (mail as { error: string }).error;
      await save(list);
    });
    if (mail.ok) sent++; else { failed++; lastError = (mail as { error: string }).error; if (failed >= 3 && !sent) break; }   // si falla la configuración, no insistir
  }
  return { sent, failed, lastError };
}

export async function unsubscribe(token: string): Promise<Subscriber | null> {
  if (!token) return null;
  return exclusive(async () => {
    const list = await load();
    const s = list.find((x) => x.token === token);
    if (!s) return null;
    if (s.status !== 'baja') { s.status = 'baja'; s.bajaAt = new Date().toISOString(); await save(list); }
    return s;
  });
}
