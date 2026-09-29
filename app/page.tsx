import Promo from '@/components/Promo';
import Header from '@/components/Header';
import ProductRail from '@/components/ProductRail';
import Newsletter from '@/components/Newsletter';
import { Hero, Strip, Categories, EditFeature, Collage, RealBand, Footer } from '@/components/Sections';

export default function Home() {
  return (
    <>
      <Promo />
      <Header />
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
      <Footer />
    </>
  );
}
