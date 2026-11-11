// Capa de acceso a datos (repositorio) sobre un archivo JSON.
// DEMO/FOUNDATION: sustituible 1:1 por Prisma/PostgreSQL o @nodaria/core sin tocar los componentes.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DB, Product, Category, Customer, Order, OrderItem } from './types';
import { hasVariants, findVariant, buildVariants, totalStock, vkey, vlabel } from './variants';
import { parseVariantStock } from './catalog-normalize';
import { withCatalogPhotos, hasCatalogPhoto } from './catalog-photos';
import { hashPassword, verifyPassword } from './auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const SEED = path.join(DATA_DIR, 'db.json');     // semilla versionada en git (no se usa en vivo)
const FILE = path.join(DATA_DIR, 'live.json');   // datos reales: NO versionados, persisten entre despliegues

// Crea los datos vivos a partir de la semilla la primera vez. Así `git pull` nunca pisa el catálogo real.
async function ensureFile(): Promise<void> {
  try { await fs.access(FILE); } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(SEED, 'utf8');
    await fs.writeFile(FILE, raw, 'utf8');
  }
}


// ---------- Un solo cambio a la vez ----------
// Cada cambio lee live.json, lo modifica y lo guarda. Sin esto, dos cambios a la vez (un pedido
// mientras FacturaScripts sincroniza el stock, dos clientas pagando…) se pisan y se pierde uno.
// Reentrante: si una función con cerrojo llama a otra, no se bloquea.
import { AsyncLocalStorage } from 'async_hooks';
const lockCtx = new AsyncLocalStorage<boolean>();
let lockChain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  if (lockCtx.getStore()) return fn();
  const run = lockChain.then(() => lockCtx.run(true, fn), () => lockCtx.run(true, fn));
  lockChain = run.catch(() => undefined);
  return run;
}

async function read(): Promise<DB> {
  await ensureFile();
  await (migration ||= migrateCatalog().then(applyDataFixes).catch((e) => { console.error('[catálogo] No se pudo cargar el catálogo nuevo:', e); migration = null; }));
  const raw = await fs.readFile(FILE, 'utf8');
  return JSON.parse(raw) as DB;
}
// Escritura atómica: se escribe un temporal y se renombra (un corte a mitad nunca deja live.json roto).
async function write(db: DB): Promise<void> {
  const tmp = `${FILE}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, FILE);
}

/* ---------- Arreglos puntuales de datos (una sola vez, en orden) ----------
   1) Quita los pedidos y clientas de EJEMPLO que traía la plantilla (María González, Lucía Ramírez y
      Carmen Pérez, con correo @example.com, y sus pedidos EUR-1001 y EUR-1002). Solo esos: se
      comprueba id, correo y referencia a la vez, así que nunca toca una clienta o un pedido real.
   2) Pone descripción a los productos que no tenían (solo si sigue vacía). */
const FIXES_VERSION = 1;
const FIX_DESCRIPTIONS: Record<string, string> = {
  'leggings barbie': 'Leggings de tejido suave y elástico con cinturilla ancha de tiro alto que sujeta y estiliza. Muy cómodos para el día a día y perfectos con jerséis, sudaderas y ponchos.',
  'vaquero faja pitillo': 'Vaquero pitillo con cinturilla efecto faja que recoge la cintura y estiliza la figura. Tejido con elasticidad para un ajuste cómodo que combina con todo.',
};
async function applyDataFixes(): Promise<void> {
  const db = JSON.parse(await fs.readFile(FILE, 'utf8')) as DB & { fixesVersion?: number };
  if ((db.fixesVersion ?? 0) >= FIXES_VERSION) return;
  const demoCust = new Map([['c1', 'maria@example.com'], ['c2', 'lucia@example.com'], ['c3', 'carmen@example.com']]);
  const demoOrders = new Map([['o1', 'EUR-1001'], ['o2', 'EUR-1002']]);
  const beforeC = db.customers.length, beforeO = db.orders.length;
  db.orders = db.orders.filter((o) => !(demoOrders.get(o.id) === o.ref && (!o.customerId || demoCust.has(o.customerId))));
  db.customers = db.customers.filter((c) => demoCust.get(c.id) !== c.email.toLowerCase());
  let desc = 0;
  for (const p of db.products) {
    const d = FIX_DESCRIPTIONS[nname(p.name)];
    if (d && !(p.description || '').trim()) { p.description = d; desc++; }
  }
  db.fixesVersion = FIXES_VERSION;
  await fs.mkdir(path.join(DATA_DIR, 'copias'), { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, 'copias', `antes-de-arreglos-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify(JSON.parse(await fs.readFile(FILE, 'utf8'))), 'utf8');
  await write(db);
  console.log(`[datos] Arreglos aplicados: ${beforeO - db.orders.length} pedidos y ${beforeC - db.customers.length} clientas de ejemplo quitados · ${desc} descripciones añadidas`);
}

/* ---------- Carga de productos nuevos (se ejecuta sola, una vez, al arrancar tras el despliegue) ----------
   Añade lo de data/catalogo.json (plantilla EUREKA + fotos en public/img/productos/nuevas)
   SIN TOCAR lo que ya está en la web:
   · Productos ya subidos con foto real (fotos de la modelo, subidas o incluidas): NO se tocan nada.
   · Productos que existen pero solo con la foto de prueba: se les ponen sus fotos y se rellenan
     SOLO los campos vacíos (no cambia nombre, precio, stock ni nada que ya tenga valor).
   · Productos que no existen: se crean con su referencia PEK correlativa.
   · No borra nada, no renombra nada y no toca pedidos, clientas ni stock.
   · Antes guarda una copia completa en data/copias/ y deja un informe con lo que ha hecho.
   No duplica: empareja por nombre (sin tildes ni mayúsculas) o por el nombre anterior del Excel. */
const CATALOG = path.join(DATA_DIR, 'catalogo.json');
const CATALOG_VERSION = 3;
let migration: Promise<void> | null = null;

type CatalogEntry = {
  name: string; previousNames?: string[]; category: string; categoryName: string; price: number;
  sizes?: string[]; colors?: string[]; description?: string; details?: string; badge?: string;
  stock?: number; variantStockText?: string; image?: string; images?: string[];
  colorImages?: Record<string, string>; colorGallery?: Record<string, string[]>;
};

