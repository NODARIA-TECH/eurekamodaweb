// Envío de emails por SMTP (sirve el correo de la tienda: Gmail con contraseña de aplicación,
// el correo del dominio, IONOS, Hostinger, Zoho…). Se configura en .env:
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=…  SMTP_PASS=…
//   MAIL_FROM="EUREKA <tucorreo@…>"   (opcional; por defecto, SMTP_USER)
import nodemailer, { type Transporter } from 'nodemailer';

let cached: Transporter | null = null;

export function mailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function mailFrom(): string {
  return process.env.MAIL_FROM || (process.env.SMTP_USER ? `EUREKA <${process.env.SMTP_USER}>` : '');
}

function transport(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT || 465);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return cached;
}

export type MailResult = { ok: true } | { ok: false; error: string };

export async function sendMail(opts: { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }): Promise<MailResult> {
  if (!mailConfigured()) return { ok: false, error: 'El envío de emails no está configurado (faltan los datos SMTP en .env).' };
  try {
    await transport().sendMail({
      from: mailFrom(),
      to: opts.to,
      replyTo: process.env.MAIL_REPLY_TO || undefined,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers: opts.headers,
    });
    return { ok: true };
  } catch (e: any) {
    console.error('[email] No se pudo enviar a', opts.to, '·', e?.message);
    cached = null; // por si cambió algo en la conexión: se rehace en el siguiente envío
    return { ok: false, error: e?.message || 'Error al enviar' };
  }
}
