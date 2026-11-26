// FacturaScripts (en el mismo servidor): poner el stock de un producto por su referencia (SKU).
// Lo usa la ficha del panel al guardar: como n8n copia cada pocos minutos el stock de FacturaScripts
// a la web, si solo se cambiara en la web volvería al valor de FacturaScripts. Así quedan iguales.
// Configuración (.env): FS_API_TOKEN (la misma clave de la API que usa n8n) y, si hace falta,
// FS_API_URL (por defecto http://127.0.0.1/api/3).

import type { Product } from './types';

export type FsResultado = { ok: true; antes: number | null } | { ok: false; motivo: 'sin-config' | 'sin-producto' | 'error'; detalle?: string };

const base = () => (process.env.FS_API_URL || 'http://127.0.0.1/api/3').replace(/\/+$/, '');
export const fsConfigurado = () => !!process.env.FS_API_TOKEN;

// Ojo: FacturaScripts BLOQUEA 10 minutos a quien le haga 5 llamadas fallidas (clave mal o sin permiso)
// y, como la web y n8n llaman desde el mismo servidor, el bloqueo también para a n8n. Por eso, al primer
// rechazo (401, 403 o 429) la web deja de llamar a FacturaScripts durante 10 minutos.
export class FsError extends Error { constructor(public status: number, msg: string) { super(msg); } }
const gp = globalThis as any;
const PAUSA_MS = 10 * 60 * 1000;
export const pausaFs = (): { hasta: number; motivo: string } | null => (gp.__eurekaFsPausa && gp.__eurekaFsPausa.hasta > Date.now() ? gp.__eurekaFsPausa : null);

