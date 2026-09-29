import { CartProvider } from '@/components/Cart';
import Promo from '@/components/Promo';
import Header from '@/components/Header';
import { Footer } from '@/components/Sections';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Promo />
      <Header />
      {children}
      <Footer />
    </CartProvider>
  );
}