const realImg = (src?: string) => !!src && /^(\/media\/|\/uploads\/|\/img\/|https?:)/.test(src);
const nname = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

async function migrateCatalog(): Promise<void> {
  const raw = await fs.readFile(FILE, 'utf8');
  const db = JSON.parse(raw) as DB;
  if ((db.catalogVersion ?? 0) >= CATALOG_VERSION) return;
  let catalog: { version: number; products: CatalogEntry[]; removePhotos?: string[] };
  try { catalog = JSON.parse(await fs.readFile(CATALOG, 'utf8')); } catch { return; }
  if (!catalog || catalog.version < CATALOG_VERSION) return;

  // Copia de seguridad de todo tal cual estaba
  const dir = path.join(DATA_DIR, 'copias');
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(path.join(dir, `antes-de-cargar-productos-${stamp}.json`), raw, 'utf8');

  // "Listo" = tiene alguna foto real (de la modelo / subida / incluida en la web). Esos no se tocan.
  const ready = (p: Product) => realImg(p.image) || !!p.images?.some(realImg) ||
    Object.values(p.colorImages || {}).some(realImg) || Object.values(p.colorGallery || {}).flat().some(realImg) ||
    hasCatalogPhoto(p.name);
  const empty = (v: unknown) => v === undefined || v === null || (Array.isArray(v) ? v.length === 0 : !String(v).trim());
  const report = { creados: [] as string[], fotosYDatosAnadidos: [] as string[], sinTocarYaListos: [] as string[], fotosQuitadas: [] as string[] };

  // Fotos que una carga anterior puso en el producto equivocado (una foto = un producto).
  // Solo se quitan esas rutas exactas; nada más de ese producto cambia.
  const wrong = new Set(catalog.removePhotos || []);
  if (wrong.size) for (const p of db.products) {
    const before = JSON.stringify(p);
    if (p.images) p.images = p.images.filter((u) => !wrong.has(u));
    if (p.colorImages) for (const [c, u] of Object.entries(p.colorImages)) if (wrong.has(u)) delete p.colorImages[c];
    if (p.colorGallery) for (const c of Object.keys(p.colorGallery)) p.colorGallery[c] = p.colorGallery[c].filter((u) => !wrong.has(u));
    if (wrong.has(p.image)) p.image = Object.values(p.colorImages || {}).find(realImg) || p.images?.find(realImg) || '26998033';
    if (JSON.stringify(p) !== before) report.fotosQuitadas.push(p.name);
  }

  // Categorías nuevas (las que ya existen no se tocan)
  const newCats = new Set<string>();
  for (const e of catalog.products) {
    if (!db.categories.some((c) => c.slug === e.category)) {
      db.categories.push({ slug: e.category, name: e.categoryName, image: '26998033' });
      newCats.add(e.category);
    }
  }

  const now = new Date().toISOString();
  for (const e of catalog.products) {
    const keys = [e.name, ...(e.previousNames || [])].map(nname);
    const p = db.products.find((x) => nname(x.name) === nname(e.name)) ||
      db.products.find((x) => keys.includes(nname(x.name)) || (x.aliases || []).some((a) => keys.includes(nname(a))));
    const aliases = Array.from(new Set((e.previousNames || []).map((a) => a.trim()).filter((a) => a && nname(a) !== nname(e.name))));
    if (p && ready(p)) {
      // Ya está bien: no se cambia nada de lo que se ve. Solo se apunta (dato interno) el nombre con el
      // que la clienta lo tiene en su Excel, para que al subirlo no se cree un duplicado.
      const known = new Set([nname(p.name), ...(p.aliases || []).map(nname)]);
      const add = [e.name, ...aliases].filter((x) => !known.has(nname(x)) && known.add(nname(x)));
      if (add.length) p.aliases = [...(p.aliases || []), ...add];
      report.sinTocarYaListos.push(p.name); continue;
    }
    if (p) {
      // Existe con foto de prueba: fotos + solo campos vacíos
      const hadSizes = !empty(p.sizes), hadColors = !empty(p.colors);
      if (empty(p.sizes) && e.sizes) p.sizes = e.sizes;
      if (empty(p.colors) && e.colors) p.colors = e.colors;
      if (empty(p.description) && e.description) p.description = e.description;
      if (empty(p.details) && e.details) p.details = e.details;
      if (empty(p.badge) && e.badge) p.badge = e.badge;
      if (e.image) p.image = e.image;
      if (e.images?.length) p.images = e.images;
      const ci: Record<string, string> = {};
      for (const [c, url] of Object.entries(e.colorImages || {})) { const col = (p.colors || []).find((x) => nname(x) === nname(c)); if (col) ci[col] = url; }
      if (Object.keys(ci).length) p.colorImages = ci;
      const cg: Record<string, string[]> = {};
      for (const [c, list] of Object.entries(e.colorGallery || {})) { const col = (p.colors || []).find((x) => nname(x) === nname(c)); if (col) cg[col] = list; }
      if (Object.keys(cg).length) p.colorGallery = cg;
      if (!hadSizes || !hadColors) refreshVariants(p, hasVariants(p) ? undefined : e.variantStockText);
      p.updatedAt = now;
      const known = new Set((p.aliases || []).map(nname));
      const add = aliases.filter((a) => !known.has(nname(a)) && nname(a) !== nname(p.name));
      if (add.length) p.aliases = [...(p.aliases || []), ...add];
      report.fotosYDatosAnadidos.push(p.name);
    } else {
      const prefix = process.env.EUREKA_SKU_PREFIX || 'PEK';
      const n = (db.lastSkuNumber ?? 0) + 1;
      db.lastSkuNumber = n;
      const prod: Product = {
        id: randomUUID().slice(0, 8),
        slug: nname(e.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: e.name, price: e.price, image: e.image || '26998033', stock: e.stock ?? 0, category: e.category,
        badge: e.badge, sku: `${prefix}-${String(n).padStart(4, '0')}`, sizes: e.sizes, colors: e.colors,
        description: e.description, details: e.details, images: e.images, colorImages: e.colorImages, colorGallery: e.colorGallery,
        updatedAt: now,
        ...(aliases.length ? { aliases } : {}),
      };
      refreshVariants(prod, e.variantStockText);
      db.products.push(prod);
      report.creados.push(`${prod.name} (${prod.sku})`);
    }
  }

  // Foto de las categorías NUEVAS: la de su primer producto con foto
  for (const c of db.categories) {
    if (!newCats.has(c.slug)) continue;
    const p = db.products.find((x) => x.category === c.slug && realImg(x.image));
    if (p) c.image = p.image;
  }

  db.catalogVersion = CATALOG_VERSION;
  await write(db);
  await fs.writeFile(path.join(dir, `informe-carga-${stamp}.json`), JSON.stringify(report, null, 2), 'utf8');
  console.log(`[catálogo] Productos cargados: ${report.creados.length} nuevos · ${report.fotosYDatosAnadidos.length} con fotos añadidas · ${report.sinTocarYaListos.length} ya listos sin tocar · ${report.fotosQuitadas.length} con fotos mal puestas quitadas · informe en data/copias/informe-carga-${stamp}.json`);
}

// Recalcula las variantes (talla × color) tras cambiar tallas/colores: conserva referencias y stock.
// `seedText` (columna "Stock por talla y color" del Excel) solo se aplica si el producto aún no
// tiene stock por variante: después el stock se lleva en el panel / con las ventas.
// Sin variantes previas ni `seedText`, el producto sigue con stock total.
function refreshVariants(p: Product, seedText?: string) {
  const seed = seedText ? parseVariantStock(seedText, p.sizes || [], p.colors || []) : undefined;
  const had = hasVariants(p);
  if (!had && !seed) return;
  const hadStock = had && p.variants!.some((v) => v.stock > 0);
  p.variants = buildVariants(p.sku || p.id, p.variants, p.sizes || [], p.colors || [], hadStock ? null : seed);
  if (p.variants) p.stock = totalStock(p.variants);
}

type StockLine = { productId: string; qty: number; size?: string; color?: string };
const lineName = (p: Product, l: StockLine) => {
  const lab = vlabel(l.size, l.color);
  return lab ? `${p.name} (${lab})` : p.name;
};

// Comprueba que hay unidades para todas las líneas (por variante si el producto la tiene).
function checkStock(db: DB, lines: StockLine[]): string | null {
  const need = new Map<string, number>();
  for (const l of lines) {
    const p = db.products.find((x) => x.id === l.productId);
    if (!p) return 'Producto no encontrado.';
    // Solo se puede comprar lo que se ve en la tienda (no lo oculto, sin precio o sin foto)
    if (!shownInShop(p)) return `${p.name} ya no está a la venta.`;
    if (!Number.isInteger(l.qty) || l.qty < 1 || l.qty > 99) return 'Cantidad no válida.';
    const k = p.id + '#' + (hasVariants(p) ? vkey(l.size, l.color) : '');
    const want = (need.get(k) || 0) + l.qty;
    need.set(k, want);
    const avail = hasVariants(p) ? findVariant(p, l.size, l.color)?.stock : p.stock;
    if (avail === undefined) return `${lineName(p, l)}: esa combinación ya no está disponible.`;
    if (avail < want) return avail <= 0 ? `${lineName(p, l)} está agotado.` : avail === 1 ? `Solo queda 1 unidad de ${lineName(p, l)}.` : `Solo quedan ${avail} unidades de ${lineName(p, l)}.`;
  }
  return null;
}

// Descuenta las unidades de una línea (de su variante, o del total).
function takeStock(p: Product, l: StockLine) {
  if (hasVariants(p)) {
    const v = findVariant(p, l.size, l.color);
    if (v) v.stock = Math.max(0, v.stock - l.qty);
    p.stock = totalStock(p.variants!);
  } else p.stock = Math.max(0, p.stock - l.qty);
}

/* -------- Categorías -------- */
export async function listCategories(): Promise<Category[]> {
  return (await read()).categories;
}
export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await read()).categories.find((c) => c.slug === slug);
}
async function createCategory__(data: { name: string; slug: string; image: string }): Promise<Category> {
  const db = await read();
  const cat: Category = { name: data.name, slug: data.slug, image: data.image || '26998033' };
  db.categories.push(cat);
  await write(db);
  return cat;
}
async function deleteCategory__(slug: string): Promise<void> {
  const db = await read();
  db.categories = db.categories.filter((c) => c.slug !== slug);
  await write(db);
}

