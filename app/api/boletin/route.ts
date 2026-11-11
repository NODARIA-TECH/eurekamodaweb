// Alta en el boletín: guarda el correo y envía el email de bienvenida con el código.
import { NextResponse } from 'next/server';
import { subscribe } from '@/lib/newsletter';
import { baseUrl } from '@/lib/base-url';
import { clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

// Límite anti-abuso: 6 altas por IP cada 10 minutos
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 6;
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  // Campo trampa invisible: si viene relleno es un robot (se responde OK sin hacer nada)
  if (body?.empresa) return NextResponse.json({ ok: true, code: '', sent: false, already: false });
  const ip = clientIp();   // IP real detrás de Cloudflare (CF-Connecting-IP)
  if (limited(ip)) return NextResponse.json({ ok: false, error: 'Demasiados intentos. Prueba de nuevo en unos minutos.' }, { status: 429 });
  const r = await subscribe(String(body?.email || ''), baseUrl());
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true, code: r.code, sent: r.sent, already: r.already });
}
