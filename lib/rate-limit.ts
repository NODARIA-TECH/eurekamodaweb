// Limitador de frecuencia en memoria (ventana deslizante) por clave, p.ej. IP.
// Single-process (PM2 1 instancia): suficiente para frenar abuso/fuerza bruta.
import { headers } from 'next/headers';

const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    hits.set(key, arr);
    const retryAfter = Math.ceil((windowMs - (now - arr[0])) / 1000);
    return { ok: false, retryAfter };
  }
  arr.push(now);
  hits.set(key, arr);
  // limpieza oportunista para que el Map no crezca sin control
  if (hits.size > 5000) {
    hits.forEach((v, k) => {
      const f = v.filter((t) => now - t < windowMs);
      if (f.length) hits.set(k, f); else hits.delete(k);
    });
  }
  return { ok: true };
}

// IP real del cliente. Detrás de Cloudflare viene en CF-Connecting-IP; si no, X-Forwarded-For.
export function clientIp(): string {
  const h = headers();
  const ip = h.get('cf-connecting-ip') || (h.get('x-forwarded-for') || '').split(',')[0] || h.get('x-real-ip') || 'unknown';
  return ip.trim() || 'unknown';
}