/* -------- Productos -------- */
// Lecturas para mostrar: completan las fotos que falten con las de lib/catalog-photos.
export async function listProducts(): Promise<Product[]> {
  return (await read()).products.map(withCatalogPhotos);
}
export async function getProduct(id: string): Promise<Product | undefined> {
  const p = (await read()).products.find((x) => x.id === id);
  return p && withCatalogPhotos(p);
}
export async function productsByCategory(slug: string): Promise<Product[]> {
  return (await read()).products.filter((p) => p.category === slug).map(withCatalogPhotos);
}

// ¿Se ve en la tienda? No, si está oculto a mano o si no tiene ninguna foto real
// (vacía o la de prueba). En cuanto se le pone una foto, aparece sola.
export function hasRealPhoto(p: Product): boolean {
  return realImg(p.image) || Object.values(p.colorImages || {}).some(realImg);
}
export function shownInShop(p: Product): boolean {
  return !p.hidden && p.price > 0 && hasRealPhoto(p);   // sin precio tampoco se publica
}
// Lo que ve la clienta en la tienda (las lecturas del panel siguen viendo todo).
export async function listShopProducts(): Promise<Product[]> {
  return (await listProducts()).filter(shownInShop);
}
export async function shopProductsByCategory(slug: string): Promise<Product[]> {
  return (await productsByCategory(slug)).filter(shownInShop);
}
async function setProductHidden__(id: string, hidden: boolean): Promise<void> {
  const db = await read();
  const p = db.products.find((x) => x.id === id);
  if (!p) return;
  if (hidden) p.hidden = true; else delete p.hidden;   // no cambia la fecha: no salta en el orden
  await write(db);
}
async function createProduct__(data: Omit<Product, 'id' | 'slug'> & { slug?: string }, opts?: { variantStockText?: string }): Promise<Product> {
  const db = await read();
  const slug = (data.slug || data.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // SKU automático con prefijo (EUR-0001, EUR-0002…) si no se indica uno.
  let sku = (data.sku || '').trim();
  if (!sku) {
    const prefix = process.env.EUREKA_SKU_PREFIX || 'PEK';
    const n = (db.lastSkuNumber ?? 0) + 1;
    db.lastSkuNumber = n;
    sku = `${prefix}-${String(n).padStart(4, '0')}`;
  }
  const prod: Product = { id: randomUUID().slice(0, 8), slug, name: data.name, price: data.price, image: data.image || '26998033', stock: data.stock ?? 0, category: data.category, badge: data.badge, sku, sizes: data.sizes, colors: data.colors, description: data.description, details: data.details, images: data.images, colorImages: data.colorImages, updatedAt: new Date().toISOString() };
  refreshVariants(prod, opts?.variantStockText);
  db.products.push(prod);
  await write(db);
  return prod;
}
async function updateProduct__(id: string, patch: Partial<Product>): Promise<void> {
  const db = await read();
  const p = db.products.find((x) => x.id === id);
  if (p) {
    Object.assign(p, patch);
    if (hasVariants(p)) p.stock = totalStock(p.variants!); // con variantes, el total es la suma
    p.updatedAt = new Date().toISOString();
  }
  await write(db);
}
async function deleteProduct__(id: string): Promise<void> {
  const db = await read();
  db.products = db.products.filter((p) => p.id !== id);
  await write(db);
}

// Datos de una fila del Excel.
type ImportRow = { name: string; price: number; stock?: number; category?: string; image?: string; badge?: string; sizes?: string[]; colors?: string[]; description?: string; details?: string; keepStock?: boolean; variantStockText?: string; fillOnly?: boolean };
export type ImportResult = { created: boolean; changed: boolean; product: Product };

// Aplica una fila del Excel a un producto que ya existe.
// fillOnly ("solo completar lo que falta"): no cambia nada que ya tenga valor (nombre, precio,
// fotos, stock, textos). Solo rellena campos vacíos. Así los productos ya listos no se tocan.
function applyRow(p: Product, data: ImportRow, renamed: boolean): boolean {
  const before = JSON.stringify(p);
  const empty = (v: unknown) => v === undefined || v === null || (Array.isArray(v) ? v.length === 0 : !String(v).trim());
  if (data.fillOnly) {
    // Renombrar solo si se pide con "Nombre anterior", o si el nombre actual está todo en MAYÚSCULAS.
    if (renamed || (p.name === p.name.toUpperCase() && /[A-Z]/.test(p.name))) p.name = data.name;
    if (!p.price && data.price) p.price = data.price;
    if (empty(p.badge) && data.badge) p.badge = data.badge;
    if (empty(p.sizes) && data.sizes?.length) p.sizes = data.sizes;
    if (empty(p.colors) && data.colors?.length) p.colors = data.colors;
    if (empty(p.description) && data.description) p.description = data.description;
    if (empty(p.details) && data.details) p.details = data.details;
  } else {
    p.name = data.name;
    p.price = data.price;
    if (data.category) p.category = data.category;
    if (data.image) p.image = data.image;
    if (data.badge !== undefined) p.badge = data.badge;
    if (data.stock !== undefined && !data.keepStock) p.stock = data.stock; // keepStock: el stock lo manda FS
    if (data.sizes !== undefined) p.sizes = data.sizes;
    if (data.colors !== undefined) p.colors = data.colors;
    if (data.description !== undefined) p.description = data.description;
    if (data.details !== undefined) p.details = data.details;
  }
  refreshVariants(p, data.variantStockText);
  const changed = JSON.stringify(p) !== before;
  if (changed) p.updatedAt = new Date().toISOString();
  return changed;
}


/* -------- Sincronización con FacturaScripts -------- */
// Alta/actualización de producto por SKU (referencia). FS->web para artículos creados en FacturaScripts.
async function upsertProductBySku__(data: ImportRow & { sku: string }): Promise<ImportResult> {
  const db = await read();
  const sku = data.sku.trim();
  let p = db.products.find((x) => x.sku && x.sku.toLowerCase() === sku.toLowerCase());
  if (p) {
    const changed = applyRow(p, data, false);
    if (changed) await write(db);
    return { created: false, changed, product: p };
  }
  const slug = (data.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || sku.toLowerCase();
  p = { id: randomUUID().slice(0, 8), slug, name: data.name, price: data.price, image: data.image || '26998033', stock: data.stock ?? 0, category: data.category || 'tops', badge: data.badge, sku, sizes: data.sizes, colors: data.colors, description: data.description, details: data.details, updatedAt: new Date().toISOString() };
  refreshVariants(p, data.variantStockText);
  db.products.push(p);
  await write(db);
  return { created: true, changed: true, product: p };
}

// Alta/actualización por NOMBRE (para importaciones de Excel SIN referencia).
// Empareja por nombre normalizado (ignora mayúsculas/acentos/espacios) para no duplicar.
// Si el existente no tiene SKU aún, NO lo inventa aquí (se respeta el que ya tenga).
async function upsertProductByName__(data: ImportRow & { previousName?: string }): Promise<ImportResult> {
  const db = await read();
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const target = norm(data.name);
  // Busca por el nombre actual; si no está y viene "nombre anterior", por ese (y lo renombra).
  const prev = data.previousName ? norm(data.previousName) : '';
  const byName = db.products.find((x) => norm(x.name) === target);
  // El Excel de la clienta puede llamar al producto como ella lo tiene (p. ej. "BOLSAO PELITO NEGRO"):
  // se reconoce por sus otros nombres y se respeta el nombre de la web.
  const byAlias = byName ? undefined : db.products.find((x) => (x.aliases || []).some((a) => norm(a) === target || (prev && norm(a) === prev)));
  const p = byName || byAlias || (prev ? db.products.find((x) => norm(x.name) === prev) : undefined);
  if (p) {
    if (byAlias) data = { ...data, name: p.name };
    const changed = applyRow(p, data, !byName && !byAlias);
    if (changed) await write(db);
    return { created: false, changed, product: p };
  } // el alta la hace createProduct (genera SKU y slug)
  const created = await createProduct({ name: data.name, price: data.price, stock: data.stock ?? 0, category: data.category || 'tops', image: data.image || '26998033', badge: data.badge, sizes: data.sizes, colors: data.colors, description: data.description, details: data.details }, { variantStockText: data.variantStockText });
  return { created: true, changed: true, product: created };
}

// Ajuste de stock por SKU (FS manda sobre el stock). No toca campos de catálogo.
// Acepta la referencia del producto o la de una variante (PEK-0973-01). Si llega la referencia
// del producto entero y éste lleva stock por talla/color, se ignora para no pisar el desglose.
async function setStockBySku__(items: { sku: string; stock: number }[]): Promise<{ updated: number; missing: string[]; ignored: string[] }> {
  const db = await read();
  let updated = 0;
  const missing: string[] = [];
  const ignored: string[] = [];
  for (const it of items) {
    const sku = it.sku.toLowerCase().trim();
    const qty = Math.max(0, Math.round(it.stock));
    let found = false;
    for (const p of db.products) {
      const v = p.variants?.find((x) => x.sku && x.sku.toLowerCase() === sku);
      if (v) { v.stock = qty; p.stock = totalStock(p.variants!); updated++; found = true; break; }
      if (p.sku && p.sku.toLowerCase() === sku) {
        if (hasVariants(p)) ignored.push(it.sku); else { p.stock = qty; updated++; }
        found = true; break;
      }
    }
    if (!found) missing.push(it.sku);
  }
  await write(db);
  return { updated, missing, ignored };
}

// Pedidos aún no volcados a FacturaScripts.
export async function listPendingOrders(): Promise<Order[]> {
  // Pedidos confirmados aún no volcados a FS. Se excluyen los cancelados y los
  // pedidos online que siguen a la espera de pago en Stripe (sesión creada y todavía 'pendiente').
  return (await read()).orders.filter(
    (o) => !o.syncedAt && o.status !== 'cancelado' && !(o.stripeSessionId && o.status === 'pendiente')
  );
}
// Marcar un pedido como volcado a FacturaScripts.
async function markOrderSynced__(id: string, facturaRef?: string): Promise<boolean> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return false;
  o.syncedAt = new Date().toISOString();
  if (facturaRef) o.facturaRef = facturaRef;
  await write(db);
  return true;
}

/* -------- Pedidos -------- */
export async function listOrders(): Promise<Order[]> {
  return (await read()).orders.slice().reverse();
}
async function createOrder__(input: { items: { productId: string; qty: number; size?: string; color?: string }[]; customerName?: string; customerEmail?: string }): Promise<{ ok: boolean; order?: Order; error?: string }> {
  const db = await read();
  if (!input.items.length) return { ok: false, error: 'La cesta está vacía.' };
  const items: OrderItem[] = [];
  const err = checkStock(db, input.items); // por talla/color si el producto la lleva
  if (err) return { ok: false, error: err };
  for (const line of input.items) {
    const p = db.products.find((x) => x.id === line.productId)!;
    const variantSku = findVariant(p, line.size, line.color)?.sku;
    takeStock(p, line);
    items.push({ productId: p.id, name: p.name, price: p.price, qty: line.qty, size: line.size, color: line.color, variantSku });
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  db.lastOrderNumber += 1;
  const now = new Date().toISOString();
  const order: Order = {
    stockTaken: true,
    id: randomUUID().slice(0, 8),
    ref: 'EUR-' + db.lastOrderNumber,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    items,
    total,
    status: 'pendiente',
    createdAt: now,
    history: [{ status: 'pendiente', at: now }],
  };
  // enlazar/crear cliente por email (opcional)
  if (input.customerEmail) {
    let cust = db.customers.find((c) => c.email.toLowerCase() === input.customerEmail!.toLowerCase());
    if (!cust) {
      cust = { id: randomUUID().slice(0, 8), name: input.customerName || input.customerEmail, email: input.customerEmail, balance: 0, movements: [], createdAt: new Date().toISOString() };
      db.customers.push(cust);
    }
    order.customerId = cust.id;
    order.customerName = cust.name;
  }
  db.orders.push(order);
  await write(db);
  return { ok: true, order };
}
// Crea un pedido PENDIENTE de pago (checkout online con Stripe). NO descuenta stock:
// el stock se descuenta al confirmarse el pago (markOrderPaid). Valida que haya stock.
async function createPendingOrder__(input: { items: { productId: string; qty: number; size?: string; color?: string }[]; customerName?: string; customerEmail?: string }): Promise<{ ok: boolean; order?: Order; error?: string }> {
  const db = await read();
  if (!input.items.length) return { ok: false, error: 'La cesta está vacía.' };
  const items: OrderItem[] = [];
  const err = checkStock(db, input.items); // no descuenta: se descuenta al confirmarse el pago
  if (err) return { ok: false, error: err };
  for (const line of input.items) {
    const p = db.products.find((x) => x.id === line.productId)!;
    const variantSku = findVariant(p, line.size, line.color)?.sku;
    items.push({ productId: p.id, name: p.name, price: p.price, qty: line.qty, size: line.size, color: line.color, variantSku });
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  db.lastOrderNumber += 1;
  const now = new Date().toISOString();
  const order: Order = {
    id: randomUUID().slice(0, 8),
    ref: 'EUR-' + db.lastOrderNumber,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    items,
    total,
    status: 'pendiente',
    createdAt: now,
    history: [{ status: 'pendiente', at: now }],
    stockTaken: false,
  };
  if (input.customerEmail) {
    let cust = db.customers.find((c) => c.email.toLowerCase() === input.customerEmail!.toLowerCase());
    if (!cust) {
      cust = { id: randomUUID().slice(0, 8), name: input.customerName || input.customerEmail, email: input.customerEmail, balance: 0, movements: [], createdAt: new Date().toISOString() };
      db.customers.push(cust);
    }
    order.customerId = cust.id;
    order.customerName = cust.name;
  }
  db.orders.push(order);
  await write(db);
  return { ok: true, order };
}

// Guarda el id de la sesión de Stripe en el pedido.
async function setOrderStripeSession__(id: string, sessionId: string): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (o) o.stripeSessionId = sessionId;
  await write(db);
}

export async function getOrderByStripeSession(sessionId: string): Promise<Order | undefined> {
  return (await read()).orders.find((o) => o.stripeSessionId === sessionId);
}

// Marca un pedido como pagado y descuenta el stock (idempotente: si ya no está 'pendiente', no hace nada).
async function markOrderPaid__(id: string, details?: Partial<Pick<Order, 'customerEmail' | 'customerName' | 'phone' | 'shipping' | 'amountPaid' | 'shippingCost' | 'discount'>>): Promise<{ ok: boolean; order?: Order; alreadyPaid?: boolean; error?: string }> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: 'Pedido no encontrado.' };
  // Datos de Stripe (dirección, teléfono, importe cobrado): se guardan aunque ya estuviera pagado
  if (details) {
    for (const [k, v] of Object.entries(details)) if (v !== undefined && v !== null && v !== '' && !(o as any)[k]) (o as any)[k] = v;
    if (o.customerEmail && !o.customerId) {
      const em = o.customerEmail.toLowerCase();
      let cust = db.customers.find((c) => c.email.toLowerCase() === em);
      if (!cust) { cust = { id: randomUUID().slice(0, 8), name: o.customerName || o.customerEmail, email: o.customerEmail, balance: 0, movements: [], createdAt: new Date().toISOString() }; db.customers.push(cust); }
      o.customerId = cust.id;
      if (!o.customerName) o.customerName = cust.name;
    }
  }
  if (o.status !== 'pendiente') { if (details) await write(db); return { ok: true, order: o, alreadyPaid: true }; }
  o.paidAt = new Date().toISOString();
  for (const it of o.items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (p) takeStock(p, it);
  }
  o.status = 'pagado';
  o.stockTaken = true;
  if (!o.history) o.history = [];
  o.history.push({ status: 'pagado', at: new Date().toISOString() });
  await write(db);
  return { ok: true, order: o };
}

