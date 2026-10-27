// Utilidades compartidas + navegación. Los datos ahora viven en el store (lib/store.ts).
export type { Product, Category, Customer, Order, OrderItem, CartItem } from './types';

// Imagen placeholder (Pexels). En producción -> imágenes del catálogo real.
export function pexels(id: string, w = 600, h = 800): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;
}

// Resuelve la imagen de un producto/categoría:
// - foto subida (/uploads/...) o URL completa -> se usa tal cual
// - id de Pexels (valor antiguo) -> se construye la URL de Pexels
// - vacío -> placeholder
export function productImg(image?: string, w = 600, h = 800): string {
  const v = (image || '').trim();
  if (!v) return pexels('26998033', w, h);
  if (v.startsWith('/uploads/') || v.startsWith('http://') || v.startsWith('https://')) return v;
  return pexels(v, w, h);
}

export const NAV = [
  { href: '/tienda', label: 'Ropa' },
  { href: '/#edit', label: 'Novedades' },
  { href: '/#collage', label: 'Editorial' },
  { href: '/#real', label: 'Nosotras' },
  { href: '/seguimiento', label: 'Seguir pedido' },
  { href: '/#nl', label: 'Club' },
];
