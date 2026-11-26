import Link from 'next/link';
import { logout } from '../login/actions';
import { requireAdmin } from '@/lib/admin-auth';
import { configIssues } from '@/lib/security-check';
import { asegurarBorradorDeHoy } from '@/lib/diario';
import { listShopProducts, listCategories } from '@/lib/store';

export const metadata = { title: 'Panel · EUREKA', robots: { index: false, follow: false } };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  requireAdmin(); // doble cerrojo además del middleware
  // Diario: el borrador del día se prepara solo al entrar al panel; el punto avisa de que espera revisión
  const diaPendiente = await asegurarBorradorDeHoy(await listShopProducts(), await listCategories()).catch(() => null);
  const graves = configIssues().filter((i) => i.grave);
  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="brandline">EUREKA<small>Panel interno</small></div>
        <nav className="adm-nav">
          <Link href="/admin">Resumen</Link>
          <Link href="/admin/pagina">Página de inicio</Link>
          <Link href="/admin/productos">Productos</Link>
          <Link href="/admin/fotos">📷 Fotos (móvil)</Link>
          <Link href="/admin/etiquetas">Etiquetas</Link>
          <Link href="/admin/facturascripts">FacturaScripts</Link>
          <Link href="/admin/categorias">Categorías</Link>
          <Link href="/admin/pedidos">Pedidos</Link>
          <Link href="/admin/clientes">Clientes</Link>
          <Link href="/admin/diario">Diario{diaPendiente && <span className="adm-dot" title="Hay una entrada para revisar y publicar" />}</Link>
          <Link href="/admin/boletin">Boletín</Link>
          <Link href="/admin/diagnostico">Diagnóstico</Link>
        </nav>
        <div className="bottom">
          <Link href="/" target="_blank">Ver tienda ↗</Link>
          <form action={logout}><button type="submit">Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="adm-main">
        {graves.length > 0 && (
          <div className="adm-err" role="alert" style={{ marginBottom: 18 }}>
            <b>Seguridad:</b> {graves.map((g) => g.titulo).join(' · ')}. <Link href="/admin/diagnostico">Ver cómo arreglarlo</Link>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
