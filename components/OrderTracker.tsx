import type { Order } from '@/lib/types';

// Fases visibles del pedido para el cliente (cancelado se trata aparte).
const FLOW: { key: Order['status']; label: string; desc: string }[] = [
  { key: 'pendiente', label: 'Pedido recibido', desc: 'Hemos recibido tu pedido' },
  { key: 'pagado', label: 'Pago confirmado', desc: 'El pago se ha confirmado' },
  { key: 'enviado', label: 'Enviado', desc: 'Tu pedido va de camino' },
  { key: 'entregado', label: 'Entregado', desc: '¡Que lo disfrutes!' },
];

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export default function OrderTracker({
  status,
  history,
}: {
  status: Order['status'];
  history?: { status: Order['status']; at: string }[];
}) {
  if (status === 'cancelado') {
    return (
      <div className="track track-cancel">
        <span className="track-cancel-ic">✕</span>
        <div>
          <strong>Pedido cancelado</strong>
          <p>Si crees que es un error, escríbenos y lo revisamos.</p>
        </div>
      </div>
    );
  }
  const cur = Math.max(0, FLOW.findIndex((s) => s.key === status));
  const whenOf = (k: Order['status']) => history?.find((h) => h.status === k)?.at;

  return (
    <div className="track">
      {FLOW.map((s, i) => {
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
  );
}
