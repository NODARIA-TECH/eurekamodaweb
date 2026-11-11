// Emails de pedidos: confirmación a la clienta, aviso a la tienda y "tu pedido va de camino".
// Mismo estilo que el email de bienvenida del Club. Nunca rompen el pedido si el correo falla.
import type { Order } from './types';
import { sendMail, mailConfigured } from './mailer';
import { noteOrderEmail } from './store';
import { TITULAR } from './legal';

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const eur = (c: number) => (c / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const line = (i: Order['items'][number]) => `${i.qty} × ${i.name}${i.size || i.color ? ` (${[i.size && `talla ${i.size}`, i.color].filter(Boolean).join(', ')})` : ''}`;

function address(o: Order): string[] {
  const a = o.shipping;
  if (!a) return [];
  return [a.name, a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(' '), a.state && a.state !== a.city ? a.state : '', a.country && a.country !== 'ES' ? a.country : '']
    .filter((x): x is string => !!x && !!x.trim());
}

function frame(base: string, title: string, intro: string, body: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#F4EEE3;font-family:Helvetica,Arial,sans-serif;color:#2A2018">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4EEE3;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFDF8;border-radius:18px;overflow:hidden;border:1px solid #E7DCC8">
<tr><td align="center" style="padding:30px 28px 6px"><img src="${esc(base)}/eureka-logo.png" width="150" alt="EUREKA" style="display:block;width:150px;max-width:55%;height:auto;border:0"></td></tr>
<tr><td style="padding:8px 32px 0" align="center">
<h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:27px;line-height:1.25;color:#2A2018">${esc(title)}</h1>
<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#5B4E3F">${intro}</p>
</td></tr>
<tr><td style="padding:20px 32px 26px">${body}</td></tr>
<tr><td style="padding:18px 28px;background:#F7F1E6;border-top:1px solid #EFE5D4" align="center">
<p style="margin:0;font-size:12px;line-height:1.6;color:#8C7E6A">EUREKA · Moda de mujer · Écija<br><a href="${esc(base)}" style="color:#8C7650">eurekamoda.com</a> · ${esc(TITULAR.email)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

function itemsTable(o: Order) {
  const rows = o.items.map((i) => `<tr><td style="padding:7px 0;border-bottom:1px solid #EFE5D4;font-size:14px;color:#2A2018">${esc(line(i))}</td><td align="right" style="padding:7px 0;border-bottom:1px solid #EFE5D4;font-size:14px;white-space:nowrap">${eur(i.price * i.qty)}</td></tr>`).join('');
  const extra: string[] = [];
  if (o.shippingCost != null) extra.push(`<tr><td style="padding:6px 0;font-size:14px;color:#5B4E3F">Envío</td><td align="right" style="font-size:14px">${o.shippingCost ? eur(o.shippingCost) : 'Gratis'}</td></tr>`);
  if (o.discount) extra.push(`<tr><td style="padding:6px 0;font-size:14px;color:#5B4E3F">Descuento</td><td align="right" style="font-size:14px">−${eur(o.discount)}</td></tr>`);
  const total = o.amountPaid ?? o.total;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}${extra.join('')}
<tr><td style="padding:10px 0 0;font-size:15px;font-weight:bold">Total</td><td align="right" style="padding:10px 0 0;font-size:15px;font-weight:bold">${eur(total)}</td></tr></table>`;
}

const box = (label: string, html: string) => `<div style="margin-top:18px;padding:14px 16px;background:#FBF6EC;border:1px solid #EFE5D4;border-radius:12px"><p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8C7650">${label}</p><div style="font-size:14px;line-height:1.55;color:#2A2018">${html}</div></div>`;
const btn = (href: string, text: string) => `<p style="margin:22px 0 0;text-align:center"><a href="${esc(href)}" style="display:inline-block;background:#2A2018;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1px;padding:13px 28px;border-radius:999px">${esc(text)}</a></p>`;
const track = (base: string, o: Order) => `${base}/seguimiento?ref=${encodeURIComponent(o.ref)}&email=${encodeURIComponent(o.customerEmail || '')}`;

function confirmation(base: string, o: Order) {
  const dir = address(o);
  const html = frame(base, '¡Gracias por tu compra!',
    `Hemos recibido tu pedido <b>${esc(o.ref)}</b> y ya lo estamos preparando. Te avisaremos cuando salga hacia tu casa.`,
    itemsTable(o) + (dir.length ? box('Envío a', dir.map(esc).join('<br>')) : '') + btn(track(base, o), 'Seguir mi pedido')
    + `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#5B4E3F;text-align:center">¿Alguna duda? Responde a este correo o escríbenos a ${esc(TITULAR.email)}.</p>`);
  const text = `¡Gracias por tu compra!\n\nPedido ${o.ref}\n${o.items.map(line).join('\n')}\nTotal: ${eur(o.amountPaid ?? o.total)}\n${dir.length ? '\nEnvío a:\n' + dir.join('\n') + '\n' : ''}\nSigue tu pedido: ${track(base, o)}\n\nEUREKA · eurekamoda.com`;
  return { subject: `Pedido ${o.ref} confirmado · EUREKA`, html, text };
}

function trackingBox(o: Order) {
  if (!o.carrier && !o.trackingNumber) return '';
  const num = o.trackingNumber ? (o.trackingUrl ? `<a href="${esc(o.trackingUrl)}" style="color:#2A2018;font-weight:bold">${esc(o.trackingNumber)}</a>` : `<b>${esc(o.trackingNumber)}</b>`) : '';
  return box('Envío', [o.carrier ? esc(o.carrier) : '', num ? `Nº de seguimiento: ${num}` : ''].filter(Boolean).join('<br>'));
}
const trackingText = (o: Order) => [o.carrier, o.trackingNumber && `Nº de seguimiento: ${o.trackingNumber}`, o.trackingUrl].filter(Boolean).join('\n');

function shipped(base: string, o: Order) {
  const html = frame(base, 'Tu pedido va de camino',
    `Tu pedido <b>${esc(o.ref)}</b> ya ha salido de la tienda. Pronto lo tendrás contigo.`,
    itemsTable(o) + trackingBox(o) + btn(o.trackingUrl || track(base, o), o.trackingUrl ? 'Seguir el envío' : 'Seguir mi pedido'));
  const text = `Tu pedido ${o.ref} ya ha salido de la tienda.\n\n${o.items.map(line).join('\n')}\n${trackingText(o) ? '\n' + trackingText(o) + '\n' : ''}\nSigue tu pedido: ${track(base, o)}\n\nEUREKA · eurekamoda.com`;
  return { subject: `Tu pedido ${o.ref} va de camino · EUREKA`, html, text };
}

function shopNotice(base: string, o: Order) {
  const dir = address(o);
  const who = [o.customerName, o.customerEmail, o.phone].filter(Boolean).map((x) => esc(String(x))).join('<br>');
  const html = frame(base, `Nuevo pedido ${o.ref}`, `Pagado: <b>${eur(o.amountPaid ?? o.total)}</b>`,
    itemsTable(o) + box('Clienta', who || '—') + box('Enviar a', dir.length ? dir.map(esc).join('<br>') : 'Sin dirección (¿recogida en tienda?)') + btn(`${base}/admin/pedidos`, 'Ver en el panel'));
  const text = `Nuevo pedido ${o.ref} · ${eur(o.amountPaid ?? o.total)}\n\n${o.items.map(line).join('\n')}\n\nClienta: ${[o.customerName, o.customerEmail, o.phone].filter(Boolean).join(' · ')}\nEnviar a:\n${dir.join('\n') || '—'}\n\n${base}/admin/pedidos`;
  return { subject: `Nuevo pedido ${o.ref} · ${eur(o.amountPaid ?? o.total)}`, html, text };
}

// A quién avisar en la tienda: SHOP_NOTIFY_EMAIL, si no MAIL_REPLY_TO, si no el correo del aviso legal.
const shopEmail = () => (process.env.SHOP_NOTIFY_EMAIL || process.env.MAIL_REPLY_TO || TITULAR.email).trim();

export async function sendOrderPaidEmails(base: string, o: Order): Promise<void> {
  if (!mailConfigured()) return;
  try {
    if (o.customerEmail && !o.emails?.confirmacion) {
      const m = confirmation(base, o);
      const r = await sendMail({ to: o.customerEmail, ...m });
      if (r.ok) await noteOrderEmail(o.id, 'confirmacion');
    }
    if (shopEmail() && !o.emails?.tienda) {
      const m = shopNotice(base, o);
      const r = await sendMail({ to: shopEmail(), ...m, replyTo: o.customerEmail || undefined });   // responder = escribir a la clienta
      if (r.ok) await noteOrderEmail(o.id, 'tienda');
    }
  } catch (e: any) { console.error('[pedidos] Email de pedido', o.ref, e?.message); }
}

import { STATUS_LABEL } from './types';
// Aviso de cambio de estado o mensaje de la tienda ("lo estamos preparando", "ya puedes recogerlo"…)
export async function sendOrderUpdateEmail(base: string, o: Order, note?: string): Promise<boolean> {
  if (!mailConfigured() || !o.customerEmail) return false;
  const st = STATUS_LABEL[o.status] || o.status;
  const html = frame(base, `Tu pedido ${o.ref}: ${st.toLowerCase()}`,
    note ? esc(note).replace(/\n/g, '<br>') : `El estado de tu pedido ha cambiado a <b>${esc(st)}</b>.`,
    itemsTable(o) + trackingBox(o) + btn(track(base, o), 'Ver mi pedido'));
  const text = `Tu pedido ${o.ref}: ${st}\n\n${note || ''}\n\n${o.items.map(line).join('\n')}\n${trackingText(o) ? '\n' + trackingText(o) + '\n' : ''}\nVer tu pedido: ${track(base, o)}\n\nEUREKA · eurekamoda.com`;
  try { return (await sendMail({ to: o.customerEmail, subject: `Tu pedido ${o.ref}: ${st.toLowerCase()} · EUREKA`, html, text })).ok; }
  catch { return false; }
}

export async function sendOrderShippedEmail(base: string, o: Order): Promise<void> {
  if (!mailConfigured() || !o.customerEmail || o.emails?.enviado) return;
  try {
    const r = await sendMail({ to: o.customerEmail, ...shipped(base, o) });
    if (r.ok) await noteOrderEmail(o.id, 'enviado');
  } catch (e: any) { console.error('[pedidos] Email de envío', o.ref, e?.message); }
}
