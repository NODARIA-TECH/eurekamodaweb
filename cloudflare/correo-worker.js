// EUREKA · Relé de correo en Cloudflare Workers
// ------------------------------------------------------------------------------------------
// DigitalOcean no deja que el VPS se conecte a ningún servidor de correo (bloquea 25, 465 y 587).
// Este Worker hace de puente: la web le pasa el email por HTTPS y él lo entrega al buzón de la
// tienda en IONOS (smtp.ionos.es:465, con usuario y contraseña), igual que lo haría Outlook.
// El correo sale de hola@eurekamoda.com, con el SPF/DKIM de IONOS. No interviene ningún
// servicio de envío externo: Cloudflare ya es el DNS del dominio y el plan gratuito sobra.
//
// Variables del Worker (Settings → Variables and Secrets):
//   SMTP_USER   = hola@eurekamoda.com                       (texto)
//   SMTP_PASS   = contraseña del buzón                       (secreto)
//   RELAY_TOKEN = clave larga inventada, la misma que MAIL_RELAY_TOKEN del .env   (secreto)
//   MAIL_FROM   = EUREKA <hola@eurekamoda.com>               (texto, opcional)
//   SMTP_HOST   = smtp.ionos.es  ·  SMTP_PORT = 465          (opcionales; 587 = STARTTLS)
//
// Uso (lo hace la web sola):
//   POST /   Authorization: Bearer <RELAY_TOKEN>   {to, subject, html, text, replyTo?, headers?}
//   GET  /   Authorization: Bearer <RELAY_TOKEN>   → prueba la conexión y la contraseña con IONOS
import { connect } from 'cloudflare:sockets';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const EMAIL = /^[^@\s"'<>,;]+@[^@\s"'<>,;]+\.[a-z]{2,}$/i;

export default {
  async fetch(req, env) {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!env.RELAY_TOKEN || env.RELAY_TOKEN.length < 24) return json({ ok: false, error: 'Falta RELAY_TOKEN en el Worker (mínimo 24 caracteres).' }, 500);
    if (!safeEqual(token, env.RELAY_TOKEN)) return json({ ok: false, error: 'Clave del relé incorrecta (MAIL_RELAY_TOKEN).' }, 401);
    if (!env.SMTP_USER || !env.SMTP_PASS) return json({ ok: false, error: 'Faltan SMTP_USER / SMTP_PASS en el Worker.' }, 500);

    const cfg = {
      host: env.SMTP_HOST || 'smtp.ionos.es',
      port: Number(env.SMTP_PORT || 465),
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.MAIL_FROM || `EUREKA <${env.SMTP_USER}>`,
      plain: env.TEST_PLAIN === '1',             // solo para pruebas locales
    };

    if (req.method === 'GET') {
      try { await smtp(cfg, null); return json({ ok: true, detail: `Conexión con ${cfg.host}:${cfg.port} y contraseña correctas` }); }
      catch (e) { return json({ ok: false, error: e.message }, 502); }
    }
    if (req.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

    let m;
    try { m = await req.json(); } catch { return json({ ok: false, error: 'JSON no válido' }, 400); }
    if (!EMAIL.test(m.to || '') || String(m.to).length > 160) return json({ ok: false, error: 'Destinatario no válido' }, 400);
    if (!m.subject || !(m.html || m.text)) return json({ ok: false, error: 'Falta el asunto o el contenido' }, 400);
    if ((m.html || '').length + (m.text || '').length > 500000) return json({ ok: false, error: 'Email demasiado grande' }, 413);

    try {
      const id = await smtp(cfg, m);
      return json({ ok: true, id });
    } catch (e) {
      return json({ ok: false, error: e.message, smtp: e.smtpCode || undefined }, 502);
    }
  },
};

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------------- Cliente SMTP mínimo ----------------
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64(str) {
  const bytes = typeof str === 'string' ? enc.encode(str) : str;
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
const wrap76 = (s) => s.replace(/.{1,76}/g, (l) => l + '\r\n');
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
function addr(s) { const m = /<([^>]+)>/.exec(s); return (m ? m[1] : s).trim(); }
function fmtFrom(s) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s);
  return m && m[1] ? `${encWord(m[1].trim())} <${m[2].trim()}>` : `<${addr(s)}>`;
}

