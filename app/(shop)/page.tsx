import ProductRail from '@/components/ProductRail';
import Newsletter from '@/components/Newsletter';
import { Hero, Strip, Categories, EditFeature, Collage, RealBand } from '@/components/Sections';
import { listProducts, listCategories } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  // En "Novedades", primero las prendas con foto real y stock; luego las más recientes.
  const real = (img: string) => /^(\/media\/|\/uploads\/|\/img\/|https?:)/.test(img || '');
  const rail = [...products].sort((a, b) =>
    (Number(real(b.image)) - Number(real(a.image))) || (Number(b.stock > 0) - Number(a.stock > 0)) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return (
    <main id="top">
      <Hero />
      <Strip />
      <Categories categories={categories} products={products} />
      <EditFeature products={products} />
      <ProductRail products={rail} />
      <Collage />
      <RealBand />
      <Newsletter />
    </main>
  );
}
