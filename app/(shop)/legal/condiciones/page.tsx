import LegalPage from '@/components/LegalPage';
import { TITULAR, DIAS_DEVOLUCION } from '@/lib/legal';

export const metadata = { title: 'Condiciones de compra · EUREKA' };

export default function Condiciones() {
  return (
    <LegalPage title="Condiciones de compra">
      <h2>1. Identificación del vendedor</h2>
      <p>La venta se realiza por <b>{TITULAR.nombre}</b> (NIF {TITULAR.nif}), con domicilio en {TITULAR.domicilio}, {TITULAR.localidad}, bajo el nombre comercial <b>{TITULAR.marca}</b>. Contacto: {TITULAR.email}.</p>

      <h2>2. Productos y precios</h2>
      <p>Los productos ofertados y sus características se describen en cada ficha. Los <b>precios se muestran en euros (€) con el IVA incluido</b>. {TITULAR.marca} se reserva el derecho de modificar precios y catálogo; el precio aplicable será el vigente en el momento de realizar el pedido.</p>

      <h2>3. Proceso de compra</h2>
      <p>Para comprar, añade los artículos a la cesta y finaliza el pedido siguiendo los pasos indicados. Una vez confirmado el pago, recibirás la confirmación de tu pedido. El contrato de compraventa se entiende perfeccionado con la confirmación del pago.</p>

      <h2>4. Formas de pago</h2>
      <p>El pago se realiza de forma segura mediante <b>tarjeta a través de Stripe</b>. {TITULAR.marca} no almacena los datos de tu tarjeta; el tratamiento de los datos de pago lo realiza el proveedor de pago bajo sus propios estándares de seguridad.</p>

      <h2>5. Códigos de descuento</h2>
      <p>Los códigos promocionales (por ejemplo, el descuento de bienvenida del Club {TITULAR.marca}) se aplican en el momento del pago, no son acumulables entre sí salvo indicación expresa, y pueden estar sujetos a condiciones de uso (importe mínimo, caducidad o un solo uso por cliente).</p>

      <h2>6. Envíos</h2>
      <p>Los pedidos se preparan y envían una vez confirmado el pago. Los <b>gastos y plazos de envío</b> se indican en la cesta antes de finalizar la compra. El envío es gratuito a partir del importe indicado en la tienda. También puede elegirse la <b>recogida gratuita en tienda</b> ({TITULAR.domicilio}, {TITULAR.localidad}): avisaremos por email cuando el pedido esté listo para recoger.</p>

      <h2>7. Desistimiento, devoluciones y cambios</h2>
      <p>Dispones de <b>{DIAS_DEVOLUCION} días</b> para devolver o cambiar tu pedido en las condiciones detalladas en nuestra <a href="/legal/devoluciones">Política de devoluciones</a>, que forma parte de estas condiciones.</p>

      <h2>8. Atención al cliente</h2>
      <p>Para cualquier incidencia con tu pedido, escríbenos a <b>{TITULAR.email}</b> indicando tu número de pedido.</p>

      <h2>9. Legislación aplicable</h2>
      <p>Estas condiciones se rigen por la legislación española y la normativa de protección de consumidores y usuarios.</p>
    </LegalPage>
  );
}
