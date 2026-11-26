// Por qué cambia el stock de un producto:  node scripts/revisar-stock.mjs PEK-0999   (o parte del nombre)
// Solo LEE data/live.json y data/stock-log.jsonl. Pega la salida a Nodaria.
import { readFileSync } from 'fs';
const q = (process.argv[2] || '').toLowerCase();
if (!q) { console.log('Uso: node scripts/revisar-stock.mjs <referencia o nombre>'); process.exit(1); }
const db = JSON.parse(readFileSync('data/live.json', 'utf8'));
const ps = db.products.filter((p) => (p.sku || '').toLowerCase() === q || p.name.toLowerCase().includes(q));
if (!ps.length) { console.log('No encuentro ningún producto con', q); process.exit(1); }
let log = [];
try { log = readFileSync('data/stock-log.jsonl', 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { console.log('(todavía no hay data/stock-log.jsonl: se crea con la versión nueva)'); }
for (const p of ps) {
  console.log(`\n${p.sku} · ${p.name} · stock ${p.stock} · último de FacturaScripts ${p.stockFs ?? '—'} · precio ${(p.price / 100).toFixed(2)} €${p.hidden ? ' · OCULTO' : ''}`);
  console.log('  tallas:', JSON.stringify(p.sizes || []), 'colores:', JSON.stringify(p.colors || []));
  console.log('  variantes:', p.variants?.length ? p.variants.map((v) => `${v.size || ''}/${v.color || ''}=${v.stock}${v.stockFs != null ? ` (FS ${v.stockFs})` : ''}`).join(', ') : 'ninguna');
  const h = log.filter((l) => l.id === p.id).slice(-25);
  console.log(h.length ? '  cambios de stock:' : '  cambios de stock: ninguno apuntado');
  for (const l of h) console.log(`   ${l.at.replace('T', ' ').slice(0, 19)}  ${l.de} → ${l.a}  ${l.origen}${l.detalle ? '  [' + l.detalle + ']' : ''}`);
}
