import Link from 'next/link';
import { listProducts, listCategories } from '@/lib/store';
import { productImg, swatch } from '@/lib/data';
import { money } from '@/lib/money';
import type { Product } from '@/lib/types';
import { createProductQuick, importCsv } from './actions';

export const dynamic = 'force-dynamic';

const PLACEHOLDER = '26998033';

// Lo que le falta a un producto para verse profesional en la tienda.
function pending(p: Product): string[] {
  const out: string[] = [];
  if (!p.image || p.image === PLACEHOLDER) out.push('Sin foto');
  if (!p.description) out.push('Sin descripción');
  const sinFoto = (p.colors || []).filter((c) => !p.colorImages?.[c]).length;
  if (sinFoto) out.push(`${sinFoto} color${sinFoto > 1 ? 'es' : ''} sin foto`);
  return out;
}

type SP = { q?: string; cat?: string; imp?: string; c?: string; u?: string; s?: string; sn?: string; borrado?: string; f?: string };

export default async function ProductosAdmin({ searchParams }: { searchParams: SP }) {
  const [all, categories] = await Promise.all([listProducts(), listCategories()]);
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const q = (searchParams.q || '').trim().toLowerCase();
  const products = all
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    .filter((p) => !searchParams.cat || p.category === searchParams.cat)
    .filter((p) => searchParams.f !== 'pend' || pending(p).length > 0)
    .slice()
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const nPend = all.filter((p) => pending(p).length).length;

  return (
    <>
      <div className="adm-h">
        <div>
          <h1>Productos</h1>
          <p>{all.length} productos · {nPend ? <Link href="/admin/productos?f=pend" className="adm-link">{nPend} por completar</Link> : 'todos completos'}</p>
        </div>
        <div className="adm-actions">
          <a className="btn-sm ghost" href="/plantilla-productos-eureka.xlsx" download>Descargar plantilla Excel</a>
          <a className="btn-sm gold" href="#nuevo">+ Nuevo producto</a>
        </div>
      </div>

      {searchParams.imp && (
        <div className="adm-ok">
          Importación terminada: <b>{searchParams.c}</b> nuevos · <b>{searchParams.u}</b> actualizados
          {Number(searchParams.s) > 0 && <> · <b>{searchParams.s}</b> omitidos por no tener precio ({searchParams.sn})</>}.
        </div>
      )}
      {searchParams.borrado && <div className="adm-ok">Producto eliminado.</div>}

      <div className="adm-card">
        <form className="adm-filter" method="get">
          <input name="q" defaultValue={searchParams.q || ''} placeholder="Buscar por nombre o referencia…" />
          <select name="cat" defaultValue={searchParams.cat || ''}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => (<option key={c.slug} value={c.slug}>{c.name}</option>))}
          </select>
          <select name="f" defaultValue={searchParams.f || ''}>
            <option value="">Todos</option>
            <option value="pend">Por completar</option>
          </select>
          <button className="btn-sm" type="submit">Filtrar</button>
        </form>

        <div className="adm-scroll">
          <table className="adm-table adm-products">
            <thead><tr><th></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Tallas</th><th>Colores</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {products.map((p) => {
                const pend = pending(p);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/productos/${p.id}`}><img className="adm-pimg" src={productImg(p.image, 90, 120)} alt="" /></Link></td>
                    <td>
                      <Link href={`/admin/productos/${p.id}`} className="adm-pname">{p.name}</Link>
                      <div className="adm-sku">{p.sku || '—'}</div>
                    </td>
                    <td>{catName.get(p.category) || p.category}</td>
                    <td className="adm-num">{money(p.price)}</td>
                    <td className={'adm-num' + (p.stock <= 0 ? ' adm-out' : p.stock <= 3 ? ' adm-low' : '')}>{p.stock}</td>
                    <td className="adm-muted">{p.sizes?.length ? p.sizes.join(' · ') : 'Única'}</td>
                    <td>
                      <div className="adm-dots" title={(p.colors || []).join(', ')}>
                        {(p.colors || []).slice(0, 7).map((c) => (
                          <span key={c} className={'adm-dot' + (p.colorImages?.[c] ? ' has' : '')} style={{ background: swatch(c) }} />
                        ))}
                        {(p.colors?.length || 0) > 7 && <small>+{p.colors!.length - 7}</small>}
                        {!p.colors?.length && <span className="adm-muted">—</span>}
                      </div>
                    </td>
                    <td>{pend.length ? pend.map((x) => <span key={x} className="adm-tag warn">{x}</span>) : <span className="adm-tag ok">Completo</span>}</td>
                    <td><Link className="btn-sm" href={`/admin/productos/${p.id}`}>Editar</Link></td>
                  </tr>
                );
              })}
              {!products.length && <tr><td colSpan={9} className="adm-muted" style={{ textAlign: 'center', padding: 28 }}>No hay productos con ese filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-two">
        <div className="adm-card" id="nuevo">
          <h2>Nuevo producto</h2>
          <p className="adm-help">Pon lo básico y pulsa Crear: se abre su ficha para añadir fotos, tallas, colores y descripción.</p>
          <form action={createProductQuick} className="adm-form">
            <label style={{ gridColumn: '1 / -1' }}>Nombre<input name="name" required placeholder="Jersey básico de punto" /></label>
            <label>Categoría
              <select name="category" defaultValue={categories[0]?.slug}>
                {categories.map((c) => (<option key={c.slug} value={c.slug}>{c.name}</option>))}
              </select>
            </label>
            <label>Precio (€)<input name="price" required inputMode="decimal" placeholder="19,90" /></label>
            <label>Stock inicial<input name="stock" type="number" min={0} defaultValue={0} /></label>
            <button className="btn-sm gold" type="submit" style={{ height: 40 }}>Crear y completar ficha</button>
          </form>
        </div>

        <div className="adm-card">
          <h2>Importar desde Excel</h2>
          <p className="adm-help">
            Usa la <a className="adm-link" href="/plantilla-productos-eureka.xlsx" download>plantilla EUREKA</a>: una fila por producto, con sus
            <b> tallas</b> y <b>colores</b> separados por comas. No duplica: si el producto ya existe (mismo nombre o referencia) lo actualiza.
            El stock del Excel solo se usa al dar de alta; después lo lleva FacturaScripts.
          </p>
          <form action={importCsv} className="adm-form">
            <label style={{ gridColumn: '1 / -1' }}>Archivo (.xlsx o .csv)
              <input name="file" type="file" accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
            </label>
            <button className="btn-sm gold" type="submit" style={{ height: 40 }}>Importar</button>
          </form>
        </div>
      </div>
    </>
  );
}
