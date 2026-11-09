// Boletín: suscriptoras, estado del envío de emails y email de prueba.
import { requireAdmin } from '@/lib/admin-auth';
import { listSubscribers, welcomeCode } from '@/lib/newsletter';
import { mailConfigured, mailFrom } from '@/lib/mailer';
import { sendTest } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Boletín · EUREKA' };

type SP = { prueba?: string; a?: string; e?: string };
const fmt = (d?: string) => (d ? new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default async function BoletinAdmin({ searchParams }: { searchParams: SP }) {
  requireAdmin();
  const subs = await listSubscribers();
  const activas = subs.filter((s) => s.status === 'activa');
  const ok = mailConfigured();
  return (
    <>
      <div className="adm-h">
        <div><h1>Boletín</h1><p>{activas.length} suscritas · {subs.length - activas.length} bajas · código de bienvenida <b>{welcomeCode()}</b></p></div>
        <a className="btn-sm" href="/admin/api/boletin">Descargar lista (Excel/CSV)</a>
      </div>

      {searchParams.prueba === 'ok' && <div className="adm-ok">Email de prueba enviado a <b>{searchParams.a}</b>. Revisa también la carpeta de spam.</div>}
      {searchParams.prueba === 'error' && <div className="adm-err">No se pudo enviar: {searchParams.e}</div>}
      {searchParams.prueba === 'mal' && <div className="adm-err">Escribe un correo válido para la prueba.</div>}

      <div className="adm-card">
        <h3>Envío de emails</h3>
        {ok ? (
          <p>Configurado: los emails salen desde <b>{mailFrom()}</b>. Cada nueva suscriptora recibe al momento su código.</p>
        ) : (
          <p className="adm-tag warn" style={{ display: 'inline-block', padding: '8px 12px' }}>
            Sin configurar: las suscripciones se guardan y el código se muestra en pantalla, pero no se envía el email.
            Hay que poner los datos del correo (SMTP) en el archivo .env del servidor.
          </p>
        )}
        <form action={sendTest} className="adm-form" style={{ marginTop: 12, gridTemplateColumns: '1fr auto' }}>
          <label>Enviar un email de prueba a<input name="to" type="email" placeholder="tu@correo.com" required /></label>
          <button className="btn-sm gold" type="submit" style={{ height: 40, alignSelf: 'end' }}>Enviar prueba</button>
        </form>
      </div>

      <div className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Email</th><th>Alta</th><th>Email de bienvenida</th><th>Estado</th></tr></thead>
          <tbody>
            {subs.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>Todavía no hay suscripciones.</td></tr>}
            {subs.map((s) => (
              <tr key={s.email}>
                <td>{s.email}</td>
                <td>{fmt(s.createdAt)}</td>
                <td>{s.sentAt ? <span className="adm-tag ok">Enviado {fmt(s.sentAt)}</span> : s.lastError ? <span className="adm-tag warn" title={s.lastError}>No enviado</span> : <span className="adm-tag off">Pendiente</span>}</td>
                <td>{s.status === 'activa' ? 'Suscrita' : <span className="adm-tag off">Baja {fmt(s.bajaAt)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
