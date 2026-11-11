import Link from 'next/link';

// Cualquier dirección que no existe en la web
export const metadata = { title: 'Página no encontrada · EUREKA' };

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '40px 20px', textAlign: 'center', fontFamily: 'Jost, system-ui, sans-serif', background: '#FBF6EC', color: '#2A2018' }}>
      <div style={{ maxWidth: 520 }}>
        <img src="/eureka-logo.png" alt="EUREKA" style={{ width: 170, height: 'auto' }} />
        <h1 style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontWeight: 600, fontSize: '2.4rem', margin: '22px 0 8px' }}>Esta página no existe</h1>
        <p style={{ lineHeight: 1.6, margin: '0 0 26px', color: '#5B4E3F' }}>Puede que el enlace esté mal escrito o que la página se haya movido.</p>
        <Link href="/" style={{ display: 'inline-block', background: '#2A2018', color: '#fff', textDecoration: 'none', padding: '13px 28px', borderRadius: 999, fontWeight: 600, letterSpacing: '.06em' }}>Volver a la tienda</Link>
      </div>
    </main>
  );
}
