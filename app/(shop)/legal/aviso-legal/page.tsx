import LegalPage from '@/components/LegalPage';
import { TITULAR } from '@/lib/legal';

export const metadata = { title: 'Aviso legal · EUREKA' };

export default function AvisoLegal() {
  return (
    <LegalPage title="Aviso legal">
      <h2>1. Titular del sitio web</h2>
      <p>En cumplimiento de la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de los datos del titular de <b>{TITULAR.web}</b>:</p>
      <ul>
        <li><b>Titular:</b> {TITULAR.nombre}</li>
        <li><b>NIF:</b> {TITULAR.nif}</li>
        <li><b>Domicilio:</b> {TITULAR.domicilio}, {TITULAR.localidad}</li>
        <li><b>Correo de contacto:</b> {TITULAR.email}</li>
        <li><b>Nombre comercial:</b> {TITULAR.marca}</li>
      </ul>

      <h2>2. Objeto</h2>
      <p>{TITULAR.marca} es una tienda de moda de mujer que comercializa prendas y complementos a través de este sitio web. El uso del sitio atribuye la condición de usuario e implica la aceptación de las condiciones recogidas en este Aviso legal.</p>

      <h2>3. Propiedad intelectual e industrial</h2>
      <p>Todos los contenidos del sitio (textos, imágenes, logotipos, diseño y código) son propiedad del titular o de terceros que han autorizado su uso, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución o transformación sin autorización expresa.</p>

      <h2>4. Responsabilidad</h2>
      <p>El titular no se hace responsable de los daños derivados del mal uso del sitio ni de las interrupciones del servicio ajenas a su voluntad. Se compromete a corregir los errores que detecte en el catálogo, precios o disponibilidad con la mayor brevedad.</p>

      <h2>5. Legislación aplicable</h2>
      <p>Las presentes condiciones se rigen por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a la normativa de consumidores y usuarios.</p>
    </LegalPage>
  );
}
