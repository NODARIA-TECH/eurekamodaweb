import { listProducts, listCategories } from '@/lib/store';
import LabelMaker from '@/components/LabelMaker';

export const dynamic = 'force-dynamic';

export default async function EtiquetasAdmin() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const items = products
    .filter((p) => p.sku)
    .map((p) => ({ id: p.id, sku: p.sku as string, name: p.name, price: p.price, category: p.category,
      variants: p.variants?.map((v) => ({ size: v.size, color: v.color, stock: v.stock })) }));
  const cats = categories.map((c) => ({ slug: c.slug, name: c.name }));

  return (
    <>
      <div className="adm-h">
        <div>
          <h1>Etiquetas</h1>
          <p>Códigos de barras para la Brother QL-570: elige tu rollo y se imprime una etiqueta por página, a su medida exacta</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="adm-card"><p className="muted">No hay productos con referencia. Añade productos primero.</p></div>
      ) : (
        <LabelMaker products={items} categories={cats} />
      )}
    </>
  );
}
