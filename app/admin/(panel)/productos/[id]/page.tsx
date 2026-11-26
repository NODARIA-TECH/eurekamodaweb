import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, listCategories, historialStock } from '@/lib/store';
import { productImg, productPath } from '@/lib/data';
import VariantEditor from '@/components/admin/VariantEditor';
import ConfirmSubmit from '@/components/admin/ConfirmSubmit';
import { saveProduct, removeProduct, createZoom, removeColorExtras, toggleHidden } from '../actions';
import { hasRealPhoto, shownInShop } from '@/lib/store';
import ZoomCropper from '@/components/admin/ZoomCropper';
import PhotoUploader from '@/components/admin/PhotoUploader';

export const dynamic = 'force-dynamic';

const PLACEHOLDER = '26998033';

export default async function EditProduct({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; nuevo?: string; zok?: string; zerr?: string; ferr?: string; fs?: string; fsd?: string; fsp?: string } }) {
  const [p, categories] = await Promise.all([getProduct(params.id), listCategories()]);
  const histStock = p ? await historialStock(p.id, 15) : [];
  if (!p) notFound();
  const gallery = [p.image, ...(p.images || [])].filter((x) => x && x !== PLACEHOLDER);

  return (
    <>
      <div className="adm-h">
        <div>
          <Link href="/admin/productos" className="adm-back">← Productos</Link>
          <h1>{p.name}</h1>
          <p>Ref. <b>{p.sku || '—'}</b> · {shownInShop(p)
            ? <Link className="adm-link" href={productPath(p)} target="_blank">Ver en la tienda ↗</Link>
            : <span className="adm-tag off">{p.hidden ? 'Oculto en la tienda' : !hasRealPhoto(p) ? 'No se ve en la tienda: le falta la foto' : 'No se ve en la tienda: le falta el precio'}</span>}</p>
        </div>
        <form action={toggleHidden} className="adm-actions">
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="hide" value={p.hidden ? '0' : '1'} />
          <input type="hidden" name="back" value={`/admin/productos/${p.id}`} />
          <button className={'btn-sm ' + (p.hidden ? 'gold' : 'ghost')} type="submit">{p.hidden ? 'Mostrar en la tienda' : 'Ocultar en la tienda'}</button>
        </form>
      </div>

      {searchParams.ok && <div className="adm-ok">Cambios guardados. Ya se ven en la tienda.</div>}
      {searchParams.fsp === 'creado' && <div className="adm-ok">Creada también en FacturaScripts ✓ — ya se puede vender en el TPV con la pistola.</div>}
      {searchParams.fsp === 'error' && <div className="adm-tag warn" style={{ display: 'block', padding: '10px 14px', lineHeight: 1.5, marginBottom: 14 }}>No se ha podido crear o actualizar en FacturaScripts{searchParams.fsd ? ` (${searchParams.fsd})` : ''}. Prueba otra vez desde <a href="/admin/facturascripts">Panel → FacturaScripts</a>.</div>}
      {searchParams.fs === 'ok' && <div className="adm-ok">Stock actualizado también en FacturaScripts ✓</div>}
      {searchParams.fs && searchParams.fs !== 'ok' && <div className="adm-tag warn" style={{ display: 'block', padding: '10px 14px', lineHeight: 1.5, marginBottom: 14 }}>Stock guardado en la web. En FacturaScripts no se ha podido cambiar{searchParams.fs === 'sin-config' ? ' (falta conectar la web con FacturaScripts: FS_API_TOKEN en el .env)' : searchParams.fs === 'sin-producto' ? ' (esa referencia aún no existe allí)' : searchParams.fsd ? ` (${searchParams.fsd})` : ''}: la web mantiene tu número, pero cuando el stock cambie en FacturaScripts (por ejemplo, una venta en tienda) se usará el de allí. Para que coincidan siempre, cámbialo también en FacturaScripts.</div>}
      {searchParams.ferr && <div className="adm-ok adm-err">Algunas fotos no se pudieron guardar: {searchParams.ferr}</div>}
      {searchParams.zok && <div className="adm-ok">Foto ampliada creada y añadida. Ya se ve en la tienda.</div>}
      {searchParams.zerr && <div className="adm-ok" style={{ background: '#fff4f2', borderColor: '#efc9c2', color: '#8a2a1a' }}>No se pudo crear la foto ampliada. Prueba con otra foto.</div>}
      {searchParams.nuevo && <div className="adm-ok">Producto creado. Completa fotos, tallas, colores y descripción y pulsa <b>Guardar</b>.</div>}

      <form action={saveProduct} className="pe" key={p.updatedAt /* se reinicia tras guardar: no re-sube fotos */}>
        <input type="hidden" name="id" value={p.id} />
        <div className="pe-grid">
          <div className="pe-main">
            <section className="adm-card">
              <h2>Información</h2>
              <div className="adm-form pe-form">
                <label className="pe-wide">Nombre<input name="name" defaultValue={p.name} required /></label>
                <label>Categoría
                  <select name="category" defaultValue={p.category}>
                    {categories.map((c) => (<option key={c.slug} value={c.slug}>{c.name}</option>))}
                  </select>
                </label>
                <label>Precio (€, IVA incl.)<input name="price" defaultValue={(p.price / 100).toFixed(2).replace('.', ',')} inputMode="decimal" required /></label>
                <label>Etiqueta<input name="badge" defaultValue={p.badge ?? ''} placeholder="Nuevo, Últimas unidades…" /></label>
              </div>
            </section>

            <section className="adm-card">
              <h2>Descripción</h2>
              <div className="adm-form pe-form">
                <label className="pe-wide">Descripción del producto
                  <textarea name="description" rows={6} defaultValue={p.description ?? ''} placeholder="Cómo es la prenda, el tejido al tacto, el corte, con qué combinarla…" />
                </label>
                <label className="pe-wide">Composición y cuidados
                  <textarea name="details" rows={3} defaultValue={p.details ?? ''} placeholder={'95% viscosa, 5% elastano\nLavar a máquina a 30º. No usar secadora.'} />
                </label>
              </div>
            </section>

            <section className="adm-card">
              <h2>Tallas, colores y stock</h2>
              <VariantEditor sizes={p.sizes || []} colors={p.colors || []} colorImages={p.colorImages || {}} gallery={gallery} stock={p.stock} variants={p.variants} />
              <details className="stk-hist" open={histStock.length > 0 && histStock[0].a === 0}>
                <summary>Últimos cambios de stock {histStock.length ? `(${histStock.length})` : ''}</summary>
                {histStock.length === 0 ? <p className="adm-help">Aún no hay cambios apuntados (se apuntan desde esta versión).</p> : (
                  <table className="adm-table">
                    <thead><tr><th>Cuándo</th><th>Stock</th><th>Quién lo cambió</th></tr></thead>
                    <tbody>
                      {histStock.map((h, i) => (
                        <tr key={i}>
                          <td>{new Date(h.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })}</td>
                          <td><b>{h.de} → {h.a}</b>{h.detalle ? <div className="adm-sku">{h.detalle}</div> : null}</td>
                          <td>{h.origen}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </details>
            </section>
          </div>

          <aside className="pe-side">
            <section className="adm-card">
              <h2>Fotos</h2>
              {gallery.length ? (
                <div className="pe-gallery">
                  {gallery.map((g, i) => (
                    <div className="pe-ph" key={g}>
                      <img src={productImg(g, 220, 290)} alt="" />
                      <label className="pe-main-pick"><input type="radio" name="principal" value={g} defaultChecked={i === 0} /> Principal</label>
                      <label className="pe-del"><input type="checkbox" name="quitar" value={g} /> Quitar</label>
                    </div>
                  ))}
                </div>
              ) : <p className="adm-help">Todavía no tiene fotos.</p>}
              <PhotoUploader name="galeria_url" label="Añadir fotos" hint="JPG, PNG o HEIC · puedes elegir varias o arrastrarlas aquí" />
              <p className="adm-help">Se suben y se optimizan al momento. La marcada como <b>Principal</b> es la que sale en el catálogo (si el producto no tenía fotos, la primera nueva hace de principal).</p>
            </section>

            <button className="btn btn-gold pe-save" type="submit">Guardar cambios</button>
          </aside>
        </div>
      </form>

      <section className="adm-card">
        <h2>Fotos ampliadas (zoom y detalles)</h2>
        <p className="adm-help">Crea fotos de detalle a partir de la misma foto: pulsa <b>Crear zoom</b>, encuadra la zona y guarda.
          Como en las tiendas de moda, cada color muestra sus propias fotos.</p>
        <div className="zc-list">
          {[...gallery.map((g) => ({ src: g, color: Object.entries(p.colorImages || {}).find(([, u]) => u === g)?.[0] || '' })),
            ...Object.entries(p.colorImages || {}).filter(([, u]) => !gallery.includes(u)).map(([c, u]) => ({ src: u, color: c }))]
            .map(({ src, color }) => (
              <div className="zc-item" key={src}>
                <img src={productImg(src, 220, 290)} alt="" />
                <span className="adm-sku">{color ? `Color ${color}` : 'General'}</span>
                <ZoomCropper productId={p.id} src={src} colors={p.colors || []} defaultTarget={color} action={createZoom} />
              </div>
            ))}
        </div>
        {Object.entries(p.colorGallery || {}).length > 0 && (
          <form action={removeColorExtras} className="zc-extra">
            <input type="hidden" name="id" value={p.id} />
            {Object.entries(p.colorGallery || {}).map(([c, list]) => (
              <div key={c}>
                <b className="zc-c">Fotos extra del color {c}</b>
                <div className="zc-list">
                  {list.map((u) => (
                    <label className="zc-item" key={u}>
                      <img src={productImg(u, 220, 290)} alt="" />
                      <span className="pe-del"><input type="checkbox" name="cquitar" value={`${c}|${u}`} /> Quitar</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn-sm" type="submit">Guardar cambios de fotos extra</button>
          </form>
        )}
      </section>

      <form action={removeProduct} className="pe-danger">
        <input type="hidden" name="id" value={p.id} />
        <ConfirmSubmit className="btn-sm danger" message={`¿Eliminar "${p.name}" de la tienda? No se puede deshacer.`}>Eliminar producto</ConfirmSubmit>
      </form>
    </>
  );
}
