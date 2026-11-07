import type { Metadata } from 'next';
import Link from 'next/link';
import { listProducts, listCategories } from '@/lib/store';
import { LOOKS, findProductByName } from '@/lib/lookbook';
import { money } from '@/lib/money';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Lookbook · EUREKA',
  description: 'Looks reales de EUREKA para inspirarte: combina nuestras prendas y compra el look completo.',
};

export default async function LookbookPage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const catSlugs = new Set(categories.map((c) => c.slug));
  return (
    <main className="page lookbook">
      <div className="wrap">
        <div className="page-head">
          <span className="script lb-script">lookbook</span>
          <h1>Looks para inspirarte</h1>
          <p>Prendas reales de nuestra tienda, combinadas como nos gusta llevarlas. Toca una prenda para verla y comprarla.</p>
        </div>

        <div className="lb-grid">
          {LOOKS.map((look, i) => (
            <article className="lb-card" id={look.slug} key={look.slug}>
              <div className="lb-ph">
                <img src={look.photo} alt={look.alt} loading={i < 3 ? 'eager' : 'lazy'} />
              </div>
              <div className="lb-body">
                <span className="lb-mood">{look.mood}</span>
                <h2>{look.title}</h2>
                <ul className="lb-pieces">
                  {look.pieces.map((pc) => {
                    const p = findProductByName(products, pc.product);
                    if (p) {
                      const href = `/producto/${p.id}${pc.color && p.colors?.includes(pc.color) ? `?color=${encodeURIComponent(pc.color)}` : ''}`;
                      return (
                        <li key={pc.label}>
                          <Link href={href}><span>{pc.label}{pc.color ? <em> · {pc.color}</em> : null}</span><b>{money(p.price)}</b></Link>
                        </li>
                      );
                    }
                    if (pc.category && catSlugs.has(pc.category)) {
                      return <li key={pc.label}><Link href={`/categoria/${pc.category}`}><span>{pc.label}</span><b className="lb-see">Ver</b></Link></li>;
                    }
                    return <li key={pc.label} className="lb-store"><span>{pc.label}{pc.color ? <em> · {pc.color}</em> : null}</span><b>En tienda</b></li>;
                  })}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="lb-foot">
          <p>¿Te gusta un look y no lo encuentras online? Pásate por nuestra tienda en Écija o escríbenos.</p>
          <Link href="/tienda" className="btn btn-gold">Ver toda la tienda</Link>
        </div>
      </div>
    </main>
  );
}
