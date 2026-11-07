import Link from 'next/link';
import { productImg } from '@/lib/data';
import { money } from '@/lib/money';
import type { Category, Product } from '@/lib/types';

// Fotos reales de la tienda (public/img/home). Cámbialas sustituyendo el archivo con el mismo nombre.
const H = (f: string) => `/img/home/${f}.webp`;
const CAT_PHOTO: Record<string, string> = {
  punto: H('cat-punto'), camisas: H('cat-camisas'), camisetas: H('cat-camisetas'),
  pantalones: H('cat-pantalones'), sudaderas: H('cat-sudaderas'), leggings: H('cat-leggings'), abrigos: H('cat-abrigos'),
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
// Busca un producto del catálogo por su nombre (para enlazar la foto a su ficha y mostrar su precio).
function byName(products: Product[], name: string): Product | undefined {
  const n = norm(name);
  return products.find((p) => norm(p.name) === n) || products.find((p) => norm(p.name).includes(n));
}

const HEART = 'M12 21s-7.5-4.6-10-9.4C.3 8.2 2 5 5.3 5c2 0 3.3 1.1 4.2 2.3l.5.7.5-.7C11.4 6.1 12.7 5 14.7 5 18 5 19.7 8.2 22 11.6 19.5 16.4 12 21 12 21z';
const Hs = ({ cls }: { cls?: string }) => (
  <svg className={'hs ' + (cls ?? '')} viewBox="0 0 24 24"><path d={HEART} /></svg>
);

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-tri" aria-hidden="true">
        <img src={H('hero-cuadros')} alt="" />
        <img src={H('hero-capa')} alt="" />
        <img src={H('hero-nyc')} alt="" />
      </div>
      <div className="scrim" />
      <span className="cap tl">Moda · Tendencia<br />Estilo · Actitud</span>
      <span className="cap tr">FW 25/26<br />EUREKA Editorial</span>
      <span className="cap s bl">More than a trend ♥</span>
      <span className="cap br">Looks reales<br />para días reales</span>
      <div className="hwrap">
        <div className="rule on-photo"><Hs /><span className="t">Nueva colección</span><Hs /></div>
        <h1>EUREKA<span className="script">Otoño de encanto</span></h1>
        <p className="hsub">Moda de mujer para vivir cada día, con estilo y buena vibra. Prendas seleccionadas para brillar en cualquier plan.</p>
        <div className="hcta">
          <Link href="/tienda" className="btn btn-w">Descubrir la colección</Link>
          <a href="#edit" className="btn btn-gl">Ver novedades</a>
        </div>
      </div>
    </section>
  );
}

export function Strip() {
  return (
    <div className="strip">
      <div className="wrap">
        <span className="t">Combina</span><Hs />
        <span className="t">Juega</span><span className="script">crea tu estilo</span><Hs />
        <span className="t">Un básico que nunca pasa de moda</span>
      </div>
    </div>
  );
}

