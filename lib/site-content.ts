// Contenido editable de la página de inicio (lo edita la clienta en /admin/pagina).
// Este archivo es compartido por servidor y navegador: tipos, valores por defecto y saneado.
// El guardado en disco vive en lib/site-store.ts.

export type SectionId = 'hero' | 'strip' | 'cats' | 'edit' | 'rail' | 'collage' | 'real' | 'news';

export interface SImg { src: string; x: number; y: number; alt: string }   // x/y = punto de foco en %
export interface SLink { label: string; href: string }
export interface SPick { productId: string; img: SImg; script: string; tag: string; name: string; sub: string; href: string }

export interface SiteContent {
  promo: { show: boolean; text: string };
  sections: { id: SectionId; show: boolean }[];
  hero: {
    images: SImg[]; mobile: number; shade: number;
    capTL: string; capTR: string; capBL: string; capBR: string;
    kicker: string; title: string; script: string; sub: string; cta1: SLink; cta2: SLink;
  };
  strip: { items: { text: string; script: boolean }[] };
  cats: { label: string; title: string; items: { slug: string; img: SImg | null }[] };
  edit: { script: string; label: string; title: string; big: SPick; minis: SPick[]; btn: SLink };
  rail: { label: string; title: string; mode: 'auto' | 'manual'; ids: string[]; max: number };
  collage: { script: string; label: string; title: string; items: { img: SImg; label: string; href: string }[]; btn: SLink };
  real: { kicker: string; script: string; title: string; text: string; btn: SLink };
  news: { script: string; title: string; text: string };
}

export const SECTION_NAMES: Record<SectionId, string> = {
  hero: 'Portada (foto grande)',
  strip: 'Franja de frases',
  cats: 'Categorías',
  edit: 'Selección destacada',
  rail: 'Novedades',
  collage: 'Looks para inspirarte',
  real: 'Sobre EUREKA',
  news: 'Club EUREKA (newsletter)',
};
const ALL_SECTIONS = Object.keys(SECTION_NAMES) as SectionId[];

const H = (f: string) => `/img/home/${f}.webp`;
// Foto por defecto de cada categoría en la portada.
export const CAT_PHOTO: Record<string, string> = {
  punto: H('cat-punto'), camisas: H('cat-camisas'), camisetas: H('cat-camisetas'),
  pantalones: H('cat-pantalones'), sudaderas: H('cat-sudaderas'), leggings: H('cat-leggings'), abrigos: H('cat-abrigos'),
};

const img = (src: string, alt = '', x = 50, y = 25): SImg => ({ src, x, y, alt });

