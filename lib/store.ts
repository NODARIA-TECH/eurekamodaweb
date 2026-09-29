// Capa de acceso a datos (repositorio) sobre un archivo JSON.
// DEMO/FOUNDATION: sustituible 1:1 por Prisma/PostgreSQL o @nodaria/core sin tocar los componentes.
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { DB, Product, Category, Customer, Order, OrderItem } from './types';

const FILE = path.join(process.cwd(), 'data', 'db.json');

async function read(): Promise<DB> {
  const raw = await fs.readFile(FILE, 'utf8');
  return JSON.parse(raw) as DB;
}
async function write(db: DB): Promise<void> {
  await fs.writeFile(FILE, JSON.stringify(db, null, 2) + '\n', 'utf8');
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
export async function listProducts(): Promise<Product[]> {
  return (await read()).products;
}
export async function getProduct(id: string): Promise<Product | undefined> {
  return (await read()).products.find((p) => p.id === id);
}
export async function productsByCategory(slug: string): Promise<Product[]> {
  return (await read()).products.filter((p) => p.category === slug);
}
export async function createProduct(data: Omit<Product, 'id' | 'slug'> & { slug?: string }): Promise<Product> {
  const db = await read();
  const slug = (data.slug || data.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const prod: Product = { id: randomUUID().slice(0, 8), slug, name: data.name, price: data.price, image: data.image || '26998033', stock: data.stock ?? 0, category: data.category, badge: data.badge };
  db.products.push(prod);
  await write(db);
  return prod;
}
export async function updateProduct(id: string, patch: Partial<Product>): Promise<void> {
  const db = await read();
  const p = db.products.find((x) => x.id === id);
  if (p) Object.assign(p, patch);
  await write(db);
}
export async function deleteProduct(id: string): Promise<void> {
  const db = await read();
  db.products = db.products.filter((p) => p.id !== id);
  await write(db);
}

/* -------- Pedidos -------- */
export async function listOrders(): Promise<Order[]> {
  return (await read()).orders.slice().reverse();
}
export async function createOrder(input: { items: { productId: string; qty: number; size?: string }[]; customerName?: string; customerEmail?: string }): Promise<{ ok: boolean; order?: Order; error?: string }> {
  const db = await read();
  if (!input.items.length) return { ok: false, error: 'La cesta está vacía.' };
  const items: OrderItem[] = [];
  // validar stock
  for (const line of input.items) {
    const p = db.products.find((x) => x.id === line.productId);
    if (!p) return { ok: false, error: 'Producto no encontrado.' };
    if (p.stock < line.qty) return { ok: false, error: `Sin stock suficiente de ${p.name}.` };
  }
  // descontar stock + construir líneas
  for (const line of input.items) {
    const p = db.products.find((x) => x.id === line.productId)!;
    p.stock -= line.qty;
    items.push({ productId: p.id, name: p.name, price: p.price, qty: line.qty, size: line.size });
  }
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  db.lastOrderNumber += 1;
  const order: Order = {
    id: randomUUID().slice(0, 8),
    ref: 'EUR-' + db.lastOrderNumber,
    customerName: input.customerName,
    items,
    total,
    status: 'pendiente',
    createdAt: new Date().toISOString(),
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
export async function updateOrderStatus(id: string, status: Order['status']): Promise<void> {
  const db = await read();
  const o = db.orders.find((x) => x.id === id);
  if (o) o.status = status;
  await write(db);
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

// Consulta de cuenta por email (demo; el login real llega después)
export async function getAccount(email: string): Promise<{ customer: Customer; orders: Order[] } | undefined> {
  const db = await read();
  const c = db.customers.find((x) => x.email.toLowerCase() === email.toLowerCase().trim());
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
