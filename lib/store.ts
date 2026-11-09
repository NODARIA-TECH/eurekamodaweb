// Capa de acceso a datos (repositorio) sobre un archivo JSON.
// DEMO/FOUNDATION: sustituible 1:1 por Prisma/PostgreSQL o @nodaria/core sin tocar los componentes.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DB, Product, Category, Customer, Order, OrderItem } from './types';
import { hasVariants, findVariant, buildVariants, totalStock, vkey, vlabel } from './variants';
import { parseVariantStock } from './catalog-normalize';
import { withCatalogPhotos } from './catalog-photos';
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
  const raw = await fs.readFile(FILE, 'utf8');
  return JSON.parse(raw) as DB;
}
// Escritura atómica: se escribe un temporal y se renombra (un corte a mitad nunca deja live.json roto).
async function write(db: DB): Promise<void> {
  const tmp = `${FILE}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, FILE);
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

/* -------- Sincronización con FacturaScripts -------- */
// Alta/actualización de producto por SKU (referencia). FS->web para artículos creados en FacturaScripts.
export async function upsertProductBySku(data: { sku: string; name: string; price: number; stock?: number; category?: string; image?: string; badge?: string; sizes?: string[]; colors?: string[]; description?: string; details?: string; keepStock?: boolean; variantStockText?: string }): Promise<{ created: boolean; product: Product }> {
  const db = await read();
  const sku = data.sku.trim();
  let p = db.products.find((x) => x.sku && x.sku.toLowerCase() === sku.toLowerCase());
  if (p) {
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
    refreshVariants(p, data.variantStockText);
    p.updatedAt = new Date().toISOString();
    await write(db);
    return { created: false, product: p };
  }
  const slug = (data.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || sku.toLowerCase();
  p = { id: randomUUID().slice(0, 8), slug, name: data.name, price: data.price, image: data.image || '26998033', stock: data.stock ?? 0, category: data.category || 'tops', badge: data.badge, sku, sizes: data.sizes, colors: data.colors, description: data.description, details: data.details, updatedAt: new Date().toISOString() };
  refreshVariants(p, data.variantStockText);
  db.products.push(p);
  await write(db);
  return { created: true, product: p };
}

// Alta/actualización por NOMBRE (para importaciones de Excel SIN referencia).
// Empareja por nombre normalizado (ignora mayúsculas/acentos/espacios) para no duplicar.
// Si el existente no tiene SKU aún, NO lo inventa aquí (se respeta el que ya tenga).
export async function upsertProductByName(data: { name: string; price: number; stock?: number; category?: string; image?: string; badge?: string; sizes?: string[]; colors?: string[]; description?: string; details?: string; keepStock?: boolean; previousName?: string; variantStockText?: string }): Promise<{ created: boolean; product: Product }> {
  const db = await read();
  const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
  const target = norm(data.name);
  // Busca por el nombre actual; si no está y viene "nombre anterior", por ese (y lo renombra).
  const prev = data.previousName ? norm(data.previousName) : '';
  const p = db.products.find((x) => norm(x.name) === target) || (prev ? db.products.find((x) => norm(x.name) === prev) : undefined);
  if (p) {
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
    refreshVariants(p, data.variantStockText);
    p.updatedAt = new Date().toISOString();
    await write(db);
    return { created: false, product: p };
  } // sin cambios; el alta la hace createProduct (genera SKU y slug)
  const created = await createProduct({ name: data.name, price: data.price, stock: data.stock ?? 0, category: data.category || 'tops', image: data.image || '26998033', badge: data.badge, sizes: data.sizes, colors: data.colors, description: data.description, details: data.details }, { variantStockText: data.variantStockText });
  return { created: true, product: created };
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
