import type { Metadata } from 'next';
import Link from 'next/link';
import { getPublishedContent } from '@/lib/site-store';
import { listShopProducts } from '@/lib/store';
import { TiendaBand, mapsUrl } from '@/components/Tienda';
import ProductGrid from '@/components/ProductGrid';
import JsonLd from '@/components/JsonLd';
import { storeLd, faqLd, breadcrumbLd } from '@/lib/seo';
import { TITULAR, DIAS_DEVOLUCION } from '@/lib/legal';
import { RECOGIDA } from '@/lib/envio';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Nuestra tienda de ropa de mujer en Écija · EUREKA',
  description: `EUREKA, la tienda de moda de mujer de Mónica en Écija (${TITULAR.domicilio}). Ven a probarte la ropa, compra online con envío en 24–48 h o recoge gratis en tienda.`,
  alternates: { canonical: '/nuestra-tienda' },
};

export default async function NuestraTienda() {
  const [c, productos] = await Promise.all([getPublishedContent(), listShopProducts()]);
  const horario = c.tienda.horario.split('\n').map((l) => l.trim()).filter(Boolean);
  const faq = [
    { q: '¿Dónde está la tienda EUREKA?', a: `En ${TITULAR.domicilio}, ${TITULAR.localidad}, en el centro de Écija.` + (horario.length ? ` Horario: ${horario.join('; ')}.` : '') },
    { q: '¿Puedo comprar online y recogerlo en la tienda?', a: `Sí. Al hacer el pedido elige «Recogida en tienda»: es gratis y te avisamos por email cuando esté listo para recoger en ${RECOGIDA.direccion}.` },
    { q: '¿Cuánto tarda el envío y cuánto cuesta?', a: 'Enviamos a toda España en 24–48 h laborables. El envío es gratis en pedidos desde 50 €.' },
    { q: '¿Puedo cambiar o devolver una prenda?', a: `Sí, tienes ${DIAS_DEVOLUCION} días desde que la recibes. También puedes cambiarla directamente en la tienda.` },
    { q: '¿La ropa de la web es la misma que la de la tienda?', a: 'Sí: es la misma tienda. Lo que ves en la web lo tenemos en la tienda de Écija.' },
    { q: '¿Hacéis directos con las novedades?', a: 'Sí, Mónica enseña las novedades en directo en TikTok (@eurekadictas). Síguenos también en Instagram para no perderte nada.' },
  ];
  const nuevos = productos.slice(0, 8);
  return (
    <main className="page" style={{ paddingTop: 0 }}>
      <JsonLd data={[storeLd(c.social as unknown as Record<string, string>, c.tienda), faqLd(faq), breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: 'Nuestra tienda', path: '/nuestra-tienda' }])]} />
      <TiendaBand c={{ ...c.tienda, title: c.tienda.title === 'Ven a conocernos' ? 'Nuestra tienda de ropa de mujer en Écija' : c.tienda.title }} social={c.social} page />
      <section className="nt-como">
        <div className="wrap">
          <div className="sh"><span className="script">así de fácil</span><h2>Cómo comprar en EUREKA</h2></div>
          <ol className="nt-pasos">
            <li><b>En la tienda</b><span>Ven a {TITULAR.domicilio}, pruébate lo que quieras y te aconsejamos.</span></li>
            <li><b>Online, con envío</b><span>Pide en eurekamoda.com y lo recibes en 24–48 h. Gratis desde 50 €.</span></li>
            <li><b>Online, recogida gratis</b><span>Compra en la web y recógelo en la tienda cuando te venga bien.</span></li>
          </ol>
          <p className="nt-mapa"><a className="btn btn-gold" href={mapsUrl(c.tienda)} target="_blank" rel="noopener noreferrer">Ver en Google Maps</a> <Link className="btn btn-o" href="/tienda">Ver la colección</Link></p>
        </div>
      </section>
      {nuevos.length > 0 && (
        <section className="nt-nuevos">
          <div className="wrap">
            <div className="sh"><span className="script">ahora en tienda</span><h2>Lo que tenemos estos días</h2></div>
            <ProductGrid products={nuevos} />
          </div>
        </section>
      )}
      <section className="nt-faq">
        <div className="wrap">
          <div className="sh"><span className="script">dudas</span><h2>Preguntas frecuentes</h2></div>
          <div className="nt-faq-l">
            {faq.map((f) => (<details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>))}
          </div>
        </div>
      </section>
    </main>
  );
}
