// Diario: cada día hay un borrador preparado con productos reales. Se revisa, se retoca si hace falta
// y se publica con un clic. Publicar a menudo (contenido nuevo con palabras como «moda mujer Écija»)
// ayuda a que Google visite la web más y la muestre en más búsquedas.
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { asegurarBorradorDeHoy, listarDiario, hoy, type DiarioEntrada } from '@/lib/diario';
import { listShopProducts, listCategories, listProducts } from '@/lib/store';
import { productImg } from '@/lib/data';
import { guardar, otra, estado } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Diario · EUREKA' };

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '');
const OK: Record<string, string> = {
  publicada: '¡Publicada! Ya está en la web y Google la encontrará en su próxima visita.',
  guardada: 'Cambios guardados (sigue como borrador).',
  otra: 'Hecho: te he preparado otra propuesta para hoy.',
  descartada: 'Entrada descartada.',
  borrador: 'La entrada vuelve a estar como borrador (ya no se ve en la web).',
};

export default async function DiarioAdmin({ searchParams }: { searchParams: { ok?: string; slug?: string } }) {
  requireAdmin();
  const [shop, cats, todos] = await Promise.all([listShopProducts(), listCategories(), listProducts()]);
  await asegurarBorradorDeHoy(shop, cats);
  const entradas = await listarDiario();
  const borradores = entradas.filter((e) => e.status === 'borrador').sort((a, b) => b.date.localeCompare(a.date));
  const publicadasList = entradas.filter((e) => e.status === 'publicada');
  const publicadaHoy = publicadasList.find((e) => e.date === hoy() || (e.publishedAt || '').startsWith(hoy()));
  const prod = (id: string) => todos.find((p) => p.id === id);
  const racha = (() => { let n = 0; const d = new Date(); for (;;) { const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(d); if (publicadasList.some((e) => (e.publishedAt || '').slice(0, 10) === f || e.date === f)) { n++; d.setDate(d.getDate() - 1); } else break; } return n; })();

  return (
    <>
      <div className="adm-h">
        <div>
          <h1>Diario</h1>
          <p>Una entrada al día para Google · {publicadasList.length} publicadas{racha > 1 ? ` · ${racha} días seguidos 🔥` : ''}</p>
        </div>
        <a className="btn-sm ghost" href="/diario" target="_blank">Ver el diario ↗</a>
      </div>

      {searchParams.ok && OK[searchParams.ok] && (
        <div className="adm-ok">{OK[searchParams.ok]}{searchParams.slug && <> <a href={`/diario/${searchParams.slug}`} target="_blank">Verla ↗</a></>}</div>
      )}
      {searchParams.ok === 'error' && <div className="adm-err">No se pudo hacer. Vuelve a intentarlo.</div>}

      {publicadaHoy && !borradores.length && <div className="adm-card"><p>✓ La entrada de hoy ya está publicada: <a href={`/diario/${publicadaHoy.slug}`} target="_blank">{publicadaHoy.title}</a>. Mañana tendrás otra preparada.</p></div>}
      {!publicadaHoy && !borradores.length && <div className="adm-card"><p>Hoy no hay propuesta: hacen falta al menos 2 productos visibles con stock.</p></div>}

      {borradores.map((e) => <Borrador key={e.id + (e.updatedAt || '')} e={e} prod={prod} esHoy={e.date === hoy()} />)}

      <div className="adm-card">
        <h2>Publicadas</h2>
        {publicadasList.length === 0 ? <p className="adm-help">Aún no hay ninguna. Publica la de hoy y empieza la racha.</p> : (
          <table className="adm-table">
            <thead><tr><th>Fecha</th><th>Título</th><th>Prendas</th><th></th></tr></thead>
            <tbody>
              {publicadasList.map((e) => (
                <tr key={e.id}>
                  <td>{fmt(e.publishedAt)}</td>
                  <td><a href={`/diario/${e.slug}`} target="_blank">{e.title}</a></td>
                  <td>{e.productIds.length}</td>
                  <td>
                    <form action={estado} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="borrador" />
                      <button className="btn-sm ghost" type="submit">Quitar de la web</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="adm-help">Consejo: publica una entrada cada día (o casi). Google premia las webs que se actualizan a menudo con contenido propio. Puedes cambiar el título y los textos a tu manera antes de publicar: cuanto más tuyo, mejor.</p>
    </>
  );
}

function Borrador({ e, prod, esHoy }: { e: DiarioEntrada; prod: (id: string) => import('@/lib/types').Product | undefined; esHoy: boolean }) {
  // Clave según el contenido: si cambia el borrador (p. ej. «Prepárame otra»), las casillas se rehacen con el texto nuevo
  const v = `${e.updatedAt || e.createdAt}-${e.title.length}-${e.intro.length}-${e.body.length}`;
  return (
    <div className="adm-card dia-borrador">
      <h2>{esHoy ? 'Propuesta de hoy' : `Borrador del ${fmt(e.date + 'T12:00:00')}`} <span className="adm-tag">{e.tema}</span></h2>
      <div className="dia-prods">
        {e.productIds.map((id) => { const p = prod(id); return p ? (
          <Link key={id} href={`/producto/${id}`} target="_blank" className="dia-prod"><img src={productImg(p.image, 300, 400)} alt="" /><span>{p.name}</span></Link>
        ) : null; })}
      </div>
      <form key={v} action={guardar} className="adm-form dia-form">
        <input type="hidden" name="id" value={e.id} />
        {e.productIds.map((id) => <input key={id} type="hidden" name="productIds" value={id} />)}
        <label style={{ gridColumn: '1 / -1' }}>Título<input key={"t" + v} name="title" defaultValue={e.title} maxLength={140} required /></label>
        <label style={{ gridColumn: '1 / -1' }}>Entradilla<textarea key={"i" + v} name="intro" defaultValue={e.intro} rows={2} /></label>
        <label style={{ gridColumn: '1 / -1' }}>Texto (un párrafo por bloque; **así** va en negrita)<textarea key={"b" + v} name="body" defaultValue={e.body} rows={12} /></label>
        <div className="adm-actions" style={{ gridColumn: '1 / -1' }}>
          <button className="btn-sm gold" type="submit" name="accion" value="publicar">Publicar en la web</button>
          <button className="btn-sm ghost" type="submit" name="accion" value="guardar">Guardar sin publicar</button>
        </div>
      </form>
      <div className="adm-actions" style={{ marginTop: 10 }}>
        <form action={otra}><input type="hidden" name="id" value={e.id} /><button className="btn-sm ghost" type="submit">Prepárame otra</button></form>
        <form action={estado}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="descartada" /><button className="btn-sm danger" type="submit">Descartar</button></form>
      </div>
    </div>
  );
}
