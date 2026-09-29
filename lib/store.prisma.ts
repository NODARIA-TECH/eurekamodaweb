// @ts-nocheck
/*
 * Implementación del MISMO repositorio que lib/store.ts, pero sobre PostgreSQL (Prisma).
 * NO se compila en este proyecto (excluida en tsconfig) hasta que instales Prisma en el VPS.
 *
 * Para activarla:
 *   1) npm i prisma @prisma/client
 *   2) DATABASE_URL=... en .env  (Postgres)
 *   3) npx prisma migrate dev --name init
 *   4) node prisma/seed.mjs        (carga inicial desde data/db.json)
 *   5) sustituye los imports de "@/lib/store" por "@/lib/store.prisma"
 *      (o renombra este archivo a store.ts) y quita la exclusión en tsconfig.
 *
 * Los componentes, páginas, cesta y admin NO cambian: misma interfaz.
 */
import { PrismaClient } from '@prisma/client';
import type { Product, Category, Customer, Order } from './types';

const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;

const toProduct = (r: any): Product => ({
  id: r.id, slug: r.slug, name: r.name, price: r.price, image: r.image,
  stock: r.stock, category: r.categorySlug, badge: r.badge ?? undefined,
});

/* -------- Categorías -------- */
export async function listCategories(): Promise<Category[]> {
  return prisma.category.findMany({ orderBy: { name: 'asc' } });
}
export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await prisma.category.findUnique({ where: { slug } })) ?? undefined;
}
export async function createCategory(data: { name: string; slug: string; image: string }): Promise<Category> {
  return prisma.category.create({ data: { name: data.name, slug: data.slug, image: data.image || '26998033' } });
}
export async function deleteCategory(slug: string): Promise<void> {
  await prisma.category.delete({ where: { slug } });
}

/* -------- Productos -------- */
export async function listProducts(): Promise<Product[]> {
  return (await prisma.product.findMany({ orderBy: { createdAt: 'asc' } })).map(toProduct);
}
export async function getProduct(id: string): Promise<Product | undefined> {
  const r = await prisma.product.findUnique({ where: { id } });
  return r ? toProduct(r) : undefined;
}
export async function productsByCategory(slug: string): Promise<Product[]> {
  return (await prisma.product.findMany({ where: { categorySlug: slug } })).map(toProduct);
}
export async function createProduct(data: any): Promise<Product> {
  const slug = (data.slug || data.name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const r = await prisma.product.create({ data: { slug, name: data.name, price: data.price, image: data.image || '26998033', stock: data.stock ?? 0, badge: data.badge || null, categorySlug: data.category } });
  return toProduct(r);
}
export async function updateProduct(id: string, patch: Partial<Product>): Promise<void> {
  const data: any = {};
  if (patch.price !== undefined) data.price = patch.price;
  if (patch.stock !== undefined) data.stock = patch.stock;
  if (patch.badge !== undefined) data.badge = patch.badge || null;
  if (patch.name !== undefined) data.name = patch.name;
  await prisma.product.update({ where: { id }, data });
}
export async function deleteProduct(id: string): Promise<void> {
  await prisma.product.delete({ where: { id } });
}

/* -------- Pedidos -------- */
export async function listOrders(): Promise<Order[]> {
  return prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } });
}
export async function createOrder(input: { items: { productId: string; qty: number; size?: string }[]; customerName?: string; customerEmail?: string }) {
  if (!input.items.length) return { ok: false, error: 'La cesta está vacía.' };
  return prisma.$transaction(async (tx) => {
    const lines: any[] = [];
    for (const l of input.items) {
      const p = await tx.product.findUnique({ where: { id: l.productId } });
      if (!p) return { ok: false, error: 'Producto no encontrado.' };
      if (p.stock < l.qty) return { ok: false, error: `Sin stock suficiente de ${p.name}.` };
      await tx.product.update({ where: { id: p.id }, data: { stock: { decrement: l.qty } } });
      lines.push({ productId: p.id, name: p.name, price: p.price, qty: l.qty, size: l.size });
    }
    let customerId: string | undefined;
    let customerName = input.customerName;
    if (input.customerEmail) {
      const cust = await tx.customer.upsert({
        where: { email: input.customerEmail },
        update: {},
        create: { name: input.customerName || input.customerEmail, email: input.customerEmail },
      });
      customerId = cust.id; customerName = cust.name;
    }
    const total = lines.reduce((s, i) => s + i.price * i.qty, 0);
    const n = await tx.order.count();
    const order = await tx.order.create({
      data: { ref: 'EUR-' + (1003 + n), customerId, customerName, total, status: 'pendiente', items: { create: lines } },
      include: { items: true },
    });
    return { ok: true, order };
  });
}
export async function updateOrderStatus(id: string, status: Order['status']): Promise<void> {
  await prisma.order.update({ where: { id }, data: { status } });
}

/* -------- Clientes / balance -------- */
export async function listCustomers(): Promise<Customer[]> {
  return prisma.customer.findMany({ include: { movements: true }, orderBy: { name: 'asc' } });
}
export async function getCustomer(id: string): Promise<Customer | undefined> {
  return (await prisma.customer.findUnique({ where: { id }, include: { movements: true } })) ?? undefined;
}
export async function adjustBalance(id: string, amount: number, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.customer.update({ where: { id }, data: { balance: { increment: amount } } }),
    prisma.balanceMovement.create({ data: { customerId: id, amount, reason: reason || 'Ajuste manual' } }),
  ]);
}

/* -------- Métricas -------- */
export async function stats() {
  const [productos, categorias, pedidos, clientes, agg, pendientes, lowStock] = await Promise.all([
    prisma.product.count(), prisma.category.count(), prisma.order.count(), prisma.customer.count(),
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.order.count({ where: { status: 'pendiente' } }),
    prisma.product.findMany({ where: { stock: { lte: 3 } } }),
  ]);
  return { productos, categorias, pedidos, clientes, ventas: agg._sum.total ?? 0, pendientes, lowStock: lowStock.map(toProduct) };
}
