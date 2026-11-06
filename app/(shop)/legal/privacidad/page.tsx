import LegalPage from '@/components/LegalPage';
import { TITULAR } from '@/lib/legal';

export const metadata = { title: 'Política de privacidad · EUREKA' };

export default function Privacidad() {
  return (
    <LegalPage title="Política de privacidad">
      <h2>1. Responsable del tratamiento</h2>
      <ul>
        <li><b>Responsable:</b> {TITULAR.nombre} (NIF {TITULAR.nif})</li>
        <li><b>Domicilio:</b> {TITULAR.domicilio}, {TITULAR.localidad}</li>
        <li><b>Contacto:</b> {TITULAR.email}</li>
      </ul>

      <h2>2. Datos que tratamos y finalidad</h2>
      <p>Tratamos los datos que nos facilitas al registrarte, realizar un pedido o suscribirte al Club {TITULAR.marca}: nombre, correo electrónico, datos de envío y de contacto. Los usamos para:</p>
      <ul>
        <li>Gestionar tu cuenta, tus pedidos y su seguimiento.</li>
        <li>Tramitar el cobro, el envío y las devoluciones.</li>
        <li>Enviarte, si lo consientes, novedades y promociones del Club.</li>
        <li>Cumplir las obligaciones legales y fiscales.</li>
      </ul>
      <p>Los datos de la tarjeta se tratan directamente por el proveedor de pago (Stripe); {TITULAR.marca} no los almacena.</p>

      <h2>3. Legitimación</h2>
      <p>La base legal es la ejecución del contrato de compra, el consentimiento (para comunicaciones comerciales) y el cumplimiento de obligaciones legales.</p>

      <h2>4. Conservación</h2>
      <p>Conservamos tus datos mientras exista la relación comercial y, después, durante los plazos legalmente exigidos (por ejemplo, los fiscales y contables).</p>

      <h2>5. Destinatarios</h2>
      <p>No cedemos tus datos a terceros salvo obligación legal o a los proveedores necesarios para prestar el servicio (pasarela de pago, empresa de transporte, software de facturación), que actúan como encargados del tratamiento.</p>

      <h2>6. Tus derechos</h2>
      <p>Puedes ejercer tus derechos de <b>acceso, rectificación, supresión, oposición, limitación y portabilidad</b> escribiendo a <b>{TITULAR.email}</b>. También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).</p>
    </LegalPage>
  );
}
