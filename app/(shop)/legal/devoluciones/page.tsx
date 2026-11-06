import LegalPage from '@/components/LegalPage';
import { TITULAR, DIAS_DEVOLUCION } from '@/lib/legal';

export const metadata = { title: 'Devoluciones y cambios · EUREKA' };

export default function Devoluciones() {
  return (
    <LegalPage title="Devoluciones y cambios">
      <h2>1. Plazo de devolución</h2>
      <p>Dispones de <b>{DIAS_DEVOLUCION} días naturales</b> desde la recepción del pedido para solicitar su devolución o cambio.</p>

      <h2>2. Estado de la prenda</h2>
      <p>Para aceptar una devolución, la prenda debe estar <b>en perfecto estado y sin taras</b>: sin usar, sin lavar, sin olores (perfume, tabaco…), con todas sus <b>etiquetas originales</b> puestas y, cuando proceda, en su embalaje original. No se admitirán prendas que muestren signos de uso o deterioro ajenos a un defecto de fabricación.</p>

      <h2>3. Productos recibidos con alguna tara o defecto</h2>
      <p>Revisa tu pedido en el momento de la recepción. Si el artículo llega con <b>alguna tara o defecto</b>, es imprescindible que:</p>
      <ul>
        <li>Hagas <b>fotografías del defecto nada más recibir el paquete</b>, sin haber usado ni lavado la prenda.</li>
        <li>Nos lo comuniques por correo a <b>{TITULAR.email}</b> en un plazo máximo de <b>48 horas</b> desde la recepción, indicando tu número de pedido y adjuntando las fotos.</li>
      </ul>
      <p>En caso de defecto de fabricación debidamente acreditado, {TITULAR.marca} asumirá los gastos de la devolución o el cambio.</p>

      <h2>4. Cómo solicitar una devolución o cambio</h2>
      <ul>
        <li>Escríbenos a <b>{TITULAR.email}</b> indicando tu <b>número de pedido</b> y el artículo a devolver o cambiar.</li>
        <li>Te daremos las instrucciones para el envío de vuelta.</li>
        <li>Los <b>gastos de devolución</b> corren a cargo del cliente, salvo que el producto presente una tara o se haya recibido un artículo erróneo.</li>
      </ul>

      <h2>5. Reembolso</h2>
      <p>Una vez recibida la prenda y comprobado que cumple las condiciones anteriores, se procederá al <b>reembolso en un plazo de hasta 14 días</b>, por el <b>mismo medio de pago</b> utilizado en la compra. Los gastos de envío iniciales solo se reembolsan cuando la devolución se deba a un error o defecto imputable a {TITULAR.marca}.</p>

      <h2>6. Cambios de talla</h2>
      <p>Si necesitas otra talla, indícanoslo al solicitar el cambio. El envío de la nueva talla queda sujeto a disponibilidad de stock.</p>

      <p><i>Esta política no afecta a los derechos que la normativa de consumidores y usuarios reconoce a los consumidores.</i></p>
    </LegalPage>
  );
}
