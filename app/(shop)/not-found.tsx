import Link from 'next/link';

// Página no encontrada dentro de la tienda (producto o categoría que ya no existe)
export default function NotFound() {
  return (
    <main className="page">
      <div className="wrap" style={{ maxWidth: 620, textAlign: 'center', padding: '70px 20px' }}>
        <div className="page-head">
          <span className="lab">Error 404</span>
          <h1>Esta página no existe</h1>
          <p>Puede que la prenda ya no esté disponible o que el enlace esté mal escrito.</p>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-gold" href="/tienda">Ver la tienda</Link>
          <Link className="btn" href="/">Ir al inicio</Link>
        </div>
      </div>
    </main>
  );
}