export const DEFAULT_CONTENT: SiteContent = {
  promo: { show: true, text: 'Envío **gratis** a partir de 50 € · Devoluciones rápidas y sencillas' },
  sections: ALL_SECTIONS.map((id) => ({ id, show: true })),
  hero: {
    images: [
      img(H('hero-cuadros'), 'Cazadora de cuadros', 50, 20),
      img(H('hero-capa'), 'Capa de estampado animal', 50, 20),
      img(H('hero-nyc'), 'Jersey NYC', 50, 20),
    ],
    mobile: 1, shade: 45,
    capTL: 'Moda · Tendencia\nEstilo · Actitud', capTR: 'FW 25/26\nEUREKA Editorial',
    capBL: 'More than a trend ♥', capBR: 'Looks reales\npara días reales',
    kicker: 'Nueva colección', title: 'EUREKA', script: 'Otoño de encanto',
    sub: 'Moda de mujer para vivir cada día, con estilo y buena vibra. Prendas seleccionadas para brillar en cualquier plan.',
    cta1: { label: 'Descubrir la colección', href: '/tienda' },
    cta2: { label: 'Ver novedades', href: '#edit' },
  },
  strip: { items: [
    { text: 'Combina', script: false }, { text: 'Juega', script: false },
    { text: 'crea tu estilo', script: true }, { text: 'Un básico que nunca pasa de moda', script: false },
  ] },
  cats: { label: 'Compra por categoría', title: 'Explora la tienda', items: [] },
  edit: {
    script: 'nuestra', label: 'El edit de la semana', title: 'Selección destacada',
    big: { productId: '', img: img(H('edit-conjunto'), 'Conjunto de punto en marrón chocolate', 50, 30), script: 'Fashion mood ♥', tag: 'Pieza destacada', name: 'Conjunto de punto', sub: '', href: '/categoria/punto' },
    minis: [
      { productId: '', img: img(H('edit-barco'), 'Jersey de punto con cuello barco en blanco roto', 50, 22), script: '', tag: '', name: 'Jersey cuello barco', sub: 'Punto · canalé', href: '/categoria/punto' },
      { productId: '', img: img(H('edit-coral'), 'Jersey básico de punto en coral', 50, 22), script: '', tag: '', name: 'Jersey básico de punto', sub: 'Punto · cuello semicisne', href: '/categoria/punto' },
    ],
    btn: { label: 'Ver toda la colección', href: '/tienda' },
  },
  rail: { label: 'Recién llegado', title: 'Novedades', mode: 'auto', ids: [], max: 12 },
  collage: {
    script: 'fashion', label: 'Editorial Otoño', title: 'Looks para inspirarte',
    items: [
      { img: img('/img/look/saten-verde.webp', 'Blusa satinada verde militar con pantalón de pinzas'), label: 'Satén y color', href: '/lookbook' },
      { img: img('/img/look/soho-mood.webp', 'Jersey Soho New York con leggings'), label: 'More than a trend', href: '/lookbook' },
      { img: img('/img/look/boho.webp', 'Top de rayas oversize con pantalón harén'), label: 'Con actitud', href: '/lookbook' },
    ],
    btn: { label: 'Ver el lookbook', href: '/lookbook' },
  },
  real: {
    kicker: 'Sobre EUREKA', script: 'para ti', title: 'Moda para mujeres reales',
    text: 'Creemos en las prendas que se usan de verdad: cómodas, favorecedoras y con encanto. Selección cuidada, envío rápido y trato de tú a tú.',
    btn: { label: 'Descubrir la tienda', href: '/tienda' },
  },
  news: { script: 'únete al', title: 'Club EUREKA · 20% de bienvenida', text: 'Suscríbete y recibe tu descuento, además de acceso anticipado a novedades y rebajas.' },
};

// ---------- Saneado: todo lo que llega del navegador pasa por aquí ----------
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, def: string, max = 240) => (typeof v === 'string' ? v.replace(/\r/g, '').slice(0, max) : def);
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
const num = (v: unknown, def: number, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : def);

