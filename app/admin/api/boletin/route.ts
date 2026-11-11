// Exportar suscriptoras del boletín a CSV (se abre en Excel).
import { adminGuard } from '@/lib/admin-api';
import { listSubscribers } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const deny = adminGuard(req);
  if (deny) return deny;
  const rows = await listSubscribers();
  // Entre comillas y sin fórmulas: un email que empiece por = + - @ no se ejecuta al abrirlo en Excel
  const q = (v: string) => { let x = v || ''; if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return `"${x.replace(/"/g, '""')}"`; };
  const fmt = (d?: string) => (d ? new Date(d).toLocaleString('es-ES') : '');
  const csv = ['Email;Estado;Alta;Email de bienvenida enviado;Baja',
    ...rows.map((s) => [q(s.email), q(s.status), q(fmt(s.createdAt)), q(fmt(s.sentAt)), q(fmt(s.bajaAt))].join(';'))].join('\r\n');
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="boletin-eureka-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
