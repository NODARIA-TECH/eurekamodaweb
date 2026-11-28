import { CartProvider } from '@/components/Cart';
import Promo from '@/components/Promo';
import ClubBar from '@/components/ClubBar';
import Header from '@/components/Header';
import { Footer } from '@/components/Sections';
import { getPublishedContent } from '@/lib/site-store';
import { WhatsAppFlotante } from '@/components/Tienda';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const { promo, social, news } = await getPublishedContent();
  return (
    <CartProvider>
      <Promo show={promo.show} text={promo.text} />
      <ClubBar c={news} />
      <Header />
      {children}
      <Footer social={social} />
      <WhatsAppFlotante url={social.whatsapp} />
    </CartProvider>
  );
}
