// Cuerpo de la portada: pinta los bloques en el orden y con la visibilidad elegidos en el panel.
// Lo usan la web pública (app/(shop)/page.tsx) y la vista previa en directo del editor.
import ProductRail from './ProductRail';
import Newsletter from './Newsletter';
import { Hero, Strip, Categories, EditFeature, Collage, RealBand } from './Sections';
import type { Category, Product } from '@/lib/types';
import { SECTION_NAMES, type SectionId, type SiteContent } from '@/lib/site-content';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
const realImg = (img: string) => /^(\/media\/|\/uploads\/|\/img\/|https?:)/.test(img || '');

// Novedades: automático (con foto real y stock primero, luego lo más reciente) o elegido a mano.
// Nunca repite una prenda: si hay dos fichas con el mismo nombre, sale solo una.
export function railProducts(products: Product[], c: SiteContent['rail']): Product[] {
  const list = c.mode === 'manual'
    ? c.ids.map((id) => products.find((p) => p.id === id)).filter((p): p is Product => !!p)
    : [...products].sort((a, b) =>
        (Number(realImg(b.image)) - Number(realImg(a.image))) || (Number(b.stock > 0) - Number(a.stock > 0)) ||
        (b.updatedAt || '').localeCompare(a.updatedAt || ''));
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

export default function HomeBody({ c, products, categories, mark = false }: { c: SiteContent; products: Product[]; categories: Category[]; mark?: boolean }) {
  const render = (id: SectionId) => {
    switch (id) {
      case 'hero': return <Hero c={c.hero} />;
      case 'strip': return <Strip c={c.strip} />;
      case 'cats': return <Categories c={c.cats} categories={categories} products={products} />;
      case 'edit': return <EditFeature c={c.edit} products={products} />;
      case 'rail': { const r = railProducts(products, c.rail); return r.length ? <ProductRail products={r} label={c.rail.label} title={c.rail.title} /> : null; }
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
