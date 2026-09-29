import Link from 'next/link';
import { stats } from '@/lib/store';
import { money } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const s = await stats();
  return (
    <>
      <div className="adm-h"><div><h1>Dashboard</h1><p>Resumen de la tienda EUREKA</p></div></div>
      <div className="adm-tiles">
        <div className="tile"><div className="k">Productos</div><div className="v">{s.productos}</div></div>
        <div className="tile"><div className="k">Categorías</div><div className="v">{s.categorias}</div></div>
        <div className="tile"><div className="k">Pedidos</div><div className="v">{s.pedidos}</div></div>
        <div className="tile"><div className="k">Clientes</div><div className="v">{s.clientes}</div></div>
        <div className="tile gold"><div className="k">Ventas</div><div className="v">{money(s.ventas)}</div></div>
        <div className="tile"><div className="k">Pendientes</div><div className="v">{s.pendientes}</div></div>
      </div>
      <div className="adm-card">
        <h2>Stock bajo (≤ 3 uds.)</h2>
        {s.lowStock.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Todo con stock suficiente.</p>
        ) : (
          <table className="adm-table">
            <thead><tr><th>Producto</th><th>Categoría</th><th>Stock</th></tr></thead>
            <tbody>
              {s.lowStock.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/producto/${p.id}`} target="_blank">{p.name}</Link></td>
                  <td>{p.category}</td>
                  <td className="low">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
