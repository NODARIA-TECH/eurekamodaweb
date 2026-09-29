import Link from 'next/link';
import { CATEGORIES, pexels } from '@/lib/data';

const HEART = 'M12 21s-7.5-4.6-10-9.4C.3 8.2 2 5 5.3 5c2 0 3.3 1.1 4.2 2.3l.5.7.5-.7C11.4 6.1 12.7 5 14.7 5 18 5 19.7 8.2 22 11.6 19.5 16.4 12 21 12 21z';
const Hs = ({ cls }: { cls?: string }) => (
  <svg className={'hs ' + (cls ?? '')} viewBox="0 0 24 24"><path d={HEART} /></svg>
);

export function Hero() {
  return (
    <section className="hero">
      <img src={pexels('11332385', 1800, 1200)} alt="Editorial EUREKA Otoño 2026" />
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

export function Categories() {
  return (
    <section id="cats">
      <div className="wrap">
        <div className="sh"><span className="lab">Compra por categoría</span><h2>Explora la tienda</h2></div>
        <div className="cats">
          {CATEGORIES.map((c) => (
            <Link className="catc" href={`/categoria/${c.slug}`} key={c.slug}>
              <div className="im"><img src={pexels(c.img, 600, 800)} alt={c.name} /></div>
              <b>{c.name}</b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditFeature() {
  return (
    <section className="feat" id="edit">
      <div className="wrap">
        <div className="sh"><span className="script">nuestra</span><span className="lab" style={{ marginTop: -6 }}>El edit de la semana</span><h2>Selección destacada</h2></div>
        <div className="editg">
          <Link className="big" href="/categoria/abrigos">
            <img src={pexels('37647057', 1000, 1200)} alt="Abrigo paño largo" />
            <span className="scap">Fashion mood ♥</span>
            <div className="capf"><span className="lab">Pieza destacada</span><h3>Abrigo paño largo</h3><span className="pr">69,95 €</span></div>
          </Link>
          <div className="side">
            <Link className="mini" href="/producto/p2">
              <div className="ph"><img src={pexels('15481010', 400, 520)} alt="" /></div>
              <div><h4>Vestido midi entallado</h4><div className="ct">Vestidos</div><div className="pr">39,95 €</div></div>
            </Link>
            <Link className="mini" href="/producto/p5">
              <div className="ph"><img src={pexels('1075776', 400, 520)} alt="" /></div>
              <div><h4>Jersey punto oversize</h4><div className="ct">Punto</div><div className="pr">32,00 €</div></div>
            </Link>
            <div className="allbtn"><Link href="/tienda" className="btn btn-ink" style={{ width: '100%', justifyContent: 'center' }}>Ver toda la colección</Link></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Collage() {
  const looks: [string, string][] = [['34519173', 'Urbano'], ['38159353', 'More than a trend'], ['20862358', 'Noche']];
  return (
    <section className="collage" id="collage">
      <div className="wrap">
        <div className="sh"><span className="script">fashion</span><span className="lab" style={{ marginTop: -4 }}>Editorial Otoño</span><h2>Looks para inspirarte</h2></div>
        <div className="cgrid">
          {looks.map(([id, label]) => (
            <div className="cg" key={id}><img src={pexels(id, 600, 880)} alt={label} /><div className="t">{label}</div></div>
          ))}
        </div>
        <div className="mid"><Link href="/tienda" className="btn btn-o">Ver el lookbook</Link></div>
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
            <div><h4>Ayuda</h4><ul><li><a href="#">Envíos</a></li><li><a href="#">Cambios</a></li><li><a href="#">Guía de tallas</a></li><li><a href="#">Contacto</a></li></ul></div>
            <div><h4>EUREKA</h4><ul><li><a href="#collage">Editorial</a></li><li><a href="#real">Nosotras</a></li><li><a href="#nl">Club</a></li></ul></div>
            <div><h4>Síguenos</h4><ul><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li><li><a href="#">Pinterest</a></li></ul></div>
          </div>
          <div className="fbot"><span>© 2026 EUREKA · Tu tienda de moda</span><span>Aviso legal · Privacidad · Cookies</span></div>
        </div>
      </footer>
      <div className="ne">Diseño y desarrollo web por <strong>Nodaria Tech</strong> — nodariatech.es</div>
    </>
  );
}
