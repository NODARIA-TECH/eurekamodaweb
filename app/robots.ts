import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

// Google y compañía: todo lo público sí; panel, API, cesta, cuenta y seguimiento no.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/cesta', '/cuenta', '/seguimiento', '/boletin/baja', '/herramientas/'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
