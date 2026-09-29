import './globals.css';
import type { Metadata } from 'next';
import { CartProvider } from '@/components/Cart';

export const metadata: Metadata = {
  title: 'EUREKA — Tu tienda de moda',
  description: 'Tienda online de moda de mujer. Selección cuidada, envío rápido y trato cercano.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@400;500;600&family=Sacramento&display=swap"
        />
      </head>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
