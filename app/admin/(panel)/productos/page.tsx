import { listProducts, listCategories } from '@/lib/store';
import { saveProductRow, addProduct, removeProduct } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProductosAdmin() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  return (
    <>
      <div className="adm-h"><div><h1>Productos</h1><p>{products.length} productos · edita precio, stock y badge</p></div></div>

      <div className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Producto</th><th>Categoría</th><th>Precio (€)</th><th>Stock</th><th>Badge</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td colSpan={3}>
                  <form action={saveProductRow} className="adm-inline">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="price" defaultValue={(p.price / 100).toFixed(2)} inputMode="decimal" aria-label="Precio" />
                    <input name="stock" type="number" min={0} defaultValue={p.stock} aria-label="Stock" style={{ maxWidth: 80 }} className={p.stock <= 3 ? 'low' : ''} />
                    <input name="badge" defaultValue={p.badge ?? ''} placeholder="—" aria-label="Badge" style={{ maxWidth: 90 }} />
                    <button className="btn-sm gold" type="submit">Guardar</button>
                  </form>
                </td>
                <td>
                  <form action={removeProduct}><input type="hidden" name="id" value={p.id} /><button className="btn-sm danger" type="submit">Eliminar</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="adm-card">
        <h2>Añadir producto</h2>
        <form action={addProduct} className="adm-form">
          <label>Nombre<input name="name" required /></label>
          <label>Categoría
            <select name="category" defaultValue="vestidos">
              {categories.map((c) => (<option key={c.slug} value={c.slug}>{c.name}</option>))}
            </select>
          </label>
          <label>Precio (€)<input name="price" placeholder="39,95" /></label>
          <label>Stock<input name="stock" type="number" min={0} defaultValue={0} /></label>
          <label>Imagen (id Pexels)<input name="image" placeholder="26998033" /></label>
          <label>Badge<input name="badge" placeholder="Nuevo" /></label>
          <button className="btn-sm" type="submit" style={{ height: 40 }}>Añadir</button>
        </form>
      </div>
    </>
  );
}
