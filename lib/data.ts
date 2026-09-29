// Catálogo y categorías (mock tipado). Más adelante: BD + panel de administración.

export type Product = {
  id: string;
  name: string;
  category: string;
  price: string; // formato "39,95"
  img: string;   // id de foto (Pexels, placeholder) — se sustituye por catálogo real
  badge?: string;
};

export type Category = {
  slug: string;
  name: string;
  img: string;
};

// Helper de imagen (placeholder Pexels; en producción -> imágenes del catálogo de la clienta)
export function pexels(id: string, w = 600, h = 800): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;
}

export const CATEGORIES: Category[] = [
  { slug: 'vestidos', name: 'Vestidos', img: '26998033' },
  { slug: 'punto', name: 'Punto', img: '1075776' },
  { slug: 'abrigos', name: 'Abrigos', img: '37647057' },
  { slug: 'blazers', name: 'Blazers', img: '4355156' },
];

export const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Vestido largo satén', category: 'Vestidos', price: '89,95', img: '26998033', badge: 'Nuevo' },
  { id: 'p2', name: 'Vestido midi entallado', category: 'Vestidos', price: '69,95', img: '15481010' },
  { id: 'p3', name: 'Trench largo cinturón', category: 'Abrigos', price: '139,95', img: '34373606', badge: 'Nuevo' },
  { id: 'p4', name: 'Blazer negra entallada', category: 'Blazers', price: '89,95', img: '4355156' },
  { id: 'p5', name: 'Jersey punto oversize', category: 'Punto', price: '32,00', img: '1075776' },
  { id: 'p6', name: 'Jean wide leg tiro alto', category: 'Jeans', price: '39,95', img: '8991032', badge: 'Nuevo' },
  { id: 'p7', name: 'Falda mini efecto cuero', category: 'Faldas', price: '35,95', img: '6138908' },
  { id: 'p8', name: 'Top rayas canalé', category: 'Tops', price: '25,95', img: '3960371' },
  { id: 'p9', name: 'Mono largo camisero lino', category: 'Vestidos', price: '79,95', img: '3195981' },
  { id: 'p10', name: 'Cárdigan punto grueso', category: 'Punto', price: '59,95', img: '2531089' },
];

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
export function productsByCategoryName(name: string): Product[] {
  return PRODUCTS.filter((p) => p.category === name);
}
export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export const NAV = [
  { href: '#cats', label: 'Ropa' },
  { href: '#edit', label: 'Novedades' },
  { href: '#collage', label: 'Editorial' },
  { href: '#real', label: 'Nosotras' },
  { href: '#nl', label: 'Club' },
];
