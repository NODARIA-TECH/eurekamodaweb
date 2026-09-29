import Link from 'next/link';
import { logout } from '../login/actions';

export const metadata = { title: 'Panel · EUREKA' };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="adm-shell">
      <aside className="adm-side">
        <div className="brandline">EUREKA<small>Panel interno</small></div>
        <nav className="adm-nav">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/productos">Productos</Link>
          <Link href="/admin/categorias">Categorías</Link>
          <Link href="/admin/pedidos">Pedidos</Link>
          <Link href="/admin/clientes">Clientes</Link>
        </nav>
        <div className="bottom">
          <Link href="/" target="_blank">Ver tienda ↗</Link>
          <form action={logout}><button type="submit">Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="adm-main">{children}</main>
    </div>
  );
}