async function noteOrderEmail__(id: string, kind: 'confirmacion' | 'enviado' | 'tienda'): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return;
  o.emails = { ...(o.emails || {}), [kind]: new Date().toISOString() };
  await write(db);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  return (await read()).orders.find((o) => o.id === id);
}

// ¿Este pedido ya descontó stock? (los antiguos no lo guardaban: se deduce del estado)
function stockTakenOf(o: Order): boolean {
  if (o.stockTaken !== undefined) return o.stockTaken;
  return o.status !== 'cancelado' && !(o.stripeSessionId && o.status === 'pendiente');
}
function giveStock(p: Product, l: StockLine) {
  if (hasVariants(p)) {
    const v = findVariant(p, l.size, l.color);
    if (v) v.stock += l.qty;
    p.stock = totalStock(p.variants!);
  } else p.stock += l.qty;
}

// Cambia el estado. Al cancelar se devuelven las unidades al stock; al "descancelar" se vuelven a descontar.
async function updateOrderStatus__(id: string, status: Order['status'], note?: string): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return;
  const changed = o.status !== status;
  if (changed) {
    const taken = stockTakenOf(o);
    if (status === 'cancelado' && taken) {
      for (const it of o.items) { const p = db.products.find((x) => x.id === it.productId); if (p) giveStock(p, it); }
      o.stockTaken = false;
    } else if (o.status === 'cancelado' && status !== 'cancelado' && !taken && !(o.stripeSessionId && status === 'pendiente')) {
      for (const it of o.items) { const p = db.products.find((x) => x.id === it.productId); if (p) takeStock(p, it); }
      o.stockTaken = true;
    } else if (o.stockTaken === undefined) o.stockTaken = taken;
    o.status = status;
  }
  const n = (note || '').trim().slice(0, 500);
  if (changed || n) {
    if (!o.history) o.history = [];
    o.history.push({ status, at: new Date().toISOString(), ...(n ? { note: n } : {}) });
  }
  await write(db);
}