export function Categories({ categories, products = [] }: { categories: Category[]; products?: Product[] }) {
  // Primero las categorías con foto real y con productos a la venta.
  const count = (slug: string) => products.filter((p) => p.category === slug).length;
  const score = (c: Category) => (CAT_PHOTO[c.slug] ? 2 : 0) + (count(c.slug) > 0 ? 1 : 0);
  const shown = [...categories].sort((a, b) => score(b) - score(a)).slice(0, 4);
  return (
    <section id="cats">
      <div className="wrap">
        <div className="sh"><span className="lab">Compra por categoría</span><h2>Explora la tienda</h2></div>
        <div className="cats">
          {shown.map((c) => (
            <Link className="catc" href={`/categoria/${c.slug}`} key={c.slug}>
              <div className="im"><img loading="lazy" src={CAT_PHOTO[c.slug] || productImg(c.image, 600, 800)} alt={c.name} /></div>
              <b>{c.name}</b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditFeature({ products = [] }: { products?: Product[] }) {
  // Fotos reales; si el producto existe en el catálogo, enlaza a su ficha y muestra su precio.
  const pick = (name: string, fallback: string) => {
    const p = byName(products, name);
    return { href: p ? `/producto/${p.id}` : fallback, price: p ? money(p.price) : null };
  };
  const big = pick('Conjunto de punto', '/categoria/punto');
  const m1 = pick('Jersey punto cuello barco', '/categoria/punto');
  const m2 = pick('Jersey básico de punto sin puño', '/categoria/punto');
  return (
    <section className="feat" id="edit">
      <div className="wrap">
        <div className="sh"><span className="script">nuestra</span><span className="lab" style={{ marginTop: -6 }}>El edit de la semana</span><h2>Selección destacada</h2></div>
        <div className="editg">
          <Link className="big" href={big.href}>
            <img src={H('edit-conjunto')} alt="Conjunto de punto en marrón chocolate" style={{ objectPosition: '50% 30%' }} />
            <span className="scap">Fashion mood ♥</span>
            <div className="capf"><span className="lab">Pieza destacada</span><h3>Conjunto de punto</h3>{big.price && <span className="pr">{big.price}</span>}</div>
          </Link>
          <div className="side">
            <Link className="mini" href={m1.href}>
              <div className="ph"><img loading="lazy" src={H('edit-barco')} alt="Jersey de punto con cuello barco en blanco roto" style={{ objectPosition: '50% 22%' }} /></div>
              <div><h4>Jersey cuello barco</h4><div className="ct">Punto · canalé</div>{m1.price && <div className="pr">{m1.price}</div>}</div>
            </Link>
            <Link className="mini" href={m2.href}>
              <div className="ph"><img loading="lazy" src={H('edit-coral')} alt="Jersey básico de punto en coral" style={{ objectPosition: '50% 22%' }} /></div>
              <div><h4>Jersey básico de punto</h4><div className="ct">Punto · cuello semicisne</div>{m2.price && <div className="pr">{m2.price}</div>}</div>
            </Link>
            <div className="allbtn"><Link href="/tienda" className="btn btn-ink" style={{ width: '100%', justifyContent: 'center' }}>Ver toda la colección</Link></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Collage() {
  const looks: [string, string, string][] = [
    ['/img/look/urbano.webp', 'Urbano', 'Cazadora de cuadros con pantalón de pinzas'],
    ['/img/look/soho-mood.webp', 'More than a trend', 'Jersey Soho New York con leggings'],
    ['/img/look/boho.webp', 'Con actitud', 'Top de rayas oversize con pantalón harén'],
  ];
  return (
    <section className="collage" id="collage">
      <div className="wrap">
        <div className="sh"><span className="script">fashion</span><span className="lab" style={{ marginTop: -4 }}>Editorial Otoño</span><h2>Looks para inspirarte</h2></div>
        <div className="cgrid">
          {looks.map(([src, label, alt]) => (
            <div className="cg" key={src}><img loading="lazy" src={src} alt={alt} style={{ objectPosition: '50% 25%' }} /><div className="t">{label}</div></div>
          ))}
        </div>
        <div className="mid"><Link href="/lookbook" className="btn btn-o">Ver el lookbook</Link></div>
      </div>
    </section>
  );
}

export function RealBand() {
  return (
    <section className="real" id="real">
      <div className="wrap">
        <div className="rule"><Hs /><span className="t">Sobre EUREKA</span><Hs /></div>
        <span className="script">para ti</span>
        <h2>Moda para mujeres reales</h2>
        <p>Creemos en las prendas que se usan de verdad: cómodas, favorecedoras y con encanto. Selección cuidada, envío rápido y trato de tú a tú.</p>
        <Link href="/tienda" className="btn btn-gold">Descubrir la tienda</Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <>
      <footer className="foot">
        <div className="wrap">
          <div className="top"><img src="/eureka-logo.png" alt="EUREKA" /><div className="script">estilo con buena vibra</div></div>
          <div className="ftop">
            <div><h4>Tienda</h4><ul><li><a href="#edit">Novedades</a></li><li><a href="#cats">Vestidos</a></li><li><a href="#cats">Punto</a></li><li><a href="#cats">Abrigos</a></li></ul></div>
            <div><h4>Ayuda</h4><ul><li><a href="/legal/condiciones">Envíos</a></li><li><a href="/legal/devoluciones">Cambios y devoluciones</a></li><li><a href="/seguimiento">Seguir pedido</a></li><li><a href="mailto:eurekamodaecija@gmail.com">Contacto</a></li></ul></div>
            <div><h4>Legal</h4><ul><li><a href="/legal/aviso-legal">Aviso legal</a></li><li><a href="/legal/privacidad">Privacidad</a></li><li><a href="/legal/condiciones">Condiciones de compra</a></li><li><a href="/legal/cookies">Cookies</a></li></ul></div>
            <div><h4>Síguenos</h4><ul><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li><li><a href="#">Pinterest</a></li></ul></div>
          </div>
          <div className="fbot"><span>© 2026 EUREKA · Tu tienda de moda</span><span><a href="/legal/aviso-legal">Aviso legal</a> · <a href="/legal/privacidad">Privacidad</a> · <a href="/legal/cookies">Cookies</a></span></div>
        </div>
      </footer>
      <div className="ne">Diseño y desarrollo web por <strong>Nodaria Tech</strong> — nodariatech.es</div>
    </>
  );
}