class Conn {
  constructor(sock) { this.set(sock); this.buf = ''; }
  set(sock) { this.sock = sock; this.reader = sock.readable.getReader(); this.writer = sock.writable.getWriter(); }
  async send(line) { await this.writer.write(enc.encode(line + '\r\n')); }
  // Lee una respuesta completa (multilínea "250-…" hasta "250 …")
  async read(timeoutMs = 20000) {
    const lines = [];
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let nl;
      while ((nl = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, nl).replace(/\r$/, '');
        this.buf = this.buf.slice(nl + 1);
        lines.push(line);
        if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) return { code: Number(line.slice(0, 3)), text: lines.join('\n') };
      }
      const left = deadline - Date.now();
      if (left <= 0) throw new Error('El servidor de correo no responde (tiempo agotado).');
      const r = await Promise.race([this.reader.read(), new Promise((_, ko) => setTimeout(() => ko(new Error('El servidor de correo no responde (tiempo agotado).')), left))]);
      if (r.done) throw new Error('El servidor de correo cerró la conexión.');
      this.buf += dec.decode(r.value, { stream: true });
    }
  }
  async cmd(line, ok, what) {
    if (line !== null) await this.send(line);
    const r = await this.read();
    if (!ok.includes(r.code)) {
      const e = new Error(explain(what, r));
      e.smtpCode = r.code;
      throw e;
    }
    return r;
  }
  async close() { try { await this.writer.close(); } catch {} try { this.sock.close(); } catch {} }
}

function explain(what, r) {
  const t = r.text.replace(/\s+/g, ' ').slice(0, 300);
  if (what === 'auth') return `IONOS rechaza el usuario o la contraseña del buzón (SMTP_USER / SMTP_PASS del Worker). [${t}]`;
  if (what === 'from') return `IONOS no deja enviar con ese remitente: MAIL_FROM tiene que ser la dirección del buzón (hola@eurekamoda.com). [${t}]`;
  if (what === 'rcpt') return `IONOS rechaza el destinatario. [${t}]`;
  if (/limit|quota|rate|too many/i.test(t)) return `IONOS: límite de envíos alcanzado por ahora (se puede reenviar más tarde). [${t}]`;
  return `Error del servidor de correo en ${what}: ${t}`;
}

async function smtp(cfg, m) {
  let sock;
  try {
    sock = connect({ hostname: cfg.host, port: cfg.port }, { secureTransport: cfg.plain ? 'off' : cfg.port === 465 ? 'on' : 'starttls', allowHalfOpen: false });
  } catch (e) { throw new Error(`No se pudo conectar con ${cfg.host}:${cfg.port} (${e.message}).`); }
  const c = new Conn(sock);
  const helo = 'eurekamoda.com';
  try {
    await c.cmd(null, [220], 'saludo');
    let ehlo = await c.cmd('EHLO ' + helo, [250], 'EHLO');
    if (!cfg.plain && cfg.port !== 465) {
      await c.cmd('STARTTLS', [220], 'STARTTLS');
      c.reader.releaseLock(); c.writer.releaseLock();
      c.set(sock.startTls());
      c.buf = '';
      ehlo = await c.cmd('EHLO ' + helo, [250], 'EHLO');
    }
    if (/AUTH[ =][^\n]*PLAIN/i.test(ehlo.text)) {
      await c.cmd('AUTH PLAIN ' + b64('\u0000' + cfg.user + '\u0000' + cfg.pass), [235], 'auth');
    } else {
      await c.cmd('AUTH LOGIN', [334], 'auth');
      await c.cmd(b64(cfg.user), [334], 'auth');
      await c.cmd(b64(cfg.pass), [235], 'auth');
    }
    if (!m) { await c.send('QUIT'); return null; }       // solo comprobación

    const from = addr(cfg.from);
    await c.cmd(`MAIL FROM:<${from}>`, [250], 'from');
    await c.cmd(`RCPT TO:<${m.to}>`, [250, 251], 'rcpt');
    await c.cmd('DATA', [354], 'DATA');

    const id = `${crypto.randomUUID()}@${from.split('@')[1] || helo}`;
    const boundary = 'eureka-' + crypto.randomUUID();
    const head = [
      `From: ${fmtFrom(cfg.from)}`,
      `To: <${m.to}>`,
      `Subject: ${encWord(String(m.subject).replace(/[\r\n]+/g, ' ').slice(0, 250))}`,
      `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
      `Message-ID: <${id}>`,
      'MIME-Version: 1.0',
    ];
    if (m.replyTo && EMAIL.test(m.replyTo)) head.push(`Reply-To: <${m.replyTo}>`);
    for (const [k, v] of Object.entries(m.headers || {})) {
      if (/^[A-Za-z0-9-]{1,60}$/.test(k) && !/^(from|to|subject|date|message-id|mime-version|content-|bcc|cc)/i.test(k)) head.push(`${k}: ${String(v).replace(/[\r\n]+/g, ' ').slice(0, 900)}`);
    }
    head.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const part = (type, body) => `--${boundary}\r\nContent-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${wrap76(b64(body))}`;
    const body = head.join('\r\n') + '\r\n\r\n'
      + part('text/plain', m.text || '')
      + (m.html ? part('text/html', m.html) : '')
      + `--${boundary}--\r\n`;
    // Todo va en base64: ninguna línea empieza por "." salvo el final.
    await c.writer.write(enc.encode(body + '.\r\n'));
    await c.cmd(null, [250], 'envío');
    await c.send('QUIT');
    return id;
  } finally {
    await c.close();
  }
}
