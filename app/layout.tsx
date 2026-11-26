import './globals.css';
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: 'EUREKA — Moda de mujer en Écija · Tienda online',
  description: 'Tienda de moda de mujer en Écija (Sevilla) y online: punto, vestidos, sudaderas, pijamas y accesorios. Envío en 24–48 h o recogida gratis en tienda.',
  applicationName: 'EUREKA',
  openGraph: { siteName: 'EUREKA', locale: 'es_ES', type: 'website', images: ['/eureka-logo.png'] },
  twitter: { card: 'summary_large_image' },
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
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
      <body>{children}</body>
    </html>
  );
}
