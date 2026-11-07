import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProduct, listCategories } from '@/lib/store';
import { productImg } from '@/lib/data';
import VariantEditor from '@/components/admin/VariantEditor';
import ConfirmSubmit from '@/components/admin/ConfirmSubmit';
import { saveProduct, removeProduct, createZoom, removeColorExtras } from '../actions';
import ZoomCropper from '@/components/admin/ZoomCropper';

export const dynamic = 'force-dynamic';

const PLACEHOLDER = '26998033';

export default async function EditProduct({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; nuevo?: string; zok?: string; zerr?: string } }) {
  const [p, categories] = await Promise.all([getProduct(params.id), listCategories()]);
  if (!p) notFound();
  const gallery = [p.image, ...(p.images || [])].filter((x) => x && x !== PLACEHOLDER);

  return (
    <>
      <div className="adm-h">
        <div>
          <Link href="/admin/productos" className="adm-back">← Productos</Link>
          <h1>{p.name}</h1>
          <p>Ref. <b>{p.sku || '—'}</b> · <Link className="adm-link" href={`/producto/${p.id}`} target="_blank">Ver en la tienda ↗</Link></p>
        </div>
      </div>

      {searchParams.ok && <div className="adm-ok">Cambios guardados. Ya se ven en la tienda.</div>}
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
              <label className="ve-upload pe-up">
                Añadir fotos (puedes elegir varias)
                <input type="file" name="galeria" accept="image/*" multiple />
              </label>
              <p className="adm-help">Se optimizan solas. La marcada como <b>Principal</b> es la que sale en el catálogo.</p>
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
