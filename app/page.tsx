import ProductRail from '@/components/ProductRail';
import Newsletter from '@/components/Newsletter';
import { Hero, Strip, Categories, EditFeature, Collage, RealBand } from '@/components/Sections';

export default function Home() {
  return (
    <main id="top">
      <Hero />
      <Strip />
      <Categories />
      <EditFeature />
      <ProductRail />
      <Collage />
      <RealBand />
      <Newsletter />
    </main>
  );
}
