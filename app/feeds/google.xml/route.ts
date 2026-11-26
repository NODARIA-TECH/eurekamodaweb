// Catálogo de productos para Google Merchant Center (fichas gratuitas en Google Shopping) y para el
// catálogo de Meta (Instagram/Facebook): https://eurekamoda.com/feeds/google.xml
// Una línea por talla/color con su stock real; se genera al momento cada vez que lo piden.
// Sin tallas/colores por variante: el color solo se indica si son 3 o menos (límite de Google).
import { listShopProducts, listCategories } from '@/lib/store';
import { productImg, productPath } from '@/lib/data';
import { abs } from '@/lib/seo';
import { ENVIO_PRECIO, ENVIO_GRATIS_DESDE } from '@/lib/envio';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

const x = (s: unknown) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (c: number) => `${(c / 100).toFixed(2)} EUR`;
const foto = (u?: string) => { if (!u) return ''; const f = productImg(u, 1200, 1600); return f.includes('sin-foto') ? '' : abs(f); };

// Categoría de Google (taxonomía oficial) según la nuestra
function googleCat(p: Product): string {
  const t = `${p.category} ${p.name}`.toLowerCase();
  if (/bolso/.test(t)) return 'Apparel & Accessories > Handbags, Wallets & Cases > Handbags';
  if (/pañolet|panolet|bufand|pañuel|panuel/.test(t)) return 'Apparel & Accessories > Clothing Accessories > Scarves & Shawls';
  if (/cintur/.test(t)) return 'Apparel & Accessories > Clothing Accessories > Belts';
  if (/zapat|deportiv|bota/.test(t)) return 'Apparel & Accessories > Shoes';
  if (/pijama/.test(t)) return 'Apparel & Accessories > Clothing > Sleepwear & Loungewear > Pajamas';
  if (/ambientador/.test(t)) return 'Home & Garden > Decor > Home Fragrances';
  if (/vestido/.test(t)) return 'Apparel & Accessories > Clothing > Dresses';
  if (/legging/.test(t)) return 'Apparel & Accessories > Clothing > Pants > Leggings';
  if (/jean|vaquer/.test(t)) return 'Apparel & Accessories > Clothing > Pants > Jeans';
  if (/pantal/.test(t)) return 'Apparel & Accessories > Clothing > Pants';
  if (/falda/.test(t)) return 'Apparel & Accessories > Clothing > Skirts';
  if (/abrigo|chaqueta|trench|cazadora/.test(t)) return 'Apparel & Accessories > Clothing > Outerwear > Coats & Jackets';
  if (/sudadera/.test(t)) return 'Apparel & Accessories > Clothing > Activewear > Sweatshirts';
  if (/punto|jersey|rebeca|poncho|cardigan/.test(t)) return 'Apparel & Accessories > Clothing > Shirts & Tops > Sweaters';
  return 'Apparel & Accessories > Clothing > Shirts & Tops';
}
const esRopa = (p: Product) => !/ambientador/.test(`${p.category} ${p.name}`.toLowerCase());

export async function GET() {
  const [products, cats] = await Promise.all([listShopProducts(), listCategories()]);
  const catName = (s: string) => cats.find((c) => c.slug === s)?.name || s;
  const items: string[] = [];
  for (const p of products) {
    const base = {
      title: p.name, link: abs(productPath(p)),
      description: (p.description || `${p.name} de mujer. EUREKA, tienda de moda en Écija (Sevilla).`).replace(/\s+/g, ' ').slice(0, 4900),
      images: [p.image, ...(p.images || [])].map(foto).filter(Boolean),
      envio: p.price >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_PRECIO,
    };
    const filas = p.variants?.length
      ? p.variants.map((v) => ({ id: v.sku || `${p.sku || p.id}-${v.size || ''}-${v.color || ''}`, size: v.size, color: v.color, stock: v.stock || 0, img: foto(v.color ? p.colorImages?.[v.color] : undefined), color4link: v.color }))
      : [{ id: p.sku || p.id, size: p.sizes?.length === 1 ? p.sizes[0] : undefined, color: p.colors?.length && p.colors.length <= 3 ? p.colors.join('/') : undefined, stock: p.stock || 0, img: '', color4link: undefined as string | undefined }];
    for (const f of filas) {
      const imgs = Array.from(new Set([f.img, ...base.images].filter(Boolean)));
      if (!imgs.length) continue;
      const link = f.color4link ? `${base.link}?color=${encodeURIComponent(f.color4link)}` : base.link;
      items.push(`<item>
<g:id>${x(f.id)}</g:id>
${p.variants?.length ? `<g:item_group_id>${x(p.sku || p.id)}</g:item_group_id>\n` : ''}<g:title>${x(base.title + (f.color && p.variants?.length ? ` – ${f.color}` : '') + (f.size && p.variants?.length && f.size !== 'Talla única' ? ` – talla ${f.size}` : ''))}</g:title>
<g:description>${x(base.description)}</g:description>
<g:link>${x(link)}</g:link>
<g:image_link>${x(imgs[0])}</g:image_link>
${imgs.slice(1, 10).map((u) => `<g:additional_image_link>${x(u)}</g:additional_image_link>`).join('\n')}
<g:availability>${f.stock > 0 ? 'in_stock' : 'out_of_stock'}</g:availability>
<g:price>${eur(p.price)}</g:price>
<g:condition>new</g:condition>
<g:brand>EUREKA</g:brand>
<g:identifier_exists>no</g:identifier_exists>
<g:google_product_category>${x(googleCat(p))}</g:google_product_category>
<g:product_type>${x(catName(p.category))}</g:product_type>
${esRopa(p) ? '<g:gender>female</g:gender>\n<g:age_group>adult</g:age_group>\n' : ''}${f.color ? `<g:color>${x(f.color)}</g:color>\n` : ''}${f.size ? `<g:size>${x(f.size)}</g:size>\n` : ''}<g:shipping><g:country>ES</g:country><g:service>Envío 24–48 h</g:service><g:price>${eur(base.envio)}</g:price></g:shipping>
</item>`);
    }
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>EUREKA · Moda de mujer en Écija</title>
<link>${x(abs('/'))}</link>
<description>Catálogo de EUREKA, tienda de moda de mujer en Écija (Sevilla)</description>
${items.join('\n')}
</channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
