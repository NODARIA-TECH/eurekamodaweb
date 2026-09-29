// Utilidades compartidas + navegación. Los datos ahora viven en el store (lib/store.ts).
export type { Product, Category, Customer, Order, OrderItem, CartItem } from './types';

// Imagen placeholder (Pexels). En producción -> imágenes del catálogo real.
export function pexels(id: string, w = 600, h = 800): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;
}

export const NAV = [
  { href: '/tienda', label: 'Ropa' },
  { href: '/#edit', label: 'Novedades' },
  { href: '/#collage', label: 'Editorial' },
  { href: '/#real', label: 'Nosotras' },
  { href: '/#nl', label: 'Club' },
];
