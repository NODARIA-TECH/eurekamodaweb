// Comprobaciones de configuración que, si fallan, dejan la tienda expuesta o a medias.
// Se ven en Panel → Diagnóstico y, las graves, en una franja roja arriba del panel.
export type ConfigIssue = { grave: boolean; titulo: string; detalle: string };

const PLACEHOLDER = /cambia|cambiame|change|secret$|^eureka$|example|xxxx/i;

export function configIssues(): ConfigIssue[] {
  const env = (k: string) => (process.env[k] || '').trim();
  const out: ConfigIssue[] = [];
  const pass = env('EUREKA_ADMIN_PASSWORD');
  if (!pass || pass === 'eureka' || pass.length < 10)
    out.push({ grave: true, titulo: 'Contraseña del panel demasiado fácil', detalle: 'Pon en el .env EUREKA_ADMIN_PASSWORD con una contraseña de al menos 10 caracteres (no "eureka") y reinicia la web.' });
  const sec = env('EUREKA_AUTH_SECRET');
  if (!sec || sec.length < 24 || PLACEHOLDER.test(sec))
    out.push({ grave: true, titulo: 'Falta el secreto de las sesiones', detalle: 'Sin EUREKA_AUTH_SECRET propio, cualquiera que conozca el código podría entrar en el panel o en las cuentas. Genera uno con «openssl rand -hex 32», ponlo en el .env y reinicia (habrá que volver a entrar).' });
  const sync = env('EUREKA_SYNC_SECRET');
  if (sync && (sync.length < 24 || PLACEHOLDER.test(sync)))
    out.push({ grave: true, titulo: 'Secreto de FacturaScripts de ejemplo', detalle: 'EUREKA_SYNC_SECRET tiene el valor de ejemplo: cualquiera podría cambiar el stock. Pon uno largo (openssl rand -hex 32) y el mismo en n8n.' });
  if (!env('EUREKA_BASE_URL'))
    out.push({ grave: false, titulo: 'Falta EUREKA_BASE_URL', detalle: 'Pon EUREKA_BASE_URL=https://eurekamoda.com en el .env para que los enlaces de los emails y de Stripe siempre sean correctos.' });
  if (env('STRIPE_SECRET_KEY') && !env('STRIPE_WEBHOOK_SECRET'))
    out.push({ grave: false, titulo: 'Falta el webhook de Stripe', detalle: 'Sin STRIPE_WEBHOOK_SECRET, si una clienta paga y cierra el navegador antes de volver a la web, el pedido se queda como pendiente. Configúralo en Stripe → Developers → Webhooks (ver .env.example).' });
  if (env('STRIPE_SECRET_KEY').startsWith('sk_test_'))
    out.push({ grave: false, titulo: 'Stripe en modo de pruebas', detalle: 'La clave de Stripe es de pruebas (sk_test_…): los pagos no son reales.' });
  return out;
}
