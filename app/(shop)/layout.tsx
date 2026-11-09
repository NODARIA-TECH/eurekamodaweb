import { CartProvider } from '@/components/Cart';
import Promo from '@/components/Promo';
import Header from '@/components/Header';
import { Footer } from '@/components/Sections';
import { getPublishedContent } from '@/lib/site-store';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { promo } = await getPublishedContent();
  return (
    <CartProvider>
      <Promo show={promo.show} text={promo.text} />
      <Header />
      {children}
      <Footer />
    </CartProvider>
  );
}
