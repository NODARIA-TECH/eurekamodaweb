import type { Metadata } from 'next';
import Link from 'next/link';
import ProductGrid from '@/components/ProductGrid';
import { listProducts, listCategories } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tienda · EUREKA' };

type SP = { q?: string; cat?: string; sort?: string };

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default async function TiendaPage({ searchParams }: { searchParams: SP }) {
  const [all, categories] = await Promise.all([listProducts(), listCategories()]);
  const q = (searchParams.q || '').trim();
  const cat = (searchParams.cat || '').trim();
  const sort = (searchParams.sort || '').trim();

  let products = all;
  if (cat) products = products.filter((p) => p.category === cat);
  if (q) {
    const nq = norm(q);
    products = products.filter((p) => norm(p.name).includes(nq) || norm(p.category).includes(nq));
  }
  if (sort === 'precio-asc') products = [...products].sort((a, b) => a.price - b.price);
  else if (sort === 'precio-desc') products = [...products].sort((a, b) => b.price - a.price);
  else if (sort === 'nombre') products = [...products].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // conservar filtros al cambiar de chip/orden
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { q, cat, sort, ...over };
    if (merged.q) p.set('q', merged.q);
    if (merged.cat) p.set('cat', merged.cat);
    if (merged.sort) p.set('sort', merged.sort);
    const s = p.toString();
    return '/tienda' + (s ? '?' + s : '');
  };

  return (
    <main className="page">
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Toda la colección</span>
          <h1>Tienda</h1>
          <p>{products.length} {products.length === 1 ? 'prenda' : 'prendas'}{q ? ` · “${q}”` : ''}</p>
        </div>

        <form className="shopbar" action="/tienda" method="get">
          {cat && <input type="hidden" name="cat" value={cat} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          <div className="search">
            <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>
            <input name="q" defaultValue={q} placeholder="Buscar prendas…" autoComplete="off" />
          </div>
          <button className="btn-search" type="submit">Buscar</button>
        </form>

        <div className="chips">
          <Link className={'chip' + (!cat ? ' on' : '')} href={qs({ cat: '' })}>Todo</Link>
          {categories.map((c) => (
            <Link key={c.slug} className={'chip' + (cat === c.slug ? ' on' : '')} href={qs({ cat: c.slug })}>
              {c.name}
            </Link>
          ))}
        </div>

        <div className="sortbar">
          <span>Ordenar:</span>
          <Link className={'sortlink' + (!sort ? ' on' : '')} href={qs({ sort: '' })}>Destacados</Link>
          <Link className={'sortlink' + (sort === 'precio-asc' ? ' on' : '')} href={qs({ sort: 'precio-asc' })}>Precio ↑</Link>
          <Link className={'sortlink' + (sort === 'precio-desc' ? ' on' : '')} href={qs({ sort: 'precio-desc' })}>Precio ↓</Link>
          <Link className={'sortlink' + (sort === 'nombre' ? ' on' : '')} href={qs({ sort: 'nombre' })}>A–Z</Link>
        </div>

        {products.length === 0 ? (
          <div className="empty">
            <p>No encontramos prendas con esos filtros.</p>
            <Link className="btn" href="/tienda">Ver toda la colección</Link>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </main>
  );
}
