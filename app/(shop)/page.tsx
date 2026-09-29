import ProductRail from '@/components/ProductRail';
import Newsletter from '@/components/Newsletter';
import { Hero, Strip, Categories, EditFeature, Collage, RealBand } from '@/components/Sections';
import { listProducts, listCategories } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  return (
    <main id="top">
      <Hero />
      <Strip />
      <Categories categories={categories} />
      <EditFeature />
      <ProductRail products={products} />
      <Collage />
      <RealBand />
      <Newsletter />
    </main>
  );
}
