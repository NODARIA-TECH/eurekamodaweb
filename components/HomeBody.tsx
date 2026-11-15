// Cuerpo de la portada: pinta los bloques en el orden y con la visibilidad elegidos en el panel.
// Lo usan la web pública (app/(shop)/page.tsx) y la vista previa en directo del editor.
import ProductRail from './ProductRail';
import Newsletter from './Newsletter';
import { Hero, Strip, Categories, EditFeature, Collage, RealBand } from './Sections';
import type { Category, Product } from '@/lib/types';
import { SECTION_NAMES, type SectionId, type SiteContent } from '@/lib/site-content';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const realImg = (img: string) => /^(\/media\/|\/uploads\/|\/img\/|https?:)/.test(img || '');

// Novedades: automático o elegido a mano. En automático: primero lo NUEVO (dado de alta en las
// últimas semanas y con stock) en orden aleatorio —cambia en cada visita—, después el resto del más
// reciente al más antiguo, y lo agotado al final. Nunca repite una prenda (mismo nombre = una sola).
export const NUEVO_DIAS = 21;
const fecha = (p: Product) => Date.parse(p.createdAt || p.updatedAt || '') || 0;
function barajar<T>(list: T[], seed: number): T[] {
  let s = (seed >>> 0) || 1;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function railProducts(products: Product[], c: SiteContent['rail'], seed = 1): Product[] {
  let list: Product[];
  if (c.mode === 'manual') {
    list = c.ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  } else {
    const limite = Date.now() - NUEVO_DIAS * 864e5;
    const conFoto = products.filter((p) => realImg(p.image));
    const esNuevo = (p: Product) => p.stock > 0 && fecha(p) >= limite;
    const nuevos = barajar(conFoto.filter(esNuevo), seed).map((p) => (p.badge ? p : { ...p, badge: 'Nuevo' }));
    const resto = conFoto.filter((p) => !esNuevo(p)).sort((a, b) => (Number(b.stock > 0) - Number(a.stock > 0)) || (fecha(b) - fecha(a)));
    const sinFoto = products.filter((p) => !realImg(p.image)).sort((a, b) => fecha(b) - fecha(a));
    list = [...nuevos, ...resto, ...sinFoto];
  }
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of list) {
    const k = norm(p.name);
    if (seen.has(k) || seen.has(p.id)) continue;
    seen.add(k); seen.add(p.id);
    out.push(p);
  }
  return c.mode === 'manual' ? out : out.slice(0, c.max);
}

export default function HomeBody({ c, products, categories, mark = false, seed = 1 }: { c: SiteContent; products: Product[]; categories: Category[]; mark?: boolean; seed?: number }) {
  const render = (id: SectionId) => {
    switch (id) {
      case 'hero': return <Hero c={c.hero} />;
      case 'strip': return <Strip c={c.strip} />;
      case 'cats': return <Categories c={c.cats} categories={categories} products={products} />;
      case 'edit': return <EditFeature c={c.edit} products={products} />;
      case 'rail': { const r = railProducts(products, c.rail, seed); return r.length ? <ProductRail products={r} label={c.rail.label} title={c.rail.title} /> : null; }
      case 'collage': return <Collage c={c.collage} />;
      case 'real': return <RealBand c={c.real} />;
      case 'news': return <Newsletter c={c.news} />;
    }
  };
  return (
    <>
      {c.sections.filter((s) => s.show).map((s) =>
        mark ? <div key={s.id} data-sec={s.id} data-label={SECTION_NAMES[s.id]} className="pv-sec">{render(s.id)}</div> : <div key={s.id} style={{ display: 'contents' }}>{render(s.id)}</div>,
      )}
    </>
  );
}
