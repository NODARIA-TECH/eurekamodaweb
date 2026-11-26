import { listProducts } from '@/lib/store';
import { fsConfigurado, faltanEnFs, estadoVolcado } from '@/lib/facturascripts';
import { pasarAFs } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'FacturaScripts · Panel EUREKA' };

const hora = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '');

export default async function FacturaScriptsPage({ searchParams }: { searchParams: { lanzado?: string; err?: string } }) {
  const est = estadoVolcado();
  const conf = fsConfigurado();
  let faltan: { id: string; sku?: string; name: string; hidden?: boolean }[] = [];
  let errLista = '';
  if (conf && !est.corriendo) {
    try { faltan = await faltanEnFs(await listProducts()); } catch (e: any) { errLista = e?.message || String(e); }
  }
  return (
    <>
      {est.corriendo && <meta httpEquiv="refresh" content="4" />}
      <div className="adm-h"><div><h1>FacturaScripts</h1><p>Para que la pistola del TPV reconozca una prenda, tiene que existir en FacturaScripts con su referencia. Desde ahora la web la crea allí sola al darla de alta o guardarla. Aquí puedes pasar de una vez las que faltaban.</p></div></div>

      {!conf && (
        <div className="adm-tag warn" style={{ display: 'block', padding: '10px 14px', lineHeight: 1.5 }}>
          La web aún no está conectada con FacturaScripts. Falta poner <b>FS_API_TOKEN</b> (la clave de la API de FacturaScripts, la misma que usa n8n) en el archivo <code>.env</code> del servidor y reiniciar la web.
        </div>
      )}
      {searchParams.err === 'ya-corriendo' && <div className="adm-ok">Ya se están pasando; espera a que termine.</div>}

      {est.corriendo && (
        <div className="adm-ok">Pasando prendas a FacturaScripts… {est.total ? `${est.hechos} de ${est.total}` : 'buscando las que faltan'}. Esta página se actualiza sola.</div>
      )}

      {!est.corriendo && est.terminado && (
        <div className={est.error || est.pasos.some((x) => !x.ok) ? 'adm-tag warn' : 'adm-ok'} style={{ display: 'block', padding: '10px 14px', marginBottom: 14 }}>
          Última vez ({hora(est.terminado)}): {est.pasos.filter((x) => x.ok).length} creadas en FacturaScripts
          {est.pasos.some((x) => !x.ok) ? `, ${est.pasos.filter((x) => !x.ok).length} con error` : ''}
          {est.total === 0 && !est.error ? ' — no faltaba ninguna' : ''}{est.error ? ` · Error: ${est.error}` : ''}.
        </div>
      )}

      {conf && !est.corriendo && (
        <section className="adm-card">
          {errLista ? (
            <p className="adm-err">No se ha podido leer FacturaScripts: {errLista}</p>
          ) : faltan.length === 0 ? (
            <p>✓ Todas las prendas de la web están en FacturaScripts.</p>
          ) : (
            <>
              <p><b>{faltan.length}</b> {faltan.length === 1 ? 'prenda de la web no está' : 'prendas de la web no están'} en FacturaScripts:</p>
              <ul style={{ columns: 2, fontSize: '.88rem', margin: '8px 0 14px' }}>
                {faltan.map((p) => <li key={p.id}><a href={`/admin/productos/${p.id}`}>{p.name}</a> <span className="adm-sku">{p.sku}</span>{p.hidden ? ' (oculta)' : ''}</li>)}
              </ul>
              <form action={pasarAFs}>
                <button className="btn-sm gold" type="submit">Pasar {faltan.length === 1 ? 'esta prenda' : `estas ${faltan.length} prendas`} a FacturaScripts</button>
              </form>
              <p className="adm-help">Se crean con su nombre, precio, IVA 21 %, el stock que tienen en la web y el código de barras de la etiqueta. Tarda un par de segundos por prenda.</p>
            </>
          )}
        </section>
      )}

      {est.pasos.length > 0 && (
        <details className="stk-hist" open={est.corriendo}>
          <summary>Detalle de la última vez</summary>
          <table className="adm-table"><tbody>
            {est.pasos.map((x, i) => <tr key={i}><td>{x.ref}</td><td>{x.name}</td><td>{x.ok ? '✓ ' : '✗ '}{x.texto}</td></tr>)}
          </tbody></table>
        </details>
      )}
    </>
  );
}
