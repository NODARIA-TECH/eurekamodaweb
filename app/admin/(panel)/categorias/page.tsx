import { listCategories, listProducts } from '@/lib/store';
import { addCategory, removeCategory } from './actions';

export const dynamic = 'force-dynamic';

export default async function CategoriasAdmin() {
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  const count = (slug: string) => products.filter((p) => p.category === slug).length;
  return (
    <>
      <div className="adm-h"><div><h1>Categorías</h1><p>{categories.length} categorías</p></div></div>

      <div className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Nombre</th><th>Slug</th><th>Productos</th><th></th></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.slug}>
                <td>{c.name}</td>
                <td>{c.slug}</td>
                <td>{count(c.slug)}</td>
                <td><form action={removeCategory}><input type="hidden" name="slug" value={c.slug} /><button className="btn-sm danger" type="submit">Eliminar</button></form></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="adm-card">
        <h2>Añadir categoría</h2>
        <form action={addCategory} className="adm-form">
          <label>Nombre<input name="name" required /></label>
          <label>Slug (opcional)<input name="slug" placeholder="se genera del nombre" /></label>
          <label>Imagen (id Pexels)<input name="image" placeholder="26998033" /></label>
          <button className="btn-sm" type="submit" style={{ height: 40 }}>Añadir</button>
        </form>
      </div>
    </>
  );
}
