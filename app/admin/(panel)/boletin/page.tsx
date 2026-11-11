// Boletín: suscriptoras, estado del envío de emails y email de prueba.
import { requireAdmin } from '@/lib/admin-auth';
import { listSubscribers, welcomeCode } from '@/lib/newsletter';
import { checkMail, providerName } from '@/lib/mailer';
import { sendTest, sendPendingAction } from './actions';
import Stripe from 'stripe';

// ¿Existe el código de bienvenida en Stripe? (si no, la clienta lo recibe pero no le funciona al pagar)
async function codeInStripe(code: string): Promise<'ok' | 'falta' | 'sin-stripe' | 'error'> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return 'sin-stripe';
  try {
    const list = await new Stripe(key).promotionCodes.list({ code, active: true, limit: 1 });
    return list.data.length ? 'ok' : 'falta';
  } catch { return 'error'; }
}

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Boletín · EUREKA' };

type SP = { prueba?: string; a?: string; e?: string; pend?: string; s?: string; f?: string };
const fmt = (d?: string) => (d ? new Date(d).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export default async function BoletinAdmin({ searchParams }: { searchParams: SP }) {
  requireAdmin();
  const subs = await listSubscribers();
  const activas = subs.filter((s) => s.status === 'activa');
  const estado = await checkMail();
  const pendientes = activas.filter((s) => !s.sentAt).length;
  const enStripe = await codeInStripe(welcomeCode());
  return (
    <>
      <div className="adm-h">
        <div><h1>Boletín</h1><p>{activas.length} {activas.length === 1 ? 'suscrita' : 'suscritas'} · {subs.length - activas.length} bajas · código de bienvenida <b>{welcomeCode()}</b></p></div>
        <a className="btn-sm" href="/admin/api/boletin">Descargar lista (Excel/CSV)</a>
      </div>

      {searchParams.prueba === 'ok' && <div className="adm-ok">Email de prueba enviado a <b>{searchParams.a}</b>. Revisa también la carpeta de spam.</div>}
      {searchParams.prueba === 'error' && <div className="adm-err">No se pudo enviar: {searchParams.e}</div>}
      {searchParams.pend && <div className={searchParams.f !== '0' ? 'adm-err' : 'adm-ok'}>Código enviado a {searchParams.s} suscriptora(s){searchParams.f !== '0' ? ` · ${searchParams.f} sin enviar: ${searchParams.e || ''}` : '.'}</div>}
      {searchParams.prueba === 'mal' && <div className="adm-err">Escribe un correo válido para la prueba.</div>}

      {enStripe === 'falta' && (
        <div className="adm-err">
          El código <b>{welcomeCode()}</b> no existe en Stripe: las clientas lo reciben, pero al pagar les dirá que no es válido.
          Créalo en Stripe → Productos → Cupones → Nuevo (20 %, una vez) → «Añadir código de promoción» con el código <b>{welcomeCode()}</b>
          (y marca «Solo primeros pedidos» si quieres).
        </div>
      )}
      {enStripe === 'ok' && <div className="adm-ok">El código {welcomeCode()} está activo en Stripe ✓</div>}

      <div className="adm-card">
        <h3>Envío de emails</h3>
        {estado.ok ? (
          <p>✓ Funciona con <b>{providerName()}</b>: {estado.detail}. Cada nueva suscriptora recibe su código al momento.</p>
        ) : estado.detail === 'Sin configurar' ? (
          <p className="adm-tag warn" style={{ display: 'inline-block', padding: '8px 12px', lineHeight: 1.5 }}>
            Sin configurar: las suscripciones se guardan y el código se ve en pantalla, pero no se envía el email.
            Hay que poner la dirección y la clave del relé de Cloudflare (MAIL_RELAY_URL y MAIL_RELAY_TOKEN) en el .env del servidor.
          </p>
        ) : (
          <p className="adm-err" style={{ margin: 0 }}>No se puede enviar ({providerName()}): {estado.detail}</p>
        )}
        <form action={sendTest} className="adm-form" style={{ marginTop: 12, gridTemplateColumns: '1fr auto' }}>
          <label>Enviar un email de prueba a<input name="to" type="email" placeholder="tu@correo.com" required /></label>
          <button className="btn-sm gold" type="submit" style={{ height: 40, alignSelf: 'end' }}>Enviar prueba</button>
        </form>
        {pendientes > 0 && (
          <form action={sendPendingAction} style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="adm-help" style={{ margin: 0 }}>{pendientes} suscriptora(s) todavía no han recibido su código.</span>
            <button className="btn-sm" type="submit" disabled={!estado.ok}>Enviárselo ahora</button>
          </form>
        )}
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
