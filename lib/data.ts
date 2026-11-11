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
export const SIN_FOTO = '/img/sin-foto.svg';
export function productImg(image?: string, w = 600, h = 800): string {
  const v = (image || '').trim();
  // Fotos de producto incluidas en la web: en tarjetas y miniaturas, la versión ligera (-m, 700 px);
  // en la ficha y la pantalla completa, la original a máxima calidad.
  if (v.startsWith('/img/productos/') && w <= 700 && v.endsWith('.webp') && !v.endsWith('-m.webp')) return v.slice(0, -5) + '-m.webp';
  if (v.startsWith('/media/') || v.startsWith('/uploads/') || v.startsWith('/img/') || v.startsWith('http://') || v.startsWith('https://')) return v;
  // Sin foto real (vacía o la de prueba de la demo): imagen neutra de EUREKA, nunca una foto que no es la prenda.
  return SIN_FOTO;
}

// Foto a mostrar para un color concreto (si tiene foto propia), si no la principal.
export function imageForColor(p: { image: string; colorImages?: Record<string, string> }, color?: string): string {
  return (color && p.colorImages?.[color]) || p.image;
}

// Muestra de color aproximada para los círculos de la ficha (por nombre en español).
const SWATCH: [RegExp, string][] = [
  [/negr/, '#1d1d1d'], [/blanco roto|crudo|hueso|marfil/, '#efe8da'], [/blanc/, '#ffffff'],
  [/gris marengo|marengo/, '#4a4c50'], [/gris/, '#a3a3a3'], [/plat/, '#c9c9c9'], [/dorad|oro/, '#c9a54a'],
  [/beige|arena/, '#d8c3a0'], [/camel/, '#b9874f'], [/taupe|tauper|topo/, '#8b7d6b'], [/caldera|teja|cobre/, '#a4512c'],
  [/chocolate|marr[oó]n|cuero/, '#5a3a26'], [/burdeos|granate|vino/, '#6d1a2a'], [/rojo|roja/, '#c0262d'],
  [/coral/, '#f07c66'], [/naranja/, '#ec7a2c'], [/amarill/, '#f2cf3c'], [/lila|malva|lavanda/, '#b49ac9'],
  [/fucsia/, '#d6338a'], [/chicle/, '#f27bb1'], [/rosa/, '#f2b8c6'],
  [/azul[oó]n|azul klein|klein/, '#1f4fb4'], [/marino/, '#1f2a44'], [/celeste|azul claro/, '#9cc8ea'], [/azul/, '#3c64a8'],
  [/turquesa/, '#2bb3b1'], [/verde agua/, '#9fd8c8'], [/pistacho|lima|fl[uú]or/, '#b5d96b'],
  [/botella/, '#1f4a33'], [/militar|caqui|kaki|oliva/, '#5e6440'], [/verde/, '#4f8f5f'],
];
export function swatch(color: string): string {
  const c = color.toLowerCase();
  for (const [re, hex] of SWATCH) if (re.test(c)) return hex;
  return '#d9cfbf';
}

export const NAV = [
  { href: '/tienda', label: 'Ropa' },
  { href: '/#rail', label: 'Novedades' },
  { href: '/lookbook', label: 'Lookbook' },
  { href: '/#real', label: 'Nosotras' },
  { href: '/seguimiento', label: 'Seguir pedido' },
  { href: '/#nl', label: 'Club' },
];