function explicar(status: number, method: string, ruta: string) {
  const recurso = ruta.replace(/^\//, '').split(/[/?]/)[0];
  if (status === 401) return 'FacturaScripts no acepta la clave: revisa FS_API_TOKEN en el .env (sin comillas ni espacios) y que la clave esté activada en FacturaScripts';
  if (status === 403) return `la clave de FacturaScripts no tiene permiso para «${recurso}» (${method === 'GET' ? 'leer' : method === 'POST' ? 'crear' : 'modificar'}): dale acceso completo en FacturaScripts → Admin → API`;
  if (status === 429) return 'FacturaScripts tiene bloqueado el acceso un rato (demasiadas llamadas fallidas o demasiado seguidas). Se desbloquea solo en 10 minutos; para ver la causa: node scripts/revisar-fs.mjs';
  return `FacturaScripts respondió ${status}`;
}

async function fs(method: string, ruta: string, body?: Record<string, string | number>) {
  const p = pausaFs();
  if (p) throw new FsError(0, `${p.motivo} (la web vuelve a intentarlo a las ${new Date(p.hasta).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' })})`);
  const r = await fetch(base() + ruta, {
    method,
    headers: { 'X-Auth-Token': process.env.FS_API_TOKEN || '', ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: body ? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString() : undefined,
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!r.ok) {
    const msg = explicar(r.status, method, ruta);
    if ([401, 403, 429].includes(r.status)) gp.__eurekaFsPausa = { hasta: Date.now() + PAUSA_MS, motivo: msg };
    throw new FsError(r.status, msg);
  }
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

/* ---------------- Productos: que todo lo que se da de alta en la web exista en FacturaScripts ----------------
   Antes esto lo hacía el flujo 2 de n8n, pero solo al lanzarlo a mano: las prendas dadas de alta después
   (en el panel, por fotos o por Excel) no llegaban a FS y la pistola del TPV no las reconocía.
   - Si NO existe en FS: se crea (referencia, nombre, precio sin IVA, IVA 21 %) con el stock de la web
     y su código de barras sin guion (PEK-0999 → PEK0999, el mismo que llevan las etiquetas).
   - Si YA existe: se actualizan nombre y precio; el stock no se toca aquí. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const codigoBarras = (ref: string) => ref.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const familia = (slug: string) => String(slug || 'varios').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const precioSinIva = (cents: number) => Math.round(((cents || 0) / 100 / 1.21) * 100) / 100;
const stockTotal = (p: Product) => (p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock || 0), 0) : p.stock || 0);

export type FsProductoResultado =
  | { ok: true; accion: 'creado' | 'actualizado' | 'igual'; aviso?: string }
  | { ok: false; motivo: 'sin-config' | 'sin-referencia' | 'error'; detalle?: string };

async function primeraFila(ruta: string) {
  const filas = await fs('GET', ruta);
  return Array.isArray(filas) ? filas[0] : null;
}

async function ponerCodigoBarras(ref: string) {
  const v = await primeraFila(`/variantes?filter[referencia]=${encodeURIComponent(ref)}&limit=1`);
  if (!v?.idvariante) return;
  const cb = codigoBarras(ref);
  if (!v.codbarras || String(v.codbarras).includes('-')) await fs('PUT', `/variantes/${v.idvariante}`, { codbarras: cb });
}

export async function asegurarProductoFs(p: Product, opts: { actualizar?: boolean } = {}): Promise<FsProductoResultado> {
  if (!fsConfigurado()) return { ok: false, motivo: 'sin-config' };
  const ref = (p.sku || '').trim();
  if (!ref) return { ok: false, motivo: 'sin-referencia' };
  const datos = { referencia: ref, descripcion: p.name.slice(0, 250), precio: precioSinIva(p.price), codimpuesto: 'IVA21', sevende: 1, secompra: 0 };
  try {
    const ya = await primeraFila(`/productos?filter[referencia]=${encodeURIComponent(ref)}&limit=1`);
    if (ya?.idproducto) {
      if (opts.actualizar === false) return { ok: true, accion: 'igual' };
      const cambia = String(ya.descripcion) !== datos.descripcion || Math.abs(Number(ya.precio) - datos.precio) > 0.004;
      if (cambia) await fs('PUT', `/productos/${ya.idproducto}`, { descripcion: datos.descripcion, precio: datos.precio });
      await ponerCodigoBarras(ref).catch(() => {});
      return { ok: true, accion: cambia ? 'actualizado' : 'igual' };
    }
    // Nuevo. La familia puede no existir en FS: si falla con ella, se crea sin familia.
    let aviso: string | undefined;
    try { await fs('POST', '/productos', { ...datos, codfamilia: familia(p.category) }); }
    catch { await fs('POST', '/productos', datos); aviso = 'creado sin familia'; }
    await sleep(400);
    await ponerCodigoBarras(ref).catch(() => {});
    const st = await ponerStockFs(ref, Math.max(0, stockTotal(p)));
    if (!st.ok) aviso = [aviso, `stock no puesto (${st.motivo})`].filter(Boolean).join(', ');
    return { ok: true, accion: 'creado', ...(aviso ? { aviso } : {}) };
  } catch (e: any) {
    return { ok: false, motivo: 'error', detalle: e?.message || String(e) };
  }
}

// Todas las referencias que ya tiene FS (por páginas)
export async function referenciasFs(): Promise<Set<string>> {
  const out = new Set<string>();
  for (let offset = 0; offset < 20000; offset += 200) {
    const filas = await fs('GET', `/productos?limit=200&offset=${offset}`);
    const lista = Array.isArray(filas) ? filas : [];
    for (const f of lista) if (f?.referencia) out.add(String(f.referencia).trim().toLowerCase());
    if (lista.length < 200) break;
    await sleep(300);
  }
  return out;
}

// Pasar a FS todas las prendas de la web que le faltan (en segundo plano; el panel enseña cómo va).
type Paso = { ref: string; name: string; ok: boolean; texto: string };
export type EstadoVolcado = { corriendo: boolean; empezado?: string; terminado?: string; total: number; hechos: number; pasos: Paso[]; error?: string };
const g = globalThis as any;
export const estadoVolcado = (): EstadoVolcado => g.__eurekaVolcadoFs || { corriendo: false, total: 0, hechos: 0, pasos: [] };

export async function faltanEnFs(productos: Product[]) {
  const refs = await referenciasFs();
  return productos.filter((p) => p.sku && !refs.has(p.sku.trim().toLowerCase()));
}

export function lanzarVolcadoFs(productos: Product[]): { ok: boolean; motivo?: string } {
  if (!fsConfigurado()) return { ok: false, motivo: 'sin-config' };
  if (estadoVolcado().corriendo) return { ok: false, motivo: 'ya-corriendo' };
  const est: EstadoVolcado = { corriendo: true, empezado: new Date().toISOString(), total: 0, hechos: 0, pasos: [] };
  g.__eurekaVolcadoFs = est;
  (async () => {
    try {
      const faltan = await faltanEnFs(productos);
      est.total = faltan.length;
      for (const p of faltan) {
        if (pausaFs()) { est.error = pausaFs()!.motivo; break; }   // no insistir: provocaría el bloqueo
        const r = await asegurarProductoFs(p, { actualizar: false });
        est.pasos.push({ ref: p.sku!, name: p.name, ok: r.ok, texto: r.ok ? (r.accion === 'creado' ? 'creado' : 'ya estaba') + (('aviso' in r && r.aviso) ? ` (${r.aviso})` : '') : `${r.motivo}${r.detalle ? ': ' + r.detalle : ''}` });
        est.hechos++;
        await sleep(1300); // FacturaScripts corta (429) si se le llama muy seguido
      }
    } catch (e: any) {
      est.error = e?.message || String(e);
    } finally {
      est.corriendo = false;
      est.terminado = new Date().toISOString();
    }
  })();
  return { ok: true };
}
