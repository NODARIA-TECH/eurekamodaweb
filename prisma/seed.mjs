// Carga inicial en PostgreSQL desde data/db.json (mismos datos de la maqueta).
// Uso: node prisma/seed.mjs   (tras `npx prisma migrate dev`)
import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const raw = await readFile(path.join(process.cwd(), 'data', 'db.json'), 'utf8');
  const db = JSON.parse(raw);

  for (const c of db.categories) {
    await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: { slug: c.slug, name: c.name, image: c.image } });
  }
  for (const p of db.products) {
    await prisma.product.upsert({
      where: { id: p.id }, update: {},
      create: { id: p.id, slug: p.slug, name: p.name, price: p.price, image: p.image, stock: p.stock, badge: p.badge ?? null, categorySlug: p.category },
    });
  }
  for (const c of db.customers) {
    await prisma.customer.upsert({
      where: { id: c.id }, update: {},
      create: {
        id: c.id, name: c.name, email: c.email, balance: c.balance, passwordHash: c.passwordHash ?? null, createdAt: new Date(c.createdAt),
        movements: { create: (c.movements ?? []).map((m) => ({ id: m.id, amount: m.amount, reason: m.reason, createdAt: new Date(m.createdAt) })) },
      },
    });
  }
  for (const o of db.orders) {
    await prisma.order.upsert({
      where: { id: o.id }, update: {},
      create: {
        id: o.id, ref: o.ref, customerId: o.customerId ?? null, customerName: o.customerName ?? null,
        total: o.total, status: o.status, createdAt: new Date(o.createdAt),
        items: { create: o.items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, qty: i.qty, size: i.size ?? null })) },
      },
    });
  }
  console.log('Seed completado.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
