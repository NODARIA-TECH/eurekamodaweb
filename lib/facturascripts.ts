// FacturaScripts (en el mismo servidor): poner el stock de un producto por su referencia (SKU).
// Lo usa la ficha del panel al guardar: como n8n copia cada pocos minutos el stock de FacturaScripts
// a la web, si solo se cambiara en la web volvería al valor de FacturaScripts. Así quedan iguales.
// Configuración (.env): FS_API_TOKEN (la misma clave de la API que usa n8n) y, si hace falta,
// FS_API_URL (por defecto http://127.0.0.1/api/3).

export type FsResultado = { ok: true; antes: number | null } | { ok: false; motivo: 'sin-config' | 'sin-producto' | 'error'; detalle?: string };

const base = () => (process.env.FS_API_URL || 'http://127.0.0.1/api/3').replace(/\/+$/, '');
export const fsConfigurado = () => !!process.env.FS_API_TOKEN;

async function fs(method: string, ruta: string, body?: Record<string, string | number>) {
  const r = await fetch(base() + ruta, {
    method,
    headers: { 'X-Auth-Token': process.env.FS_API_TOKEN || '', ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: body ? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString() : undefined,
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`FacturaScripts respondió ${r.status}`);
  const j = await r.json().catch(() => null);
  return Array.isArray(j) ? j : j?.data ?? j;
}

export async function ponerStockFs(referencia: string, cantidad: number): Promise<FsResultado> {
  if (!fsConfigurado()) return { ok: false, motivo: 'sin-config' };
  const ref = encodeURIComponent(referencia.trim());
  const qty = Math.max(0, Math.round(cantidad));
  try {
    const filas = await fs('GET', `/stocks?filter[referencia]=${ref}&limit=1`);
    const fila = Array.isArray(filas) ? filas[0] : null;
    if (fila?.idstock) {
      await fs('PUT', `/stocks/${fila.idstock}`, { cantidad: qty });
      return { ok: true, antes: Number(fila.cantidad) || 0 };
    }
    // Sin fila de stock todavía: se crea en el primer almacén
    const prods = await fs('GET', `/productos?filter[referencia]=${ref}&limit=1`);
    const prod = Array.isArray(prods) ? prods[0] : null;
    if (!prod?.idproducto) return { ok: false, motivo: 'sin-producto' };
    const alms = await fs('GET', '/almacenes?limit=1');
    const codalmacen = Array.isArray(alms) ? alms[0]?.codalmacen : undefined;
    if (!codalmacen) return { ok: false, motivo: 'error', detalle: 'FacturaScripts no tiene almacén' };
    await fs('POST', '/stocks', { referencia: referencia.trim(), idproducto: prod.idproducto, codalmacen, cantidad: qty });
    return { ok: true, antes: null };
  } catch (e: any) {
    return { ok: false, motivo: 'error', detalle: e?.message || String(e) };
  }
}
