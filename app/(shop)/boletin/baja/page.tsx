// Baja del boletín desde el enlace del email: primero se pregunta (un botón), y la baja se hace
// por POST en /api/boletin/baja. Así nadie se da de baja solo porque un antivirus abra el enlace.
import Link from 'next/link';
import { findByToken } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Baja del boletín · EUREKA', robots: { index: false } };

const H1 = { fontFamily: '"Cormorant Garamond",serif', fontWeight: 600, fontSize: '2.2rem' } as const;
const P = { margin: '14px 0 28px', color: 'var(--text)', lineHeight: 1.6 } as const;

export default async function BajaPage({ searchParams }: { searchParams: { t?: string; hecho?: string } }) {
  if (searchParams.hecho === '1') {
    return (
      <main className="wrap" style={{ padding: '90px 20px', textAlign: 'center', maxWidth: 560 }}>
        <h1 style={H1}>Te has dado de baja</h1>
        <p style={P}>No volverás a recibir correos del Club EUREKA. Si cambias de idea, puedes suscribirte otra vez cuando quieras.</p>
        <Link href="/" className="btn btn-ink">Volver a la tienda</Link>
      </main>
    );
  }
  const s = searchParams.hecho === '0' ? null : await findByToken(String(searchParams.t || ''));
  if (!s) {
    return (
      <main className="wrap" style={{ padding: '90px 20px', textAlign: 'center', maxWidth: 560 }}>
        <h1 style={H1}>Enlace no válido</h1>
        <p style={P}>Este enlace de baja no es válido o ya no existe. Si sigues recibiendo correos, escríbenos y lo solucionamos.</p>
        <Link href="/" className="btn btn-ink">Volver a la tienda</Link>
      </main>
    );
  }
  if (s.status === 'baja') {
    return (
      <main className="wrap" style={{ padding: '90px 20px', textAlign: 'center', maxWidth: 560 }}>
        <h1 style={H1}>Ya estás dada de baja</h1>
        <p style={P}><b>{s.email}</b> ya no recibe correos del Club EUREKA.</p>
        <Link href="/" className="btn btn-ink">Volver a la tienda</Link>
      </main>
    );
  }
  return (
    <main className="wrap" style={{ padding: '90px 20px', textAlign: 'center', maxWidth: 560 }}>
      <h1 style={H1}>¿Quieres darte de baja?</h1>
      <p style={P}>Dejarás de recibir en <b>{s.email}</b> las novedades y ofertas del Club EUREKA.</p>
      <form method="post" action="/api/boletin/baja" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <input type="hidden" name="t" value={String(searchParams.t || '')} />
        <input type="hidden" name="desde" value="web" />
        <button type="submit" className="btn btn-ink">Darme de baja</button>
        <Link href="/" className="btn">Seguir suscrita</Link>
      </form>
    </main>
  );
}
