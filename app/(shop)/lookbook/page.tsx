import type { Metadata } from 'next';
import Link from 'next/link';
import { listProducts, listCategories } from '@/lib/store';
import { LOOKS, findProductByName } from '@/lib/lookbook';
import { TITULAR } from '@/lib/legal';
import LookbookView, { type RLook } from '@/components/LookbookView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lookbook · EUREKA',
  description: 'Looks reales de EUREKA para inspirarte: combina nuestras prendas y compra el look completo.',
};

export default async function LookbookPage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const cats = new Map(categories.map((c) => [c.slug, c.name]));
  // Resuelve cada prenda del look a su producto (si existe) en el servidor.
  const looks: RLook[] = LOOKS.map((l) => ({
    slug: l.slug, title: l.title, mood: l.mood, photo: l.photo, alt: l.alt,
    pieces: l.pieces.map((pc) => {
      const p = findProductByName(products, pc.product);
      const catOk = pc.category && cats.has(pc.category);
      return {
        label: pc.label,
        color: pc.color,
        product: p,
        categoryHref: !p && catOk ? `/categoria/${pc.category}` : undefined,
        categoryName: !p && catOk ? cats.get(pc.category!) : undefined,
      };
    }),
  }));
  return (
    <main className="page lookbook">
      <div className="wrap">
        <div className="page-head">
          <span className="script lb-script">lookbook</span>
          <h1>Looks para inspirarte</h1>
          <p>Prendas reales de nuestra tienda, combinadas como nos gusta llevarlas. Toca un look o una prenda para comprarla sin salir del lookbook.</p>
        </div>
        <LookbookView looks={looks} contactEmail={TITULAR.email} />
        <div className="lb-foot">
          <p>¿Te gusta un look y no lo encuentras online? Pásate por nuestra tienda en Écija o escríbenos.</p>
          <Link href="/tienda" className="btn btn-gold">Ver toda la tienda</Link>
        </div>
      </div>
    </main>
  );
}
