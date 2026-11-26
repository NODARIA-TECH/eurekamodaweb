// Fotos desde el móvil: buscar la prenda, hacer la foto (o elegirla de la galería) y listo.
// Sin pasar por Drive ni por el ordenador; cada foto se guarda sola en cuanto termina de subirse.
import { requireAdmin } from '@/lib/admin-auth';
import { listProducts, listCategories } from '@/lib/store';
import FotosMovil from '@/components/admin/FotosMovil';
import type { FotoProducto } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Fotos desde el móvil · EUREKA' };

export default async function FotosPage() {
  requireAdmin();
  const [ps, cats] = await Promise.all([listProducts(), listCategories()]);
  const productos: FotoProducto[] = ps.map((p) => ({
    id: p.id, name: p.name, sku: p.sku, image: p.image, images: p.images || [], colors: p.colors || [], colorImages: p.colorImages || {}, price: p.price, category: p.category, hidden: !!p.hidden,
  }));
  return (
    <>
      <div className="adm-h">
        <div>
          <h1>Fotos desde el móvil</h1>
          <p>Busca la prenda, haz la foto y ya está: se guarda sola. Sin Drive y sin ordenador.</p>
        </div>
      </div>
      <FotosMovil productos={productos} categorias={cats.map((c) => ({ slug: c.slug, name: c.name }))} />
    </>
  );
}