async function updateOrderInfo__(id: string, patch: Partial<Pick<Order, 'customerName' | 'customerEmail' | 'phone' | 'shipping' | 'carrier' | 'trackingNumber' | 'trackingUrl' | 'notes'>>): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === '' || v === null) delete (o as any)[k]; else (o as any)[k] = v;
  }
  o.editedAt = new Date().toISOString();
  await write(db);
}

// Cambiar artículos de un pedido: cantidades (0 = quitar) y líneas nuevas. Si el pedido ya
// descontó stock, se ajusta la diferencia. Devuelve error si no hay stock para lo añadido.
async function updateOrderItems__(id: string, qtys: number[], add?: { productId: string; size?: string; color?: string; qty: number }): Promise<{ ok: boolean; error?: string }> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: 'Pedido no encontrado.' };
  const taken = stockTakenOf(o);
  const next: OrderItem[] = [];
  const deltas: { p: Product; line: StockLine; diff: number }[] = [];
  o.items.forEach((it, i) => {
    const q = Math.max(0, Math.min(99, Math.floor(Number(qtys[i] ?? it.qty))));
    const p = db.products.find((x) => x.id === it.productId);
    if (p && q !== it.qty) deltas.push({ p, line: it, diff: q - it.qty });
    if (q > 0) next.push({ ...it, qty: q });
  });
  if (add && add.productId && add.qty > 0) {
    const p = db.products.find((x) => x.id === add.productId);
    if (!p) return { ok: false, error: 'Producto no encontrado.' };
    if (hasVariants(p) && !findVariant(p, add.size, add.color)) return { ok: false, error: 'Elige talla y color del producto.' };
    const same = next.find((x) => x.productId === p.id && (x.size || '') === (add.size || '') && (x.color || '') === (add.color || ''));
    if (same) same.qty += add.qty;
    else next.push({ productId: p.id, name: p.name, price: p.price, qty: add.qty, size: add.size || undefined, color: add.color || undefined, variantSku: findVariant(p, add.size, add.color)?.sku });
    deltas.push({ p, line: { productId: p.id, qty: add.qty, size: add.size, color: add.color }, diff: add.qty });
  }
  if (!next.length) return { ok: false, error: 'El pedido no puede quedarse sin artículos (si no lo quieres, cancélalo o elimínalo).' };
  if (taken) {
    for (const d of deltas) {
      if (d.diff > 0) {
        const avail = hasVariants(d.p) ? findVariant(d.p, d.line.size, d.line.color)?.stock ?? 0 : d.p.stock;
        if (avail < d.diff) return { ok: false, error: `No hay stock suficiente de ${d.p.name}${d.line.size || d.line.color ? ' (' + [d.line.size, d.line.color].filter(Boolean).join(' · ') + ')' : ''}: quedan ${avail}.` };
      }
    }
    for (const d of deltas) d.diff > 0 ? takeStock(d.p, { ...d.line, qty: d.diff }) : giveStock(d.p, { ...d.line, qty: -d.diff });
  }
  o.items = next;
  o.total = next.reduce((s, i) => s + i.price * i.qty, 0);
  o.editedAt = new Date().toISOString();
  await write(db);
  return { ok: true };
}