// Solo rutas propias o https (nada de javascript:, data:, etc.).
export function safeSrc(v: unknown, def = ''): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (/^\/(img|media|uploads)\/[\w\-./%]+$/.test(s) && !s.includes('..')) return s;
  if (/^https:\/\/[^\s"'<>]+$/.test(s)) return s;
  return def;
}
export function safeHref(v: unknown, def = '/'): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return def;
  if (/^(\/(?!\/)|#)[^\s"'<>]*$/.test(s)) return s;
  if (/^(https:\/\/|mailto:|tel:)[^\s"'<>]+$/.test(s)) return s;
  return def;
}

function nImg(v: unknown, def: SImg): SImg {
  const o = obj(v);
  return { src: safeSrc(o.src, def.src), x: num(o.x, def.x, 0, 100), y: num(o.y, def.y, 0, 100), alt: str(o.alt, def.alt, 160) };
}
function nLink(v: unknown, def: SLink): SLink {
  const o = obj(v);
  return { label: str(o.label, def.label, 60), href: safeHref(o.href, def.href) };
}
function nPick(v: unknown, def: SPick): SPick {
  const o = obj(v);
  return {
    productId: str(o.productId, def.productId, 80), img: nImg(o.img, def.img),
    script: str(o.script, def.script, 60), tag: str(o.tag, def.tag, 60), name: str(o.name, def.name, 90),
    sub: str(o.sub, def.sub, 90), href: safeHref(o.href, def.href),
  };
}

export function normalizeContent(raw: unknown): SiteContent {
  const d = DEFAULT_CONTENT;
  const r = obj(raw);
  const promo = obj(r.promo), hero = obj(r.hero), strip = obj(r.strip), cats = obj(r.cats), edit = obj(r.edit);
  const rail = obj(r.rail), col = obj(r.collage), real = obj(r.real), news = obj(r.news);

  // Bloques: todos presentes una sola vez, en el orden elegido.
  const seen = new Set<SectionId>();
  const sections: SiteContent['sections'] = [];
  for (const s of arr(r.sections)) {
    const o = obj(s);
    const id = o.id as SectionId;
    if (ALL_SECTIONS.includes(id) && !seen.has(id)) { seen.add(id); sections.push({ id, show: bool(o.show, true) }); }
  }
  for (const id of ALL_SECTIONS) if (!seen.has(id)) sections.push({ id, show: true });

  const heroImgs = (Array.isArray(hero.images) ? hero.images : d.hero.images).slice(0, 3)
    .map((v, i) => nImg(v, d.hero.images[i] || d.hero.images[0])).filter((i) => i.src);
  const images = heroImgs.length ? heroImgs : d.hero.images;

  const minisRaw = Array.isArray(edit.minis) ? edit.minis : d.edit.minis;
  const colRaw = Array.isArray(col.items) ? col.items : d.collage.items;
  const stripRaw = Array.isArray(strip.items) ? strip.items : d.strip.items;

  return {
    promo: { show: bool(promo.show, d.promo.show), text: str(promo.text, d.promo.text, 200) },
    sections,
    hero: {
      images, mobile: num(hero.mobile, d.hero.mobile, 0, images.length - 1), shade: num(hero.shade, d.hero.shade, 0, 85),
      capTL: str(hero.capTL, d.hero.capTL, 80), capTR: str(hero.capTR, d.hero.capTR, 80),
      capBL: str(hero.capBL, d.hero.capBL, 80), capBR: str(hero.capBR, d.hero.capBR, 80),
      kicker: str(hero.kicker, d.hero.kicker, 60), title: str(hero.title, d.hero.title, 40), script: str(hero.script, d.hero.script, 60),
      sub: str(hero.sub, d.hero.sub, 300), cta1: nLink(hero.cta1, d.hero.cta1), cta2: nLink(hero.cta2, d.hero.cta2),
    },
    strip: { items: stripRaw.slice(0, 8).map((v) => { const o = obj(v); return { text: str(o.text, '', 60), script: bool(o.script, false) }; }).filter((i) => i.text.trim()) },
    cats: {
      label: str(cats.label, d.cats.label, 60), title: str(cats.title, d.cats.title, 80),
      items: arr(cats.items).slice(0, 8).map((v) => {
        const o = obj(v);
        const im = o.img ? nImg(o.img, img('')) : null;
        return { slug: str(o.slug, '', 80), img: im && im.src ? im : null };
      }).filter((i) => i.slug),
    },
    edit: {
      script: str(edit.script, d.edit.script, 40), label: str(edit.label, d.edit.label, 60), title: str(edit.title, d.edit.title, 80),
      big: nPick(edit.big, d.edit.big),
      minis: minisRaw.slice(0, 2).map((v, i) => nPick(v, d.edit.minis[i] || d.edit.minis[0])),
      btn: nLink(edit.btn, d.edit.btn),
    },
    rail: {
      label: str(rail.label, d.rail.label, 60), title: str(rail.title, d.rail.title, 80),
      mode: rail.mode === 'manual' ? 'manual' : 'auto',
      ids: arr(rail.ids).filter((x): x is string => typeof x === 'string').slice(0, 24),
      max: num(rail.max, d.rail.max, 4, 24),
    },
    collage: {
      script: str(col.script, d.collage.script, 40), label: str(col.label, d.collage.label, 60), title: str(col.title, d.collage.title, 80),
      items: colRaw.slice(0, 3).map((v, i) => {
        const o = obj(v); const def = d.collage.items[i] || d.collage.items[0];
        return { img: nImg(o.img, def.img), label: str(o.label, def.label, 50), href: safeHref(o.href, '') };
      }),
      btn: nLink(col.btn, d.collage.btn),
    },
    real: {
      kicker: str(real.kicker, d.real.kicker, 60), script: str(real.script, d.real.script, 40), title: str(real.title, d.real.title, 80),
      text: str(real.text, d.real.text, 500), btn: nLink(real.btn, d.real.btn),
    },
    news: { script: str(news.script, d.news.script, 40), title: str(news.title, d.news.title, 80), text: str(news.text, d.news.text, 300) },
  };
}

export const sameContent = (a: SiteContent, b: SiteContent) => JSON.stringify(a) === JSON.stringify(b);
