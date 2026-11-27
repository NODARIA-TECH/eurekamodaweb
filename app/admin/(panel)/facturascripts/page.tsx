import { listProducts } from '@/lib/store';
import { fsConfigurado, faltanEnFs, estadoVolcado, pausaFs, type Pendiente } from '@/lib/facturascripts';
import { pasarAFs } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'FacturaScripts · Panel EUREKA' };

const hora = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }) : '');

export default async function FacturaScriptsPage({ searchParams }: { searchParams: { lanzado?: string; err?: string } }) {
  const est = estadoVolcado();
  const conf = fsConfigurado();
  let faltan: Pendiente[] = [];
  let errLista = '';
  if (conf && !est.corriendo && !pausaFs()) {
    try { faltan = await faltanEnFs(await listProducts()); } catch (e: any) { errLista = e?.message || String(e); }
  }
  const nProd = faltan.filter((x) => x.producto).length;
  const nTallas = faltan.reduce((a, x) => a + x.tallas, 0);
  return (
    <>
      {est.corriendo && <meta httpEquiv="refresh" content="4" />}
      <div className="adm-h"><div><h1>FacturaScripts</h1><p>Para que la pistola del TPV reconozca una prenda, tiene que existir en FacturaScripts con su referencia. Desde ahora la web la crea allí sola al darla de alta o guardarla. Aquí puedes pasar de una vez las que faltaban.</p></div></div>

      {!conf && (
        <div className="adm-tag warn" style={{ display: 'block', padding: '10px 14px', lineHeight: 1.5 }}>
          La web aún no está conectada con FacturaScripts. Falta poner <b>FS_API_TOKEN</b> (la clave de la API de FacturaScripts, la misma que usa n8n) en el archivo <code>.env</code> del servidor y reiniciar la web.
        </div>
      )}
      {pausaFs() && (
        <div className="adm-tag warn" style={{ display: 'block', padding: '10px 14px', lineHeight: 1.5, marginBottom: 14 }}>
          <b>La web ha dejado de llamar a FacturaScripts un rato</b> para no provocar (o alargar) el bloqueo: {pausaFs()!.motivo}.
          En el servidor, <code>node scripts/revisar-fs.mjs</code> dice la causa sin llamar a FacturaScripts.
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
            <p>✓ Todas las prendas de la web, con sus tallas y colores, están en FacturaScripts.</p>
          ) : (
            <>
              <p>
                {nProd > 0 && <><b>{nProd}</b> {nProd === 1 ? 'prenda no está' : 'prendas no están'} en FacturaScripts. </>}
                {nTallas > 0 && <><b>{nTallas}</b> {nTallas === 1 ? 'talla/color no está creada' : 'tallas/colores no están creadas'} (sin ellas, la pistola no sabe qué talla se vende).</>}
              </p>
              <ul style={{ columns: 2, fontSize: '.88rem', margin: '8px 0 14px' }}>
                {faltan.map(({ p, producto, tallas }) => <li key={p.id}><a href={`/admin/productos/${p.id}`}>{p.name}</a> <span className="adm-sku">{p.sku}</span>{producto ? '' : ` · faltan ${tallas} tallas/colores`}{p.hidden ? ' (oculta)' : ''}</li>)}
              </ul>
              <form action={pasarAFs}>
                <button className="btn-sm gold" type="submit">Pasar todo esto a FacturaScripts</button>
              </form>
              <p className="adm-help">Se crean con su nombre, precio, IVA 21 %, el stock que tienen en la web y el código de barras de la etiqueta. Cada talla/color se crea como variante con su propio código y su stock (el de «sin talla» se queda a 0). Las etiquetas impresas antes de esto llevan el código de la prenda, sin talla: conviene reimprimirlas.</p>
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
