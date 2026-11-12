// Formas de entrega y gastos de envío. Lo usan la cesta (navegador), el pago (servidor), los emails y el panel.
import type { Order, OrderStatus } from './types';
import { TITULAR } from './legal';

export type Entrega = 'envio' | 'recogida';

export const ENVIO_PRECIO = 395;          // céntimos
export const ENVIO_GRATIS_DESDE = 5000;   // céntimos

// Dónde se recoge. EDITA aquí si cambia algo.
export const RECOGIDA = {
  direccion: `${TITULAR.domicilio}, ${TITULAR.localidad}`,
  nota: 'Te avisamos por email cuando esté listo. Pásate en horario de tienda con la referencia del pedido.',
};

export const costeEnvio = (total: number, entrega: Entrega = 'envio') =>
  entrega === 'recogida' || total === 0 || total >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_PRECIO;

// Los pedidos antiguos no tienen el campo: son envío a domicilio.
export const esRecogida = (o: Pick<Order, 'delivery'> | undefined | null) => o?.delivery === 'recogida';

// Nombre de cada estado. En la recogida en tienda «Enviado» es «Listo para recoger» y «Entregado» es «Recogido».
const BASE: Record<OrderStatus, string> = { pendiente: 'Pendiente', pagado: 'Pagado', preparando: 'En preparación', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
export function statusLabel(status: OrderStatus, recogida = false): string {
  if (recogida && status === 'enviado') return 'Listo para recoger';
  if (recogida && status === 'entregado') return 'Recogido';
  return BASE[status] || status;
}
