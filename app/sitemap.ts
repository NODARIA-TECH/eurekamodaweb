import type { MetadataRoute } from 'next';
import { listShopProducts, listCategories } from '@/lib/store';
import { publicadas } from '@/lib/diario';
import { siteUrl } from '@/lib/seo';
import { productPath } from '@/lib/data';

export const dynamic = 'force-dynamic';

// Mapa del sitio para Google: se genera al momento, así que cada producto nuevo, cambio de stock o
// entrada del diario aparece con su fecha de última modificación sin hacer nada.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [products, categories, diario] = await Promise.all([listShopProducts(), listCategories(), publicadas()]);
  const ahora = new Date();
  const fecha = (...ds: (string | undefined)[]) => { const t = ds.map((d) => Date.parse(d || '')).filter((n) => !isNaN(n)); return t.length ? new Date(Math.max(...t)) : ahora; };
  const conProductos = new Set(products.map((p) => p.category));
  const ultimoProducto = fecha(...products.map((p) => p.updatedAt));
  const ultimaEntrada = fecha(...diario.map((e) => e.publishedAt));
  return [
    { url: `${base}/`, lastModified: fecha(ultimoProducto.toISOString(), ultimaEntrada.toISOString()), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/tienda`, lastModified: ultimoProducto, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/diario`, lastModified: ultimaEntrada, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/nuestra-tienda`, lastModified: ultimoProducto, changeFrequency: 'weekly', priority: 0.9 },
    ...categories.filter((c) => conProductos.has(c.slug)).map((c) => ({
      url: `${base}/categoria/${c.slug}`, lastModified: fecha(...products.filter((p) => p.category === c.slug).map((p) => p.updatedAt)), changeFrequency: 'daily' as const, priority: 0.8,
    })),
    ...products.map((p) => ({ url: `${base}${productPath(p)}`, lastModified: fecha(p.updatedAt, p.createdAt), changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...diario.map((e) => ({ url: `${base}/diario/${e.slug}`, lastModified: fecha(e.updatedAt, e.publishedAt), changeFrequency: 'monthly' as const, priority: 0.6 })),
    { url: `${base}/lookbook`, lastModified: ahora, changeFrequency: 'weekly', priority: 0.6 },
    ...['condiciones', 'devoluciones', 'aviso-legal', 'privacidad', 'cookies'].map((s) => ({ url: `${base}/legal/${s}`, changeFrequency: 'yearly' as const, priority: 0.2 })),
  ];
}
