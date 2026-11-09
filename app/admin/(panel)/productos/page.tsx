import Link from 'next/link';
import { listProducts, listCategories, hasRealPhoto, shownInShop } from '@/lib/store';
import { productImg, swatch } from '@/lib/data';
import { money } from '@/lib/money';
import type { Product } from '@/lib/types';
import { createProductQuick, importCsv, importStagedPhotos, toggleHidden } from './actions';
import BatchPhotoUpload from '@/components/admin/BatchPhotoUpload';

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

type SP = { fy?: string; m?: string; t?: string; q?: string; cat?: string; imp?: string; c?: string; u?: string; s?: string; sn?: string; borrado?: string; f?: string; fotos?: string; fa?: string; fp?: string; fn?: string; fu?: string; fx?: string };

export default async function ProductosAdmin({ searchParams }: { searchParams: SP }) {
  const [all, categories] = await Promise.all([listProducts(), listCategories()]);
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const q = (searchParams.q || '').trim().toLowerCase();
  const products = all
    .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    .filter((p) => !searchParams.cat || p.category === searchParams.cat)
    .filter((p) => searchParams.f !== 'pend' || pending(p).length > 0)
    .filter((p) => searchParams.f !== 'ocultos' || !shownInShop(p))
    .filter((p) => searchParams.f !== 'visibles' || shownInShop(p))
    .slice()
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const nPend = all.filter((p) => pending(p).length).length;
  const nHidden = all.filter((p) => !shownInShop(p)).length;
  const backUrl = '/admin/productos?' + new URLSearchParams(Object.entries({ q: searchParams.q || '', cat: searchParams.cat || '', f: searchParams.f || '' }).filter(([, v]) => v)).toString();

  return (
    <>
      <div className="adm-h">
        <div>
          <h1>Productos</h1>
          <p>{all.length} productos · {nPend ? <Link href="/admin/productos?f=pend" className="adm-link">{nPend} por completar</Link> : 'todos completos'}
            {nHidden > 0 && <> · <Link href="/admin/productos?f=ocultos" className="adm-link">{nHidden} no se ven en la tienda</Link></>}</p>
        </div>
        <div className="adm-actions">
          <a className="btn-sm ghost" href="/plantilla-productos-eureka.xlsx" download>Descargar plantilla Excel</a>
          <a className="btn-sm gold" href="#nuevo">+ Nuevo producto</a>
        </div>
      </div>

      {searchParams.imp && (
        <div className="adm-ok">
          Importación terminada: <b>{searchParams.c}</b> nuevos · <b>{searchParams.u}</b> {searchParams.m === 'f' ? 'completados' : 'actualizados'}
          {Number(searchParams.t) > 0 && <> · <b>{searchParams.t}</b> sin cambios (ya estaban bien)</>}
          {Number(searchParams.s) > 0 && <> · <b>{searchParams.s}</b> omitidos por no tener precio ({searchParams.sn})</>}.
        </div>
      )}
      {searchParams.borrado && <div className="adm-ok">Producto eliminado.</div>}
      {searchParams.fotos && (
        <div className="adm-ok">
          Fotos colocadas: <b>{searchParams.fa}</b> en <b>{searchParams.fp}</b> productos.
          {Number(searchParams.fy) > 0 && <> <b>{searchParams.fy}</b> ya estaban puestas (no se repiten).</>}
          {Number(searchParams.fn) > 0 && <> No se encontró el producto de <b>{searchParams.fn}</b>: {searchParams.fu}. Revisa que el nombre del archivo sea el del producto.</>}
          {searchParams.fx && <div style={{ marginTop: 6 }}>Avisos: {searchParams.fx}</div>}
        </div>
      )}

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
            <option value="ocultos">No se ven en la tienda</option>
            <option value="visibles">Se ven en la tienda</option>
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
                    <td className={'adm-num' + (p.stock <= 0 ? ' adm-out' : p.stock <= 3 ? ' adm-low' : '')}>
                      {p.stock}
                      {!!p.variants?.length && <div className="adm-sku" title="Stock llevado por talla y color">por talla{(() => { const n = p.variants!.filter((v) => v.stock <= 0).length; return n ? ` · ${n} agotad${n > 1 ? 'as' : 'a'}` : ''; })()}</div>}
                    </td>
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
                    <td>
                      {p.hidden ? <span className="adm-tag off">Oculto</span> : !hasRealPhoto(p) ? <span className="adm-tag off" title="Aparecerá en la tienda en cuanto tenga una foto">Oculto · sin foto</span> : !p.price ? <span className="adm-tag off" title="Aparecerá en la tienda en cuanto tenga precio">Oculto · sin precio</span> : null}
                      {pend.length ? pend.map((x) => <span key={x} className="adm-tag warn">{x}</span>) : <span className="adm-tag ok">Completo</span>}
                    </td>
                    <td><div className="adm-acts">
                      <Link className="btn-sm" href={`/admin/productos/${p.id}`}>Editar</Link>
                      <form action={toggleHidden}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="hide" value={p.hidden ? '0' : '1'} />
                        <input type="hidden" name="back" value={backUrl} />
                        <button className="btn-sm ghost" type="submit" title={p.hidden ? 'Volver a mostrar en la tienda' : 'Ocultar en la tienda (no se borra)'}>{p.hidden ? 'Mostrar' : 'Ocultar'}</button>
                      </form>
                    </div></td>
                  </tr>
                );
              })}
              {!products.length && <tr><td colSpan={9} className="adm-muted" style={{ textAlign: 'center', padding: 28 }}>No hay productos con ese filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="adm-card" id="fotos">
        <h2>Subir fotos en lote</h2>
        <p className="adm-help">
          Elige varias fotos o un <b>ZIP</b>. El <b>nombre del archivo</b> dice dónde va cada una:
          <b> Jersey peluche.jpg</b> → foto principal · <b>Jersey peluche__Amarillo.jpg</b> → foto del color Amarillo ·
          <b> Jersey peluche (2).jpg</b> → foto extra. También vale la referencia: <b>PEK-0951__Negro.jpg</b>.
          Se optimizan solas. Si un nombre no coincide con ningún producto, te lo dice y no se pierde nada.
        </p>
        <BatchPhotoUpload action={importStagedPhotos} />
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
            <label style={{ gridColumn: '1 / -1' }}>Si el producto ya está en la web
              <select name="modo" defaultValue="completar">
                <option value="completar">Solo completar lo que le falta (no toca precio, fotos, stock ni textos ya puestos)</option>
                <option value="todo">Actualizar todo con lo que diga el Excel</option>
              </select>
            </label>
            <button className="btn-sm gold" type="submit" style={{ height: 40 }}>Importar</button>
          </form>
        </div>
      </div>
    </>
  );
}
