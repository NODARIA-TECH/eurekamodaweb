// Resumen de los productos para revisar problemas sin tocar nada:  node scripts/revisar-productos.mjs
// Solo LEE data/live.json. Pega la salida a Nodaria.
import { readFileSync, readdirSync } from 'fs';
const db = JSON.parse(readFileSync('data/live.json', 'utf8'));
const real = (u) => typeof u === 'string' && /^(\/media\/|\/uploads\/|\/img\/|https?:)/.test(u);
const eur = (c) => (c ? (c / 100).toFixed(2) + '€' : 'SIN PRECIO');
console.log(`versión catálogo ${db.catalogVersion ?? '-'} · arreglos ${db.fixesVersion ?? '-'} · ${db.products.length} productos · ${db.orders.length} pedidos`);
try { const inf = readdirSync('data/copias').filter((f) => f.startsWith('informe-')).sort().slice(-3); console.log('informes:', inf.join(', ') || '—'); } catch { console.log('informes: —'); }
const byCat = {};
for (const p of db.products) (byCat[p.category] ||= []).push(p);
for (const [cat, list] of Object.entries(byCat).sort()) {
  console.log(`\n[${cat}] ${list.length}`);
  for (const p of list) {
    const st = p.variants?.length ? p.variants.map((v) => `${v.size || ''}${v.size && v.color ? '/' : ''}${v.color || ''}:${v.stock}`).join(' ') : `stock ${p.stock ?? 0}`;
    console.log(`  ${p.sku || p.id} · ${p.name} · ${eur(p.price)} · ${st}${p.hidden ? ' · OCULTO' : ''}${real(p.image) ? '' : ' · SIN FOTO PROPIA'} · ${p.image}`);
  }
}
