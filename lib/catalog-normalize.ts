// Normalización de datos de catálogo escritos a mano (Excel de la tienda).
// Funciones puras: sin acceso a disco, para poder probarlas aparte.

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Cabecera de columna -> clave: "Precio PVP (€)" -> "precio_pvp", "Composición y cuidados" -> "composicion_y_cuidados"
export function headerKey(h: string): string {
  return stripAccents(String(h || '')).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Primer valor no vacío entre varios alias de columna.
export function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Tildes que se suelen omitir al escribir rápido los colores.
const ACCENTS: Record<string, string> = {
  marron: 'marrón', azulon: 'azulón', bebe: 'bebé', grisaceo: 'grisáceo', fluor: 'flúor', limon: 'limón',
  salmon: 'salmón', cafe: 'café', melocoton: 'melocotón', jade: 'jade', canela: 'canela',
};
const fixAccents = (s: string) => s.replace(/[a-záéíóúñ]+/gi, (w) => ACCENTS[w.toLowerCase()] ?? w);

// "NEGRA,BURDEOS Y CAMEL." / "colores: marino, azulón" -> ["Negra", "Burdeos", "Camel"]
export function parseColors(input: string): string[] | undefined {
  let s = String(input || '').trim();
  if (!s) return undefined;
  // Prefijos con erratas: "colores:", "COLOREs:", "coloreres:", "COLIORES ", "Colores -"
  s = s.replace(/^\s*col[a-z]*\s*:\s*/i, '').replace(/^\s*col[a-z]*res?\b\s*[.-]?\s*/i, '');
  const out: string[] = [];
  const seen = new Set<string>();
  for (let part of s.split(/\s*[,;\n]\s*|\s+y\s+|\s+e\s+(?=[a-záéíóú])/i)) {
    part = part.replace(/[.]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!part || /^agotad/i.test(part)) continue;
    const pretty = cap(fixAccents(part.toLowerCase())).replace(/\s*\/\s*/g, '/');
    const key = stripAccents(pretty.toLowerCase());
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pretty);
  }
  return out.length ? out : undefined;
}

// "TALLAS S,M,L,XL," / "36-37-38" / "M/L, XL/XXL" / "Talla única" -> ["S","M","L","XL"] / [] (única)
export function parseSizes(input: string): string[] | undefined {
  let s = String(input || '').trim();
  if (!s) return undefined;
  if (/(talla\s*)?[uú]nica/i.test(s)) return [];
  s = s.replace(/^\s*(tallas?|n[uú]meros?|n[ºo°])\s*[:.-]?\s*/i, '').replace(/\s*\/\s*/g, '/')
    .replace(/\s*[:=]\s*\d+/g, ''); // "M/L :8" (unidades escritas junto a la talla) -> "M/L"
  const out: string[] = [];
  for (let part of s.split(/\s*[,;\n]\s*|\s+|(?<=\d)\s*-\s*(?=\d)/)) {
    part = part.replace(/[.]+$/g, '').trim();
    if (!part || !/[a-z0-9]/i.test(part)) continue; // descarta guiones o signos sueltos
    const v = /^[a-z/]+$/i.test(part) ? part.toUpperCase() : part;
    if (!out.includes(v)) out.push(v);
  }
  return out.length ? out : undefined;
}

// "16,90 €" / "16.9" / 16.9 -> 1690 (céntimos). 0 si no es válido.
export function parseEuroCents(input: string): number {
  let s = String(input ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

// "8" -> 8 ; "" -> undefined (no tocar)
export function parseStock(input: string): number | undefined {
  const s = String(input ?? '').trim();
  if (!s) return undefined;
  const n = parseInt(s.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// "PANTALÓN" -> "Pantalón" ; "ACCESORIOS(pañuelos, bufandas)" -> "Accesorios"
export function cleanCategory(input: string): string {
  const s = String(input || '').split('(')[0].replace(/\s+/g, ' ').trim();
  return s ? cap(s.toLowerCase()) : '';
}

export function slugify(s: string): string {
  return stripAccents(s.toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
