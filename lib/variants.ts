// Stock por variante (talla × color). Funciones puras, válidas en servidor y cliente.
// Un producto está "en modo variantes" cuando tiene `variants` con al menos una entrada;
// entonces su `stock` es siempre la suma de las variantes. Si no, se usa `stock` tal cual.
import type { Product, Variant } from './types';

export const vkey = (size?: string, color?: string) => `${size ?? ''}|${color ?? ''}`;

export function vlabel(size?: string, color?: string): string {
  return [size && `Talla ${size}`, color].filter(Boolean).join(' · ');
}

export const hasVariants = (p: Pick<Product, 'variants'>) => !!p.variants && p.variants.length > 0;

// Todas las combinaciones talla × color ([] si no hay ni tallas ni colores).
export function combos(sizes: string[], colors: string[]): { size?: string; color?: string }[] {
  if (!sizes.length && !colors.length) return [];
  const S = sizes.length ? sizes : [undefined];
  const C = colors.length ? colors : [undefined];
  const out: { size?: string; color?: string }[] = [];
  for (const c of C) for (const s of S) out.push({ size: s, color: c });
  return out;
}

export function findVariant(p: Pick<Product, 'variants'>, size?: string, color?: string): Variant | undefined {
  const k = vkey(size, color);
  return p.variants?.find((v) => vkey(v.size, v.color) === k);
}

// Unidades disponibles de una combinación (sin variantes: el stock total).
export function stockOf(p: Pick<Product, 'variants' | 'stock'>, size?: string, color?: string): number {
  if (!hasVariants(p)) return p.stock;
  return findVariant(p, size, color)?.stock ?? 0;
}

// ¿Queda algo de este color en alguna talla?
export function colorAvailable(p: Pick<Product, 'variants' | 'stock'>, color: string): boolean {
  if (!hasVariants(p)) return p.stock > 0;
  return p.variants!.some((v) => (v.color ?? '') === color && v.stock > 0);
}

export const totalStock = (vs: Variant[]) => vs.reduce((s, v) => s + Math.max(0, v.stock), 0);

// Reconstruye las variantes para unas tallas/colores, conservando la referencia y el stock
// de las que ya existían. `stocks` (clave vkey -> unidades) sobrescribe las que trae.
export function buildVariants(
  baseSku: string,
  existing: Variant[] | undefined,
  sizes: string[],
  colors: string[],
  stocks?: Record<string, number> | null,
): Variant[] | undefined {
  const list = combos(sizes, colors);
  if (!list.length) return undefined;
  const prev = existing || [];
  let next = prev.reduce((m, v) => {
    const n = parseInt((v.sku || '').split('-').pop() || '', 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return list.map(({ size, color }) => {
    const k = vkey(size, color);
    const ex = prev.find((v) => vkey(v.size, v.color) === k);
    const stock = stocks && k in stocks ? stocks[k] : ex?.stock ?? 0;
    const sku = ex?.sku || `${baseSku}-${String(++next).padStart(2, '0')}`;
    return { size, color, stock: Math.max(0, Math.round(stock || 0)), sku };
  });
}
