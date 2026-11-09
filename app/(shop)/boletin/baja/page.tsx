// Baja del boletín desde el enlace del email.
import Link from 'next/link';
import { unsubscribe } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Baja del boletín · EUREKA', robots: { index: false } };

export default async function BajaPage({ searchParams }: { searchParams: { t?: string } }) {
  const s = await unsubscribe(String(searchParams.t || ''));
  return (
    <main className="wrap" style={{ padding: '90px 20px', textAlign: 'center', maxWidth: 560 }}>
      <h1 style={{ fontFamily: '"Cormorant Garamond",serif', fontWeight: 600, fontSize: '2.2rem' }}>
        {s ? 'Te has dado de baja' : 'Enlace no válido'}
      </h1>
      <p style={{ margin: '14px 0 28px', color: 'var(--text)', lineHeight: 1.6 }}>
        {s ? <>No volverás a recibir correos del Club EUREKA en <b>{s.email}</b>. Si cambias de idea, puedes suscribirte otra vez cuando quieras.</>
           : 'Este enlace de baja no es válido o ya no existe. Si sigues recibiendo correos, escríbenos y lo solucionamos.'}
      </p>
      <Link href="/" className="btn btn-ink">Volver a la tienda</Link>
    </main>
  );
}
