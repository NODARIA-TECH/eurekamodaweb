// SEO: dirección pública de la web y datos estructurados (schema.org) para Google.
import type { Product } from './types';
import { TITULAR, DIAS_DEVOLUCION } from './legal';
import { productImg } from './data';
import { ENVIO_PRECIO, ENVIO_GRATIS_DESDE } from './envio';

// Sin cabeceras de la petición: vale también para sitemap, robots y metadatos.
export function siteUrl(): string {
  return (process.env.EUREKA_BASE_URL || TITULAR.web || 'https://eurekamoda.com').replace(/\/+$/, '');
}
export const abs = (path: string) => (/^https?:\/\//.test(path) ? path : siteUrl() + (path.startsWith('/') ? path : '/' + path));

const CP = (TITULAR.localidad.match(/\d{5}/) || ['41400'])[0];
export const DIRECCION = {
  '@type': 'PostalAddress',
  streetAddress: TITULAR.domicilio,
  postalCode: CP,
  addressLocality: 'Écija',
  addressRegion: 'Sevilla',
  addressCountry: 'ES',
};

// La tienda física + online (ficha de negocio local)
export function storeLd(social: Record<string, string>) {
  const sameAs = Object.values(social || {}).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  return {
    '@context': 'https://schema.org',
    '@type': 'ClothingStore',
    '@id': abs('/#tienda'),
    name: TITULAR.marca,
    alternateName: 'EUREKA Moda Écija',
    description: 'Tienda de moda de mujer en Écija (Sevilla) y online: punto, vestidos, sudaderas, pijamas y accesorios.',
    url: abs('/'),
    logo: abs('/eureka-logo.png'),
    image: abs('/eureka-logo.png'),
    email: TITULAR.email,
    address: DIRECCION,
    areaServed: ['Écija', 'Sevilla', 'España'],
    priceRange: '€€',
    currenciesAccepted: 'EUR',
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': abs('/#web'),
    name: 'EUREKA',
    url: abs('/'),
    inLanguage: 'es-ES',
    publisher: { '@id': abs('/#tienda') },
    potentialAction: { '@type': 'SearchAction', target: abs('/tienda?q={search_term_string}'), 'query-input': 'required name=search_term_string' },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

const euros = (c: number) => (c / 100).toFixed(2);

export function productLd(p: Product, categoryName: string) {
  const url = abs(`/producto/${p.id}`);
  const fotos = [p.image, ...(p.images || [])].map((u) => productImg(u, 1200, 1600)).filter((u) => !u.includes('sin-foto')).map(abs);
  const envio = p.price >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_PRECIO;
  const stock = p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock || 0), 0) : p.stock;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(fotos.length ? { image: Array.from(new Set(fotos)) } : {}),
    description: (p.description || `${p.name} de mujer en EUREKA, tienda de moda en Écija.`).slice(0, 5000),
    ...(p.sku ? { sku: p.sku } : {}),
    category: categoryName,
    brand: { '@type': 'Brand', name: 'EUREKA' },
    ...(p.colors?.length ? { color: p.colors.join(', ') } : {}),
    ...(p.sizes?.length ? { size: p.sizes.join(', ') } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EUR',
      price: euros(p.price),
      availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': abs('/#tienda') },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: { '@type': 'MonetaryAmount', value: euros(envio), currency: 'EUR' },
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'ES' },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
          transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
        },
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'ES',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: DIAS_DEVOLUCION,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
      },
    },
  };
}

export function articleLd(e: { slug: string; title: string; intro: string; date: string; publishedAt?: string; updatedAt?: string; image?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: e.title.slice(0, 110),
    description: e.intro.slice(0, 300),
    ...(e.image ? { image: [abs(e.image)] } : {}),
    datePublished: e.publishedAt || e.date,
    dateModified: e.updatedAt || e.publishedAt || e.date,
    inLanguage: 'es-ES',
    mainEntityOfPage: abs(`/diario/${e.slug}`),
    author: { '@type': 'Organization', name: 'EUREKA', url: abs('/') },
    publisher: { '@id': abs('/#tienda') },
  };
}
