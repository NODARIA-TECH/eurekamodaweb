// La tienda de verdad: franja de confianza bajo la portada y bloque «Nuestra tienda en Écija».
// Sirven para que quien llega desde Instagram o Google vea al momento que EUREKA es la tienda de
// Mónica en Écija (y se fíe de comprar), y para que Google asocie la web a «tienda de ropa en Écija».
import type { SiteContent } from '@/lib/site-content';
import { TITULAR, DIAS_DEVOLUCION } from '@/lib/legal';

const DIR = `${TITULAR.domicilio}, ${TITULAR.localidad}`;
export const mapsUrl = (t: SiteContent['tienda']) => t.maps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`EUREKA moda, ${TITULAR.domicilio}, 41400 Écija`)}`;
export const telHref = (tel: string) => { const d = tel.replace(/\D/g, ''); return d ? `tel:${d.length === 9 ? '+34' + d : '+' + d}` : ''; };

const I = {
  tienda: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5M10 20v-5h4v5" /></svg>,
  bolsa: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Zm4 0V6.5a3 3 0 0 1 6 0V8" /></svg>,
  envio: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 6h11v10h-11zM13.5 9.5h4l3 3.2V16h-7M6 18.5a1.8 1.8 0 1 0 0-.1M17 18.5a1.8 1.8 0 1 0 0-.1" /></svg>,
  cambio: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5" /></svg>,
  candado: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" /></svg>,
  pin: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /></svg>,
  reloj: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2" /></svg>,
  tel: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.1 6.1l1.3-2 4 1.5v3c0 1-.8 1.9-1.9 1.9A16.6 16.6 0 0 1 4.7 5.4c0-1 .9-1.9 1.9-1.9Z" /></svg>,
  wa: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4A8 8 0 1 1 8 19l-4 1Zm5-11.5c-.3 2.4 2.6 5.6 5.4 6l1.3-1.3-1.8-1-.9.7c-.9-.4-1.8-1.3-2.2-2.2l.7-.9-1-1.8-1.5.5Z" /></svg>,
};

export function TrustBar() {
  const items: [keyof typeof I, string, string][] = [
    ['tienda', 'Tienda física en Écija', TITULAR.domicilio],
    ['bolsa', 'Recogida gratis', 'compra online y recoge en tienda'],
    ['envio', 'Envío en 24–48 h', 'gratis desde 50 €'],
    ['cambio', `Cambios en ${DIAS_DEVOLUCION} días`, 'fáciles y sin líos'],
    ['candado', 'Pago seguro', 'con tarjeta, a través de Stripe'],
  ];
  return (
    <div className="trust" aria-label="Por qué comprar en EUREKA">
      <ul className="wrap trust-in">
        {items.map(([ic, t, s]) => (
          <li key={t}>{I[ic]}<span><b>{t}</b><small>{s}</small></span></li>
        ))}
      </ul>
    </div>
  );
}

export function TiendaBand({ c, social, page = false }: { c: SiteContent['tienda']; social: SiteContent['social']; page?: boolean }) {
  const tel = telHref(c.telefono);
  const horas = c.horario.split('\n').map((l) => l.trim()).filter(Boolean);
  const H = page ? 'h1' : 'h2';
  return (
    <section className="tienda" id="tienda">
      <div className="wrap tienda-in">
        <figure className="tienda-foto">
          <img src={c.img.src} alt={c.img.alt || 'La tienda EUREKA en Écija'} style={{ objectPosition: `${c.img.x}% ${c.img.y}%` }} loading={page ? 'eager' : 'lazy'} />
          <figcaption><span className="script">te esperamos</span></figcaption>
        </figure>
        <div className="tienda-txt">
          {c.kicker && <span className="lab">{c.kicker}</span>}
          <H>{c.title}</H>
          {c.text && <p>{c.text}</p>}
          <ul className="tienda-datos">
            <li>{I.pin}<span><b>{TITULAR.domicilio}</b><br />{TITULAR.localidad}</span></li>
            {horas.length > 0 && <li>{I.reloj}<span>{horas.map((h, i) => <span key={i}>{h}<br /></span>)}</span></li>}
            {c.telefono && tel && <li>{I.tel}<span><a href={tel}>{c.telefono}</a></span></li>}
          </ul>
          <div className="tienda-btns">
            <a className="btn btn-gold" href={mapsUrl(c)} target="_blank" rel="noopener noreferrer">Cómo llegar</a>
            {social.whatsapp && <a className="btn btn-o" href={social.whatsapp} target="_blank" rel="noopener noreferrer">{I.wa} WhatsApp</a>}
            {!social.whatsapp && tel && <a className="btn btn-o" href={tel}>{I.tel} Llamar</a>}
            {!page && <a className="btn btn-o" href="/nuestra-tienda">Conoce la tienda</a>}
          </div>
          {(social.instagram || social.tiktok) && (
            <p className="tienda-redes">
              Síguenos y no te pierdas los directos con las novedades:{' '}
              {social.instagram && <a href={social.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
              {social.instagram && social.tiktok && ' · '}
              {social.tiktok && <a href={social.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// Botón flotante de WhatsApp (solo si la tienda ha puesto su WhatsApp en el panel)
export function WhatsAppFlotante({ url }: { url: string }) {
  if (!url) return null;
  const msg = encodeURIComponent('¡Hola! Te escribo desde la web de EUREKA: ');
  const href = /wa\.me\/\d+\/?$/.test(url) ? `${url.replace(/\/$/, '')}?text=${msg}` : url;
  return (
    <a className="wa-flot" href={href} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">
      {I.wa}<span>¿Dudas? Escríbenos</span>
    </a>
  );
}
