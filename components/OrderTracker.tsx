import type { Order } from '@/lib/types';
import { RECOGIDA } from '@/lib/envio';

// Por dónde va el pedido (lo ven la clienta, en su cuenta y en «Seguir pedido», y la tienda en la ficha).
const FLOW: { key: Order['status']; label: string; desc: string }[] = [
  { key: 'pendiente', label: 'Pedido recibido', desc: 'Hemos recibido tu pedido' },
  { key: 'pagado', label: 'Pago confirmado', desc: 'El pago se ha confirmado' },
  { key: 'preparando', label: 'En preparación', desc: 'Lo estamos preparando con mimo' },
  { key: 'enviado', label: 'Enviado', desc: 'Tu pedido va de camino' },
  { key: 'entregado', label: 'Entregado', desc: '¡Que lo disfrutes!' },
];
// Recogida en tienda: mismas fases, pero «Enviado» = listo para recoger y «Entregado» = recogido
const FLOW_RECOGIDA: typeof FLOW = FLOW.map((f) =>
  f.key === 'enviado' ? { ...f, label: 'Listo para recoger', desc: 'Ya puedes pasar por la tienda' }
  : f.key === 'entregado' ? { ...f, label: 'Recogido', desc: '¡Que lo disfrutes!' }
  : f.key === 'preparando' ? { ...f, desc: 'Lo estamos preparando para que lo recojas' } : f);
const labels = (flow: typeof FLOW): Record<string, string> => Object.fromEntries(flow.map((f) => [f.key, f.label]).concat([['cancelado', 'Cancelado']]));

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function OrderTracker({
  status, history, carrier, trackingNumber, trackingUrl, pickup = false,
}: {
  status: Order['status'];
  history?: Order['history'];
  carrier?: string; trackingNumber?: string; trackingUrl?: string;
  pickup?: boolean;   // recogida en tienda
}) {
  const flow = pickup ? FLOW_RECOGIDA : FLOW;
  const LABEL = labels(flow);
  const notes = (history || []).filter((h) => h.note).slice().reverse();
  const envio = pickup ? (
    <div className="track-pickup">
      <b>Recogida en tienda</b>
      {RECOGIDA.direccion}
    </div>
  ) : (carrier || trackingNumber) ? (
    <div className="track-ship">
      <span className="track-ship-l">Envío</span>
      <span>{carrier}{carrier && trackingNumber ? ' · ' : ''}{trackingNumber && (trackingUrl
        ? <a href={trackingUrl} target="_blank" rel="noopener noreferrer">Nº {trackingNumber} ↗</a>
        : <>Nº {trackingNumber}</>)}</span>
    </div>
  ) : null;
  const avisos = notes.length > 0 ? (
    <ul className="track-notes">
      {notes.map((h, i) => (
        <li key={i}><span className="track-when">{fechaHora(h.at)} · {LABEL[h.status] || h.status}</span><p>{h.note}</p></li>
      ))}
    </ul>
  ) : null;

  if (status === 'cancelado') {
    return (
      <>
        <div className="track track-cancel">
          <span className="track-cancel-ic">✕</span>
          <div>
            <strong>Pedido cancelado</strong>
            <p>Si crees que es un error, escríbenos y lo revisamos.</p>
          </div>
        </div>
        {avisos}
      </>
    );
  }
  // Un pedido que pasó directamente a enviado sin «en preparación» marca esa fase como hecha
  const cur = Math.max(0, flow.findIndex((s) => s.key === status));
  const whenOf = (k: Order['status']) => history?.find((h) => h.status === k)?.at;

  return (
    <>
      <div className="track">
        {flow.map((s, i) => {
          const state = i < cur ? 'done' : i === cur ? 'active' : 'pending';
          const when = whenOf(s.key);
          return (
            <div className={'track-step ' + state} key={s.key}>
              <div className="track-dot">{i < cur ? '✓' : i + 1}</div>
              <div className="track-txt">
                <span className="track-label">{s.label}</span>
                <span className="track-desc">{s.desc}</span>
                {when && <span className="track-when">{fecha(when)}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {envio}
      {avisos}
    </>
  );
}
