// Fotos reales de producto incluidas en la web (public/img/productos), asignadas por NOMBRE.
// Se aplican al leer los productos: si un producto no tiene foto propia (o no la tiene para
// un color), usa la de aquí. Una foto subida desde el panel siempre manda sobre estas.
// Para añadir más: copia la foto a public/img/productos/ y añade una entrada.
import type { Product } from './types';

const I = (f: string) => `/img/productos/${f}.webp`;
// Cada foto lleva dos recortes generados de la misma imagen: encuadre de la prenda y detalle del tejido.
const crops = (url: string) => [url.replace(/\.webp$/, '-encuadre.webp'), url.replace(/\.webp$/, '-detalle.webp')];
type Entry = { name: string; main?: string; colors?: Record<string, string>; gallery?: string[] };

const ENTRIES: Entry[] = [
  { name: 'Blusa satinada manga murciélago', main: I('blusa-satinada-caldera'),
    colors: { 'Caldera': I('blusa-satinada-caldera'), 'Verde militar': I('blusa-satinada-verde-militar') } },
  { name: 'Pantalón bomber satinado', main: I('pantalon-bomber-satinado-beige'),
    colors: { 'Beige': I('pantalon-bomber-satinado-beige') }, gallery: [I('pantalon-bomber-satinado-2')] },
  { name: 'Jersey básico con pañuelo y camiseta', main: I('jersey-panuelo-camiseta-beige'), colors: { 'Beige': I('jersey-panuelo-camiseta-beige') } },
  { name: 'Jersey peluche', main: I('jersey-peluche-amarillo'), colors: { 'Amarillo': I('jersey-peluche-amarillo') } },
  { name: 'Jersey punto cuello barco', main: I('jersey-cuello-barco-blanco-roto'), colors: { 'Blanco roto': I('jersey-cuello-barco-blanco-roto') } },
  { name: 'Camiseta hombreras y encaje', main: I('camiseta-hombreras-encaje-blanco'), colors: { 'Blanco': I('camiseta-hombreras-encaje-blanco') } },
  { name: 'Jersey básico de punto sin puño', main: I('jersey-basico-sin-puno-coral'), colors: { 'Coral': I('jersey-basico-sin-puno-coral') } },
  { name: 'Conjunto de punto', main: I('conjunto-punto-chocolate') },
  // Prendas que aún no están en el catálogo: se aplican solas al crearlas con este nombre
  { name: 'Cazadora de cuadros con cordones', main: I('cazadora-cuadros-marron'),
    colors: { 'Marrón': I('cazadora-cuadros-marron'), 'Berenjena': I('cazadora-cuadros-berenjena') }, gallery: [I('cazadora-cuadros-2')] },
  { name: 'Capa estampado animal con cinturón', main: I('capa-animal-print') },
  { name: 'Jersey NYC', main: I('jersey-nyc-naranja'), colors: { 'Naranja': I('jersey-nyc-naranja') } },
  { name: 'Jersey Soho New York', main: I('jersey-soho-beige'), colors: { 'Beige': I('jersey-soho-beige') } },
  { name: 'Sudadera con bajo de encaje', main: I('sudadera-encaje-chocolate'), colors: { 'Chocolate': I('sudadera-encaje-chocolate') } },
  { name: 'Top de rayas oversize', main: I('top-rayas-oversize') },
];

const PLACEHOLDER = '26998033';
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s: string) => norm(s).split(' ').filter((w) => w.length >= 3);

// Coincide por nombre exacto (sin tildes/mayúsculas) o si el nombre del producto contiene
// TODAS las palabras de la entrada y no hay otra entrada que también encaje.
const cache = new Map<string, Entry | null>();
function entryFor(name: string): Entry | undefined {
  if (cache.has(name)) return cache.get(name) || undefined;
  const n = norm(name);
  let e = ENTRIES.find((x) => norm(x.name) === n);
  if (!e) {
    const pt = new Set(toks(name));
    const cands = ENTRIES.filter((x) => { const t = toks(x.name); return t.length > 0 && t.every((w) => pt.has(w)); });
    if (cands.length === 1) e = cands[0];
  }
  cache.set(name, e || null);
  return e;
}

export function withCatalogPhotos(p: Product): Product {
  const e = entryFor(p.name);
  if (!e) return p;
  const colorImages: Record<string, string> = { ...(p.colorImages || {}) };
  const extra: string[] = [...(e.gallery || [])];
  const colorGallery: Record<string, string[]> = { ...(p.colorGallery || {}) };
  for (const [c, url] of Object.entries(e.colors || {})) {
    const col = (p.colors || []).find((x) => norm(x) === norm(c));
    if (col) {
      if (!colorImages[col]) colorImages[col] = url;
      // recortes solo si la foto del color es la nuestra (si subes una propia, no se mezclan)
      if (colorImages[col] === url && colorGallery[col] === undefined) colorGallery[col] = crops(url);
    } else extra.push(url, ...crops(url)); // ese color no está en el producto: a la galería
  }
  // galería general: fotos extra de la entrada con sus recortes
  const gal = (e.gallery || []).flatMap((g) => [g, ...crops(g)]);
  const hasMain = !!p.image && p.image !== PLACEHOLDER;
  const image = hasMain ? p.image : (e.main || Object.values(colorImages)[0] || p.image);
  // si la principal es nuestra y no es de ningún color, también lleva sus recortes
  const mainCrops = !hasMain && e.main && !Object.values(e.colors || {}).includes(e.main) ? crops(e.main) : [];
  const images = Array.from(new Set([...(p.images || []), ...mainCrops, ...gal, ...extra])).filter((x) => x !== image);
  return {
    ...p, image, images,
    colorImages: Object.keys(colorImages).length ? colorImages : undefined,
    colorGallery: Object.keys(colorGallery).length ? colorGallery : undefined,  // [] = sin extras
  };
}
