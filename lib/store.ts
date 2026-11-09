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

async function read(): Promise<DB> {
  await ensureFile();
  await (migration ||= migrateCatalog().catch((e) => { console.error('[catálogo] No se pudo cargar el catálogo nuevo:', e); migration = null; }));
  const raw = await fs.readFile(FILE, 'utf8');
  return JSON.parse(raw) as DB;
}
// Escritura atómica: se escribe un temporal y se renombra (un corte a mitad nunca deja live.json roto).
async function write(db: DB): Promise<void> {
  const tmp = `${FILE}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, FILE);
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
    const p = db.products.find((x) => nname(x.name) === nname(e.name)) || db.products.find((x) => keys.includes(nname(x.name)));
    if (p && ready(p)) { report.sinTocarYaListos.push(p.name); continue; }   // ya está bien: ni se mira
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
export async function createCategory(data: { name: string; slug: string; image: string }): Promise<Category> {
  const db = await read();
  const cat: Category = { name: data.name, slug: data.slug, image: data.image || '26998033' };
  db.categories.push(cat);
  await write(db);
  return cat;
}
export async function deleteCategory(slug: string): Promise<void> {
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
export async function setProductHidden(id: string, hidden: boolean): Promise<void> {
  const db = await read();
  const p = db.products.find((x) => x.id === id);
  if (!p) return;
  if (hidden) p.hidden = true; else delete p.hidden;   // no cambia la fecha: no salta en el orden
  await write(db);
}
export async function createProduct(data: Omit<Product, 'id' | 'slug'> & { slug?: string }, opts?: { variantStockText?: string }): Promise<Product> {
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
export async function updateProduct(id: string, patch: Partial<Product>): Promise<void> {
  const db = await read();
  const p = db.products.find((x) => x.id === id);
  if (p) {
    Object.assign(p, patch);
    if (hasVariants(p)) p.stock = totalStock(p.variants!); // con variantes, el total es la suma
    p.updatedAt = new Date().toISOString();
  }
  await write(db);
}
export async function deleteProduct(id: string): Promise<void> {
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
export async function upsertProductBySku(data: ImportRow & { sku: string }): Promise<ImportResult> {
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
export async function upsertProductByName(data: ImportRow & { previousName?: string }): Promise<ImportResult> {
  const db = await read();
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const target = norm(data.name);
  // Busca por el nombre actual; si no está y viene "nombre anterior", por ese (y lo renombra).
  const prev = data.previousName ? norm(data.previousName) : '';
  const byName = db.products.find((x) => norm(x.name) === target);
  const p = byName || (prev ? db.products.find((x) => norm(x.name) === prev) : undefined);
  if (p) {
    const changed = applyRow(p, data, !byName);
    if (changed) await write(db);
    return { created: false, changed, product: p };
  } // el alta la hace createProduct (genera SKU y slug)
  const created = await createProduct({ name: data.name, price: data.price, stock: data.stock ?? 0, category: data.category || 'tops', image: data.image || '26998033', badge: data.badge, sizes: data.sizes, colors: data.colors, description: data.description, details: data.details }, { variantStockText: data.variantStockText });
  return { created: true, changed: true, product: created };
}

// Ajuste de stock por SKU (FS manda sobre el stock). No toca campos de catálogo.
// Acepta la referencia del producto o la de una variante (PEK-0973-01). Si llega la referencia
// del producto entero y éste lleva stock por talla/color, se ignora para no pisar el desglose.
export async function setStockBySku(items: { sku: string; stock: number }[]): Promise<{ updated: number; missing: string[]; ignored: string[] }> {
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
export async function markOrderSynced(id: string, facturaRef?: string): Promise<boolean> {
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
export async function createOrder(input: { items: { productId: string; qty: number; size?: string; color?: string }[]; customerName?: string; customerEmail?: string }): Promise<{ ok: boolean; order?: Order; error?: string }> {
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
export async function createPendingOrder(input: { items: { productId: string; qty: number; size?: string; color?: string }[]; customerName?: string; customerEmail?: string }): Promise<{ ok: boolean; order?: Order; error?: string }> {
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
export async function setOrderStripeSession(id: string, sessionId: string): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (o) o.stripeSessionId = sessionId;
  await write(db);
}

export async function getOrderByStripeSession(sessionId: string): Promise<Order | undefined> {
  return (await read()).orders.find((o) => o.stripeSessionId === sessionId);
}

// Marca un pedido como pagado y descuenta el stock (idempotente: si ya no está 'pendiente', no hace nada).
export async function markOrderPaid(id: string): Promise<{ ok: boolean; order?: Order; alreadyPaid?: boolean; error?: string }> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: 'Pedido no encontrado.' };
  if (o.status !== 'pendiente') return { ok: true, order: o, alreadyPaid: true };
  for (const it of o.items) {
    const p = db.products.find((x) => x.id === it.productId);
    if (p) takeStock(p, it);
  }
  o.status = 'pagado';
  if (!o.history) o.history = [];
  o.history.push({ status: 'pagado', at: new Date().toISOString() });
  await write(db);
  return { ok: true, order: o };
}

export async function updateOrderStatus(id: string, status: Order['status']): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (o && o.status !== status) {
    o.status = status;
    if (!o.history) o.history = [];
    o.history.push({ status, at: new Date().toISOString() });
  }
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
export async function adjustBalance(id: string, amount: number, reason: string): Promise<void> {
  const db = await read();
  const c = db.customers.find((x) => x.id === id);
  if (c) {
    c.balance += amount;
    c.movements.push({ id: randomUUID().slice(0, 8), amount, reason: reason || 'Ajuste manual', createdAt: new Date().toISOString() });
  }
  await write(db);
}

/* -------- Autenticación de clientes -------- */
export async function registerCustomer(data: { name: string; email: string; password: string }): Promise<{ ok: boolean; customerId?: string; error?: string }> {
  const email = data.email.toLowerCase().trim();
  if (!email || !email.includes('@')) return { ok: false, error: 'Introduce un correo válido.' };
  if (!data.password || data.password.length < 6) return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  const db = await read();
  const existing = db.customers.find((c) => c.email.toLowerCase() === email);
  if (existing) {
    if (existing.passwordHash) return { ok: false, error: 'Ya existe una cuenta con ese correo. Inicia sesión.' };
    // Cliente creado como invitado por un pedido: reclama su cuenta poniéndole contraseña.
    existing.passwordHash = hashPassword(data.password);
    if (data.name) existing.name = data.name;
    await write(db);
    return { ok: true, customerId: existing.id };
  }
  const cust: Customer = {
    id: randomUUID().slice(0, 8), name: data.name || email, email, balance: 0, movements: [],
    createdAt: new Date().toISOString(), passwordHash: hashPassword(data.password),
  };
  db.customers.push(cust);
  await write(db);
  return { ok: true, customerId: cust.id };
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
  const ventas = db.orders.reduce((s, o) => s + o.total, 0);
  const lowStock = db.products.filter((p) => p.stock <= 3);
  return {
    productos: db.products.length,
    categorias: db.categories.length,
    pedidos: db.orders.length,
    clientes: db.customers.length,
    ventas,
    pendientes: db.orders.filter((o) => o.status === 'pendiente').length,
    lowStock,
  };
}