// Eliminar un pedido (por ejemplo, de prueba). Si había descontado stock, se devuelve.
async function deleteOrder__(id: string, restock: boolean): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return;
  if (restock && stockTakenOf(o)) for (const it of o.items) { const p = db.products.find((x) => x.id === it.productId); if (p) giveStock(p, it); }
  db.orders = db.orders.filter((x) => x.id !== id);
  await write(db);
}

// Eliminar una clienta: se borra su ficha, su cuenta y su saldo. Sus pedidos se conservan
// (hacen falta para la contabilidad) pero quedan sin enlazar a ninguna cuenta.
async function deleteCustomer__(id: string): Promise<void> {
  const db = await read();
  db.customers = db.customers.filter((c) => c.id !== id);
  for (const o of db.orders) if (o.customerId === id) delete o.customerId;
  await write(db);
}

// Busca un pedido por referencia + email para el seguimiento público (sin login).
export async function findOrderForTracking(ref: string, email: string): Promise<Order | undefined> {
  const r = ref.trim().toLowerCase();
  const e = email.trim().toLowerCase();
  if (!r || !e) return undefined;
  const db = await read();
  return db.orders.find(
    (o) => o.ref.toLowerCase() === r && (o.customerEmail || '').toLowerCase() === e
  );
}

/* -------- Clientes / balance -------- */
export async function listCustomers(): Promise<Customer[]> {
  return (await read()).customers;
}
export async function getCustomer(id: string): Promise<Customer | undefined> {
  return (await read()).customers.find((c) => c.id === id);
}
async function adjustBalance__(id: string, amount: number, reason: string): Promise<void> {
  const db = await read();
  const c = db.customers.find((x) => x.id === id);
  if (c) {
    c.balance += amount;
    c.movements.push({ id: randomUUID().slice(0, 8), amount, reason: reason || 'Ajuste manual', createdAt: new Date().toISOString() });
  }
  await write(db);
}

