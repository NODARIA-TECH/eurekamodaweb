// Lookbook EUREKA: looks reales de la tienda con las prendas que llevan.
// Cada prenda se enlaza sola a su ficha si existe un producto con ese nombre (sin tildes
// ni mayúsculas); si no existe (aún), se muestra como "En tienda".
// Para añadir un look: sube la foto a public/img/look/<slug>.webp y añade una entrada aquí.
import type { Product } from './types';
// Posición del punto de cada prenda sobre la foto (% de ancho/alto) y su máscara
// (public/img/look/mask/<slug>-<n>.png), generadas recortando la ropa de cada foto.
import SPOTS from './lookbook-spots.json';

export type Spot = { x: number; y: number } | null;
export const spotsFor = (slug: string): Spot[] => ((SPOTS as Record<string, Spot[]>)[slug] || []);
export const maskFor = (slug: string, i: number) => `/img/look/mask/${slug}-${i}.png`;

export type LookPiece = { label: string; product?: string; color?: string; category?: string };
export type Look = { slug: string; title: string; mood: string; photo: string; alt: string; pieces: LookPiece[] };

const P = (slug: string) => `/img/look/${slug}.webp`;
const leggings: LookPiece = { label: 'Leggings marrón', category: 'leggings' };
const pantNegro: LookPiece = { label: 'Pantalón ancho negro', category: 'pantalones' };

export const LOOKS: Look[] = [
  { slug: 'otono-urbano', title: 'Otoño urbano', mood: 'cuadros & marrón', photo: P('otono-urbano'), alt: 'Cazadora de cuadros marrón con leggings marrón y botas camel',
    pieces: [{ label: 'Cazadora de cuadros con cordones', product: 'Cazadora de cuadros con cordones', color: 'Marrón' }, leggings] },
  { slug: 'saten-caldera', title: 'Satén y caldera', mood: 'brillo de día', photo: P('saten-caldera'), alt: 'Blusa satinada caldera con pantalón satinado beige y fajín estampado',
    pieces: [{ label: 'Blusa satinada manga murciélago', product: 'Blusa satinada manga murciélago', color: 'Caldera' }, { label: 'Pantalón bomber satinado', product: 'Pantalón bomber satinado', color: 'Beige' }] },
  { slug: 'animal-print', title: 'Animal print', mood: 'con carácter', photo: P('animal-print'), alt: 'Capa con estampado animal y cinturón con leggings marrón',
    pieces: [{ label: 'Capa estampado animal con cinturón', product: 'Capa estampado animal con cinturón' }, leggings] },
  { slug: 'blanco-y-negro', title: 'Blanco y negro', mood: 'clásico que no falla', photo: P('blanco-y-negro'), alt: 'Jersey de punto cuello barco blanco roto con pantalón ancho negro',
    pieces: [{ label: 'Jersey punto cuello barco', product: 'Jersey punto cuello barco', color: 'Blanco roto' }, pantNegro] },
  { slug: 'color-pop', title: 'Color pop', mood: 'amarillo que alegra', photo: P('color-pop'), alt: 'Jersey peluche amarillo con leggings marrón',
    pieces: [{ label: 'Jersey peluche', product: 'Jersey peluche', color: 'Amarillo' }, leggings] },
  { slug: 'total-look-punto', title: 'Total look punto', mood: 'comodidad con estilo', photo: P('total-look-punto'), alt: 'Conjunto de punto marrón chocolate de jersey y pantalón',
    pieces: [{ label: 'Conjunto de punto', product: 'Conjunto de punto' }] },
  { slug: 'sporty-chic', title: 'Sporty chic', mood: 'NYC vibes', photo: P('sporty-chic'), alt: 'Jersey naranja NYC con leggings marrón',
    pieces: [{ label: 'Jersey NYC', product: 'Jersey NYC', color: 'Naranja' }, leggings] },
  { slug: 'noche', title: 'Noche elegante', mood: 'encaje y hombreras', photo: P('noche'), alt: 'Camiseta blanca con hombreras y encaje con pantalón ancho negro',
    pieces: [{ label: 'Camiseta hombreras y encaje', product: 'Camiseta hombreras y encaje', color: 'Blanco' }, pantNegro] },
  { slug: 'saten-verde', title: 'Verde militar', mood: 'satén para todo', photo: P('saten-verde'), alt: 'Blusa satinada verde militar con pantalón satinado beige',
    pieces: [{ label: 'Blusa satinada manga murciélago', product: 'Blusa satinada manga murciélago', color: 'Verde militar' }, { label: 'Pantalón bomber satinado', product: 'Pantalón bomber satinado', color: 'Beige' }] },
  { slug: 'soho-mood', title: 'Soho mood', mood: 'casual de ciudad', photo: P('soho-mood'), alt: 'Jersey beige Soho New York con leggings marrón',
    pieces: [{ label: 'Jersey Soho New York', product: 'Jersey Soho New York', color: 'Beige' }, leggings] },
  { slug: 'toque-coral', title: 'Toque coral', mood: 'básico con color', photo: P('toque-coral'), alt: 'Jersey básico coral de cuello semicisne con pantalón ancho negro',
    pieces: [{ label: 'Jersey básico de punto sin puño', product: 'Jersey básico de punto sin puño', color: 'Coral' }, pantNegro] },
  { slug: 'urbano', title: 'Urbano', mood: 'berenjena & taupe', photo: P('urbano'), alt: 'Cazadora de cuadros berenjena con pantalón de pinzas taupe',
    pieces: [{ label: 'Cazadora de cuadros con cordones', product: 'Cazadora de cuadros con cordones', color: 'Berenjena' }, { label: 'Pantalón de pinzas', category: 'pantalones' }] },
  { slug: 'total-brown', title: 'Total brown', mood: 'tono sobre tono', photo: P('total-brown'), alt: 'Sudadera chocolate con bajo de encaje y leggings marrón',
    pieces: [{ label: 'Sudadera con bajo de encaje', product: 'Sudadera con bajo de encaje', color: 'Chocolate' }, leggings] },
  { slug: 'basicos-con-estilo', title: 'Básicos con estilo', mood: 'tres piezas en una', photo: P('basicos-con-estilo'), alt: 'Jersey básico beige con pañuelo y camiseta, con leggings marrón',
    pieces: [{ label: 'Jersey básico con pañuelo y camiseta', product: 'Jersey básico con pañuelo y camiseta', color: 'Beige' }, leggings] },
  { slug: 'cuadros-y-negro', title: 'Cuadros y negro', mood: 'para cada día', photo: P('cuadros-y-negro'), alt: 'Cazadora de cuadros berenjena con pantalón ancho negro',
    pieces: [{ label: 'Cazadora de cuadros con cordones', product: 'Cazadora de cuadros con cordones', color: 'Berenjena' }, pantNegro] },
  { slug: 'boho', title: 'Boho', mood: 'rayas y harén', photo: P('boho'), alt: 'Top de rayas oversize marrón con pantalón harén marrón',
    pieces: [{ label: 'Top de rayas oversize', product: 'Top de rayas oversize' }, { label: 'Pantalón harén', category: 'pantalones' }] },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export function findProductByName(products: Product[], name?: string): Product | undefined {
  if (!name) return undefined;
  const n = norm(name);
  return products.find((p) => norm(p.name) === n) || products.find((p) => norm(p.name).startsWith(n));
}

// Looks en los que aparece un producto (para "Así lo combinamos" en su ficha).
export function looksFor(product: Product, products: Product[]): Look[] {
  return LOOKS.filter((l) => l.pieces.some((pc) => findProductByName(products, pc.product)?.id === product.id));
}
