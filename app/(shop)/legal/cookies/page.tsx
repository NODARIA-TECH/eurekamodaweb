import LegalPage from '@/components/LegalPage';
import { TITULAR } from '@/lib/legal';

export const metadata = { title: 'Política de cookies · EUREKA' };

export default function Cookies() {
  return (
    <LegalPage title="Política de cookies">
      <h2>1. Qué son las cookies</h2>
      <p>Las cookies son pequeños archivos que se guardan en tu dispositivo al navegar. Permiten que la web funcione y recordar algunas preferencias.</p>

      <h2>2. Cookies que utiliza {TITULAR.marca}</h2>
      <ul>
        <li><b>Técnicas / necesarias:</b> imprescindibles para el funcionamiento del sitio, como mantener tu <b>cesta</b> y tu <b>sesión</b> iniciada. No requieren consentimiento.</li>
        <li><b>De terceros (pago):</b> durante el proceso de pago se utiliza la pasarela de Stripe, que puede emplear sus propias cookies de seguridad.</li>
      </ul>
      <p>Actualmente {TITULAR.marca} no utiliza cookies publicitarias ni de perfilado.</p>

      <h2>3. Gestión de cookies</h2>
      <p>Puedes configurar o eliminar las cookies desde los ajustes de tu navegador. Si desactivas las cookies técnicas, es posible que algunas funciones (como la cesta) no funcionen correctamente.</p>

      <h2>4. Contacto</h2>
      <p>Para cualquier duda sobre esta política, escríbenos a <b>{TITULAR.email}</b>.</p>
    </LegalPage>
  );
}
