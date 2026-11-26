import type { Metadata } from 'next';
import Link from 'next/link';
import { publicadas, trozos } from '@/lib/diario';
import { productImg } from '@/lib/data';
import JsonLd from '@/components/JsonLd';
import { breadcrumbLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Diario de moda · EUREKA Écija',
  description: 'Looks, novedades e ideas de moda de mujer de EUREKA, tu tienda en Écija (Sevilla). Una propuesta nueva cada día.',
  alternates: { canonical: '/diario' },
};

const fecha = (d?: string) => (d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }) : '');

export default async function Diario() {
  const lista = await publicadas();
  return (
    <main className="page">
      <JsonLd data={breadcrumbLd([{ name: 'Inicio', path: '/' }, { name: 'Diario', path: '/diario' }])} />
      <div className="wrap">
        <div className="page-head">
          <span className="lab">Diario EUREKA</span>
          <h1>Ideas de moda cada día</h1>
          <p>Looks, novedades y consejos desde nuestra tienda de Écija</p>
        </div>
        {lista.length === 0 ? <p className="empty">Muy pronto, la primera entrada.</p> : (
          <div className="dia-lista">
            {lista.map((e) => (
              <Link key={e.id} href={`/diario/${e.slug}`} className="dia-card">
                {e.image && <img src={productImg(e.image, 600, 800)} alt={e.title} loading="lazy" />}
                <div>
                  <time dateTime={e.publishedAt}>{fecha(e.publishedAt)}</time>
                  <h2>{e.title}</h2>
                  <p>{trozos(e.intro).map((t) => t.t).join('')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
