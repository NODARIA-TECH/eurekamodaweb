import Link from 'next/link';
import { listCustomers } from '@/lib/store';
import { money } from '@/lib/money';

export const dynamic = 'force-dynamic';

function balClass(n: number) { return n > 0 ? 'bal-pos' : n < 0 ? 'bal-neg' : 'bal-zero'; }

export default async function ClientesAdmin() {
  const customers = await listCustomers();
  return (
    <>
      <div className="adm-h"><div><h1>Clientes</h1><p>{customers.length} clientes · balance = saldo a favor (+) / debe (−)</p></div></div>
      <div className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Cliente</th><th>Email</th><th>Balance</th><th>Movimientos</th><th></th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.email}</td>
                <td className={balClass(c.balance)}>{money(c.balance)}</td>
                <td>{c.movements.length}</td>
                <td><Link className="btn-sm ghost" href={`/admin/clientes/${c.id}`}>Ver / ajustar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