/* -------- Autenticación de clientes -------- */
async function registerCustomer__(data: { name: string; email: string; password: string }): Promise<{ ok: boolean; customerId?: string; error?: string; verify?: { token: string; email: string; name: string } }> {
  const email = data.email.toLowerCase().trim();
  if (!email || !email.includes('@')) return { ok: false, error: 'Introduce un correo válido.' };
  if (!data.password || data.password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  const db = await read();
  const existing = db.customers.find((c) => c.email.toLowerCase() === email);
  if (existing) {
    if (existing.passwordHash) return { ok: false, error: 'Ya existe una cuenta con ese correo. Inicia sesión.' };
    // Ya compró como invitada con este correo: sus pedidos y su saldo están ahí, así que antes de
    // ponerle contraseña se confirma que el correo es suyo (enlace por email, 24 h).
    const token = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    existing.pendingClaim = { hash: hashPassword(data.password), token, exp: Date.now() + 24 * 60 * 60 * 1000, name: data.name || undefined };
    await write(db);
    return { ok: false, verify: { token, email: existing.email, name: data.name || existing.name } };
  }
  const cust: Customer = {
    id: randomUUID().slice(0, 8), name: data.name || email, email, balance: 0, movements: [],
    createdAt: new Date().toISOString(), passwordHash: hashPassword(data.password),
  };
  db.customers.push(cust);
  await write(db);
  return { ok: true, customerId: cust.id };
}

async function confirmClaim__(token: string): Promise<{ ok: boolean; customerId?: string; error?: string }> {
  if (!token) return { ok: false, error: 'Enlace no válido.' };
  const db = await read();
  const c = db.customers.find((x) => x.pendingClaim?.token === token);
  if (!c || !c.pendingClaim) return { ok: false, error: 'El enlace no es válido o ya se usó.' };
  if (c.pendingClaim.exp < Date.now()) { delete c.pendingClaim; await write(db); return { ok: false, error: 'El enlace ha caducado. Vuelve a crear la cuenta para recibir otro.' }; }
  c.passwordHash = c.pendingClaim.hash;
  if (c.pendingClaim.name) c.name = c.pendingClaim.name;
  delete c.pendingClaim;
  await write(db);
  return { ok: true, customerId: c.id };
}

export async function findPendingClaim(token: string): Promise<{ email: string } | null> {
  if (!token) return null;
  const c = (await read()).customers.find((x) => x.pendingClaim?.token === token && x.pendingClaim.exp > Date.now());
  return c ? { email: c.email } : null;
}

export async function authenticate(email: string, password: string): Promise<{ ok: boolean; customerId?: string; error?: string }> {
  const db = await read();
  const c = db.customers.find((x) => x.email.toLowerCase() === email.toLowerCase().trim());
  if (!c || !verifyPassword(password, c.passwordHash)) return { ok: false, error: 'Correo o contraseña incorrectos.' };
  return { ok: true, customerId: c.id };
}

// Cuenta a partir del id de sesión (login real)
export async function getAccountById(id: string): Promise<{ customer: Customer; orders: Order[] } | undefined> {
  const db = await read();
  const c = db.customers.find((x) => x.id === id);
  if (!c) return undefined;
  const orders = db.orders.filter((o) => o.customerId === c.id).slice().reverse();
  return { customer: c, orders };
}

/* -------- Métricas -------- */
export async function stats() {
  const db = await read();
  // Ventas = lo cobrado de los pedidos pagados (no cuenta pendientes sin pagar ni cancelados)
  const ventas = db.orders.filter((o) => o.status !== 'cancelado' && !(o.status === 'pendiente' && o.stripeSessionId)).reduce((s, o) => s + (o.amountPaid ?? o.total), 0);
  const lowStock = db.products.filter((p) => p.stock <= 3);
  return {
    productos: db.products.length,
    categorias: db.categories.length,
    pedidos: db.orders.length,
    clientes: db.customers.length,
    ventas,
    pendientes: db.orders.filter((o) => o.status === 'pagado' || o.status === 'preparando' || (o.status === 'pendiente' && !o.stripeSessionId)).length,   // por preparar/enviar
    lowStock,
  };
}

export function createCategory(...a: Parameters<typeof createCategory__>): ReturnType<typeof createCategory__> { return locked(() => createCategory__(...a)) as ReturnType<typeof createCategory__>; }
export function deleteCategory(...a: Parameters<typeof deleteCategory__>): ReturnType<typeof deleteCategory__> { return locked(() => deleteCategory__(...a)) as ReturnType<typeof deleteCategory__>; }
export function setProductHidden(...a: Parameters<typeof setProductHidden__>): ReturnType<typeof setProductHidden__> { return locked(() => setProductHidden__(...a)) as ReturnType<typeof setProductHidden__>; }
export function createProduct(...a: Parameters<typeof createProduct__>): ReturnType<typeof createProduct__> { return locked(() => createProduct__(...a)) as ReturnType<typeof createProduct__>; }
export function updateProduct(...a: Parameters<typeof updateProduct__>): ReturnType<typeof updateProduct__> { return locked(() => updateProduct__(...a)) as ReturnType<typeof updateProduct__>; }
export function deleteProduct(...a: Parameters<typeof deleteProduct__>): ReturnType<typeof deleteProduct__> { return locked(() => deleteProduct__(...a)) as ReturnType<typeof deleteProduct__>; }
export function upsertProductBySku(...a: Parameters<typeof upsertProductBySku__>): ReturnType<typeof upsertProductBySku__> { return locked(() => upsertProductBySku__(...a)) as ReturnType<typeof upsertProductBySku__>; }
export function upsertProductByName(...a: Parameters<typeof upsertProductByName__>): ReturnType<typeof upsertProductByName__> { return locked(() => upsertProductByName__(...a)) as ReturnType<typeof upsertProductByName__>; }
export function setStockBySku(...a: Parameters<typeof setStockBySku__>): ReturnType<typeof setStockBySku__> { return locked(() => setStockBySku__(...a)) as ReturnType<typeof setStockBySku__>; }
export function markOrderSynced(...a: Parameters<typeof markOrderSynced__>): ReturnType<typeof markOrderSynced__> { return locked(() => markOrderSynced__(...a)) as ReturnType<typeof markOrderSynced__>; }
export function createOrder(...a: Parameters<typeof createOrder__>): ReturnType<typeof createOrder__> { return locked(() => createOrder__(...a)) as ReturnType<typeof createOrder__>; }
export function createPendingOrder(...a: Parameters<typeof createPendingOrder__>): ReturnType<typeof createPendingOrder__> { return locked(() => createPendingOrder__(...a)) as ReturnType<typeof createPendingOrder__>; }
export function setOrderStripeSession(...a: Parameters<typeof setOrderStripeSession__>): ReturnType<typeof setOrderStripeSession__> { return locked(() => setOrderStripeSession__(...a)) as ReturnType<typeof setOrderStripeSession__>; }
export function markOrderPaid(...a: Parameters<typeof markOrderPaid__>): ReturnType<typeof markOrderPaid__> { return locked(() => markOrderPaid__(...a)) as ReturnType<typeof markOrderPaid__>; }
export function updateOrderStatus(...a: Parameters<typeof updateOrderStatus__>): ReturnType<typeof updateOrderStatus__> { return locked(() => updateOrderStatus__(...a)) as ReturnType<typeof updateOrderStatus__>; }
export function adjustBalance(...a: Parameters<typeof adjustBalance__>): ReturnType<typeof adjustBalance__> { return locked(() => adjustBalance__(...a)) as ReturnType<typeof adjustBalance__>; }
export function registerCustomer(...a: Parameters<typeof registerCustomer__>): ReturnType<typeof registerCustomer__> { return locked(() => registerCustomer__(...a)) as ReturnType<typeof registerCustomer__>; }
export function noteOrderEmail(...a: Parameters<typeof noteOrderEmail__>): ReturnType<typeof noteOrderEmail__> { return locked(() => noteOrderEmail__(...a)) as ReturnType<typeof noteOrderEmail__>; }
export function confirmClaim(...a: Parameters<typeof confirmClaim__>): ReturnType<typeof confirmClaim__> { return locked(() => confirmClaim__(...a)) as ReturnType<typeof confirmClaim__>; }
export function updateOrderInfo(...a: Parameters<typeof updateOrderInfo__>): ReturnType<typeof updateOrderInfo__> { return locked(() => updateOrderInfo__(...a)) as ReturnType<typeof updateOrderInfo__>; }
export function updateOrderItems(...a: Parameters<typeof updateOrderItems__>): ReturnType<typeof updateOrderItems__> { return locked(() => updateOrderItems__(...a)) as ReturnType<typeof updateOrderItems__>; }
export function deleteOrder(...a: Parameters<typeof deleteOrder__>): ReturnType<typeof deleteOrder__> { return locked(() => deleteOrder__(...a)) as ReturnType<typeof deleteOrder__>; }
export function deleteCustomer(...a: Parameters<typeof deleteCustomer__>): ReturnType<typeof deleteCustomer__> { return locked(() => deleteCustomer__(...a)) as ReturnType<typeof deleteCustomer__>; }