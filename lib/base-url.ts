import { headers } from 'next/headers';
// Dirección pública de la web (para enlaces en emails): EUREKA_BASE_URL o la del propio dominio.
export function baseUrl(): string {
  let base = process.env.EUREKA_BASE_URL;
  if (!base) {
    const h = headers();
    const host = h.get('x-forwarded-host') || h.get('host') || 'eurekamoda.com';
    const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
    base = `${proto}://${host}`;
  }
  return base.replace(/\/+$/, '');
}
