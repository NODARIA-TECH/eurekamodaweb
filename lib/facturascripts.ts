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
// Sin permiso en estos, la web sigue (sin código de barras / con el almacén de otra fila de stock)
const OPCIONALES = new Set(['variantes', 'almacenes']);
const sinPermiso = (recurso: string) => (gp.__eurekaFsSinPermiso?.[recurso] || 0) > Date.now();
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
    const recurso = ruta.replace(/^\//, '').split(/[/?]/)[0];
    if (r.status === 403 && OPCIONALES.has(recurso)) (gp.__eurekaFsSinPermiso ||= {})[recurso] = Date.now() + PAUSA_MS;
    else if ([401, 403, 429].includes(r.status)) gp.__eurekaFsPausa = { hasta: Date.now() + PAUSA_MS, motivo: msg };
    throw new FsError(r.status, msg);
  }
  const j = await r.json().catch(() => null);
  return Array.isArray(j) ? j : j?.data ?? j;
}

// Almacén donde va el stock: el de cualquier fila de stock que ya exista (no hace falta permiso en «almacenes»)
async function almacen(): Promise<string | undefined> {
  if (gp.__eurekaFsAlmacen) return gp.__eurekaFsAlmacen;
  const st = await fs('GET', '/stocks?limit=1');
  let cod = Array.isArray(st) ? st[0]?.codalmacen : undefined;
  if (!cod && !sinPermiso('almacenes')) {
    const alms = await fs('GET', '/almacenes?limit=1').catch(() => null);
    cod = Array.isArray(alms) ? alms[0]?.codalmacen : undefined;
  }
  if (cod) gp.__eurekaFsAlmacen = cod;
  return cod;
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
    // Sin fila de stock todavía: se crea. La referencia puede ser de una talla/color (PEK-0970-01),
    // que no es un producto sino una variante: el producto se saca de la variante.
    const vari = sinPermiso('variantes') ? null : await fs('GET', `/variantes?filter[referencia]=${ref}&limit=1`).catch(() => null);
    let prod = Array.isArray(vari) ? vari[0] : null;
    if (!prod?.idproducto) {
      const prods = await fs('GET', `/productos?filter[referencia]=${ref}&limit=1`);
      prod = Array.isArray(prods) ? prods[0] : null;
    }
    if (!prod?.idproducto) return { ok: false, motivo: 'sin-producto' };
    const codalmacen = await almacen();
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
  if (sinPermiso('variantes')) return;
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

// Lo que falta en FacturaScripts: prendas enteras, o tallas/colores de prendas que ya están.
export type Pendiente = { p: Product; producto: boolean; tallas: number };
export async function faltanEnFs(productos: Product[]): Promise<Pendiente[]> {
  const refs = await referenciasFs();
  const conTallas = productos.some((p) => p.variants?.some((v) => v.sku));
  const vrefs = conTallas && !sinPermiso('variantes') ? await referenciasVariantesFs() : new Set<string>();
  const out: Pendiente[] = [];
  for (const p of productos) {
    if (!p.sku) continue;
    const producto = !refs.has(p.sku.trim().toLowerCase());
    const tallas = (p.variants || []).filter((v) => v.sku && !vrefs.has(v.sku.trim().toLowerCase())).length;
    if (producto || tallas) out.push({ p, producto, tallas });
  }
  return out;
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
      for (const { p, producto, tallas } of faltan) {
        if (pausaFs()) { est.error = pausaFs()!.motivo; break; }   // no insistir: provocaría el bloqueo
        const textos: string[] = [];
        let ok = true;
        if (producto) {
          const r = await asegurarProductoFs(p, { actualizar: false });
          ok = r.ok;
          textos.push(r.ok ? (r.accion === 'creado' ? 'prenda creada' : 'ya estaba') + (('aviso' in r && r.aviso) ? ` (${r.aviso})` : '') : `${r.motivo}${r.detalle ? ': ' + r.detalle : ''}`);
        }
        if (ok && (tallas || producto) && p.variants?.some((v) => v.sku)) {
          const r = await asegurarVariantesFs(p);
          ok = r.ok;
          textos.push(r.ok ? `${r.creadas} tallas/colores creados` : `tallas: ${r.motivo}${r.detalle ? ': ' + r.detalle : ''}`);
        }
        est.pasos.push({ ref: p.sku!, name: p.name, ok, texto: textos.join(' · ') });
        est.hechos++;
        await sleep(300);
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


/* ---------------- Tallas y colores en FacturaScripts ----------------
   Cada talla/color de la web (PEK-0970-01…) es una VARIANTE del producto en FacturaScripts, con sus
   atributos Talla y Color, su código de barras (PEK097001, el de la etiqueta) y su propio stock.
   Así, al pasar la etiqueta por la pistola del TPV, se vende y se descuenta esa talla y ese color. */

async function todas(ruta: string): Promise<any[]> {
  const out: any[] = [];
  const sep = ruta.includes('?') ? '&' : '?';
  for (let offset = 0; offset < 50000; offset += 500) {
    const filas = await fs('GET', `${ruta}${sep}limit=500&offset=${offset}`);
    const lista = Array.isArray(filas) ? filas : [];
    out.push(...lista);
    if (lista.length < 500) break;
    await sleep(200);
  }
  return out;
}

const ATRIBUTOS = { TALLA: 'Talla', COLOR: 'Color' } as const;
type CodAtributo = keyof typeof ATRIBUTOS;

async function valoresAtributo(cod: CodAtributo): Promise<Map<string, number>> {
  const cache = (gp.__eurekaFsAtrib ||= {}) as Record<string, Map<string, number>>;
  if (cache[cod]) return cache[cod];
  const a = await primeraFila(`/atributos?filter[codatributo]=${cod}&limit=1`);
  if (!a?.codatributo) await fs('POST', '/atributos', { codatributo: cod, nombre: ATRIBUTOS[cod] });
  const m = new Map<string, number>();
  for (const v of await todas(`/atributovalores?filter[codatributo]=${cod}`)) if (v?.valor != null && v?.id) m.set(String(v.valor).trim().toLowerCase(), Number(v.id));
  cache[cod] = m;
  return m;
}

async function idValor(cod: CodAtributo, valor: string): Promise<number | undefined> {
  const val = valor.trim();
  if (!val) return undefined;
  const m = await valoresAtributo(cod);
  const k = val.toLowerCase();
  if (m.has(k)) return m.get(k);
  const r = await fs('POST', '/atributovalores', { codatributo: cod, valor: val.slice(0, 100), orden: m.size + 1 });
  let id = Number(r?.id);
  if (!id) id = Number((await primeraFila(`/atributovalores?filter[codatributo]=${cod}&filter[valor]=${encodeURIComponent(val)}&limit=1`))?.id);
  if (id) m.set(k, id);
  return id || undefined;
}

export type FsVariantesResultado = { ok: true; creadas: number; actualizadas: number } | { ok: false; motivo: 'sin-config' | 'sin-producto' | 'error'; detalle?: string };

// Crea (o pone al día) en FacturaScripts las tallas/colores de una prenda. El stock solo se pone al CREAR
// la variante (con el de la web); después cada lado mueve el suyo y se sincronizan.
export async function asegurarVariantesFs(p: Product): Promise<FsVariantesResultado> {
  if (!fsConfigurado()) return { ok: false, motivo: 'sin-config' };
  const vs = (p.variants || []).filter((v) => v.sku);
  if (!p.sku || !vs.length) return { ok: true, creadas: 0, actualizadas: 0 };
  try {
    const prod = await primeraFila(`/productos?filter[referencia]=${encodeURIComponent(p.sku.trim())}&limit=1`);
    if (!prod?.idproducto) return { ok: false, motivo: 'sin-producto' };
    const precio = precioSinIva(p.price);
    let creadas = 0, actualizadas = 0;
    for (const v of vs) {
      const ref = v.sku!.trim();
      const id1 = v.size ? await idValor('TALLA', v.size) : undefined;
      const id2 = v.color ? await idValor('COLOR', v.color) : undefined;
      const datos: Record<string, string | number> = { idproducto: prod.idproducto, referencia: ref, codbarras: codigoBarras(ref), precio };
      if (id1) datos.idatributovalor1 = id1;
      if (id2) datos.idatributovalor2 = id2;
      const ya = await primeraFila(`/variantes?filter[referencia]=${encodeURIComponent(ref)}&limit=1`);
      if (!ya?.idvariante) {
        await fs('POST', '/variantes', datos);
        creadas++;
        await sleep(200);
        await ponerStockFs(ref, Math.max(0, v.stock || 0));
      } else {
        const cambia = String(ya.codbarras || '') !== datos.codbarras || Math.abs(Number(ya.precio) - precio) > 0.004
          || (id1 && Number(ya.idatributovalor1) !== id1) || (id2 && Number(ya.idatributovalor2) !== id2) || Number(ya.idproducto) !== Number(prod.idproducto);
        if (cambia) { await fs('PUT', `/variantes/${ya.idvariante}`, datos); actualizadas++; }
      }
      await sleep(150);
    }
    // La primera vez, el stock que tuviera la prenda «sin talla» pasa a las tallas: la de sin talla queda a 0.
    if (creadas) await ponerStockFs(p.sku.trim(), 0);
    return { ok: true, creadas, actualizadas };
  } catch (e: any) {
    return { ok: false, motivo: 'error', detalle: e?.message || String(e) };
  }
}

// Stock de cada referencia en FacturaScripts (sumando almacenes)
export async function stockPorReferenciaFs(): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  for (const f of await todas('/stocks')) {
    if (!f?.referencia) continue;
    const k = String(f.referencia).trim().toLowerCase();
    m.set(k, (m.get(k) || 0) + (Number(f.cantidad) || 0));
  }
  return m;
}

export async function referenciasVariantesFs(): Promise<Set<string>> {
  return new Set((await todas('/variantes')).filter((v) => v?.referencia).map((v) => String(v.referencia).trim().toLowerCase()));
}

// Venta online pagada: se descuenta en FacturaScripts lo vendido (la talla/color si la tiene).
export async function restarStockFs(lineas: { ref: string; qty: number }[]): Promise<{ ok: boolean; fallos: string[] }> {
  if (!fsConfigurado()) return { ok: false, fallos: ['sin-config'] };
  const fallos: string[] = [];
  for (const l of lineas) {
    try {
      const fila = await primeraFila(`/stocks?filter[referencia]=${encodeURIComponent(l.ref)}&limit=1`);
      if (fila?.idstock) await fs('PUT', `/stocks/${fila.idstock}`, { cantidad: (Number(fila.cantidad) || 0) - l.qty });
      else fallos.push(`${l.ref}: sin stock en FacturaScripts`);
    } catch (e: any) {
      fallos.push(`${l.ref}: ${e?.message || e}`);
    }
    await sleep(150);
  }
  return { ok: fallos.length === 0, fallos };
}
