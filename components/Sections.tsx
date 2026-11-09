import Link from 'next/link';
import { Fragment } from 'react';
import { productImg } from '@/lib/data';
import { money } from '@/lib/money';
import type { Category, Product } from '@/lib/types';
import { CAT_PHOTO, type SImg, type SPick, type SiteContent } from '@/lib/site-content';

const HEART = 'M12 21s-7.5-4.6-10-9.4C.3 8.2 2 5 5.3 5c2 0 3.3 1.1 4.2 2.3l.5.7.5-.7C11.4 6.1 12.7 5 14.7 5 18 5 19.7 8.2 22 11.6 19.5 16.4 12 21 12 21z';
const Hs = ({ cls }: { cls?: string }) => (
  <svg className={'hs ' + (cls ?? '')} viewBox="0 0 24 24"><path d={HEART} /></svg>
);

// Bloques de la portada. El contenido (textos, fotos, enlaces) viene de lib/site-content.ts
// y lo edita la clienta en el panel (/admin/pagina).
const pos = (i: SImg) => ({ objectPosition: `${i.x}% ${i.y}%` });
// Saltos de línea escritos en el panel → <br />
export function Lines({ text }: { text: string }) {
  const parts = text.split('\n');
  return <>{parts.map((t, i) => <Fragment key={i}>{i > 0 && <br />}{t}</Fragment>)}</>;
}
// Enlace interno (Link) o externo (<a>), según la dirección.
function Go({ href, className, style, children }: { href: string; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return <a href={href} className={className} style={style}>{children}</a>;
  return <Link href={href || '/'} className={className} style={style}>{children}</Link>;
}

export function Hero({ c }: { c: SiteContent['hero'] }) {
  const n = c.images.length;
  const a = c.shade / 100;
  return (
    <section className="hero">
      <div className={'hero-tri n' + n} aria-hidden="true">
        {c.images.map((im, i) => <img key={i} src={im.src} alt="" className={i === c.mobile ? 'mob' : undefined} style={pos(im)} />)}
      </div>
      <div className="scrim" style={{ background: `linear-gradient(to bottom,rgba(40,32,22,${(a * 0.93).toFixed(2)}),rgba(40,32,22,${(a * 0.67).toFixed(2)}) 45%,rgba(40,32,22,${Math.min(0.95, a * 1.29).toFixed(2)}))` }} />
      {c.capTL && <span className="cap tl"><Lines text={c.capTL} /></span>}
      {c.capTR && <span className="cap tr"><Lines text={c.capTR} /></span>}
      {c.capBL && <span className="cap s bl"><Lines text={c.capBL} /></span>}
      {c.capBR && <span className="cap br"><Lines text={c.capBR} /></span>}
      <div className="hwrap">
        {c.kicker && <div className="rule on-photo"><Hs /><span className="t">{c.kicker}</span><Hs /></div>}
        <h1>{c.title}{c.script && <span className="script">{c.script}</span>}</h1>
        {c.sub && <p className="hsub">{c.sub}</p>}
        <div className="hcta">
          {c.cta1.label && <Go href={c.cta1.href} className="btn btn-w">{c.cta1.label}</Go>}
          {c.cta2.label && <Go href={c.cta2.href} className="btn btn-gl">{c.cta2.label}</Go>}
        </div>
      </div>
    </section>
  );
}

export function Strip({ c }: { c: SiteContent['strip'] }) {
  if (!c.items.length) return null;
  return (
    <div className="strip">
      <div className="wrap">
        {c.items.map((it, i) => (
          <Fragment key={i}>
            {it.script ? <span className="script">{it.text}</span> : <span className="t">{it.text}</span>}
            {i < c.items.length - 1 && !c.items[i + 1].script && <Hs />}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function Categories({ c, categories, products = [] }: { c: SiteContent['cats']; categories: Category[]; products?: Product[] }) {
  let shown: { cat: Category; src: string; style?: React.CSSProperties }[];
  if (c.items.length) {
    // Elegidas a mano en el panel, en su orden.
    shown = c.items.flatMap((it) => {
      const cat = categories.find((x) => x.slug === it.slug);
      if (!cat) return [];
      return [{ cat, src: it.img?.src || CAT_PHOTO[cat.slug] || productImg(cat.image, 600, 800), style: it.img ? pos(it.img) : undefined }];
    });
  } else {
    // Automático: primero las que tienen foto real y productos a la venta.
    const count = (slug: string) => products.filter((p) => p.category === slug).length;
    const score = (x: Category) => (CAT_PHOTO[x.slug] ? 2 : 0) + (count(x.slug) > 0 ? 1 : 0);
    shown = [...categories].sort((a, b) => score(b) - score(a)).slice(0, 4)
      .map((cat) => ({ cat, src: CAT_PHOTO[cat.slug] || productImg(cat.image, 600, 800) }));
  }
  if (!shown.length) return null;
  return (
    <section id="cats">
      <div className="wrap">
        <div className="sh">{c.label && <span className="lab">{c.label}</span>}<h2>{c.title}</h2></div>
        <div className="cats">
          {shown.map(({ cat, src, style }) => (
            <Link className="catc" href={`/categoria/${cat.slug}`} key={cat.slug}>
              <div className="im"><img loading="lazy" src={src} alt={cat.name} style={style} /></div>
              <b>{cat.name}</b>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// Una pieza de "Selección destacada": si está enlazada a un producto, lleva a su ficha y muestra su precio.
function resolvePick(pk: SPick, products: Product[]) {
  const p = pk.productId ? products.find((x) => x.id === pk.productId) : undefined;
  return { href: p ? `/producto/${p.id}` : pk.href || '/tienda', price: p ? money(p.price) : null, name: pk.name || p?.name || '' };
}

export function EditFeature({ c, products = [] }: { c: SiteContent['edit']; products?: Product[] }) {
  const big = resolvePick(c.big, products);
  return (
    <section className="feat" id="edit">
      <div className="wrap">
        <div className="sh">{c.script && <span className="script">{c.script}</span>}{c.label && <span className="lab" style={{ marginTop: -6 }}>{c.label}</span>}<h2>{c.title}</h2></div>
        <div className="editg">
          <Go className="big" href={big.href}>
            <img src={c.big.img.src} alt={c.big.img.alt || big.name} style={pos(c.big.img)} />
            {c.big.script && <span className="scap">{c.big.script}</span>}
            <div className="capf">{c.big.tag && <span className="lab">{c.big.tag}</span>}<h3>{big.name}</h3>{big.price && <span className="pr">{big.price}</span>}</div>
          </Go>
          <div className="side">
            {c.minis.map((m, i) => {
              const r = resolvePick(m, products);
              return (
                <Go className="mini" href={r.href} key={i}>
                  <div className="ph"><img loading="lazy" src={m.img.src} alt={m.img.alt || r.name} style={pos(m.img)} /></div>
                  <div><h4>{r.name}</h4>{m.sub && <div className="ct">{m.sub}</div>}{r.price && <div className="pr">{r.price}</div>}</div>
                </Go>
              );
            })}
            {c.btn.label && <div className="allbtn"><Go href={c.btn.href} className="btn btn-ink" style={{ width: '100%', justifyContent: 'center' }}>{c.btn.label}</Go></div>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Collage({ c }: { c: SiteContent['collage'] }) {
  return (
    <section className="collage" id="collage">
      <div className="wrap">
        <div className="sh">{c.script && <span className="script">{c.script}</span>}{c.label && <span className="lab" style={{ marginTop: -4 }}>{c.label}</span>}<h2>{c.title}</h2></div>
        <div className="cgrid">
          {c.items.map((it, i) => {
            const inner = <><img loading="lazy" src={it.img.src} alt={it.img.alt} style={pos(it.img)} />{it.label && <div className="t">{it.label}</div>}</>;
            return it.href ? <Go className="cg" href={it.href} key={i}>{inner}</Go> : <div className="cg" key={i}>{inner}</div>;
          })}
        </div>
        {c.btn.label && <div className="mid"><Go href={c.btn.href} className="btn btn-o">{c.btn.label}</Go></div>}
      </div>
    </section>
  );
}

export function RealBand({ c }: { c: SiteContent['real'] }) {
  return (
    <section className="real" id="real">
      <div className="wrap">
        {c.kicker && <div className="rule"><Hs /><span className="t">{c.kicker}</span><Hs /></div>}
        {c.script && <span className="script">{c.script}</span>}
        <h2>{c.title}</h2>
        {c.text && <p>{c.text}</p>}
        {c.btn.label && <Go href={c.btn.href} className="btn btn-gold">{c.btn.label}</Go>}
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
