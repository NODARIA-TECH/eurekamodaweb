#!/usr/bin/env node
// Diagnóstico del VPS de EUREKA:  npm run diagnostico
// Dice qué falta para compilar y para que las fotos se guarden, y cómo arreglarlo.
import { promises as fs, existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';

const root = process.cwd();
let bad = 0;
const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const warn = (m, fix) => console.log('  \x1b[33m!\x1b[0m ' + m + (fix ? '\n      → ' + fix : ''));
const fail = (m, fix) => { bad++; console.log('  \x1b[31m✗\x1b[0m ' + m + (fix ? '\n      → ' + fix : '')); };
const sh = (c) => { try { return execSync(c, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const gb = (n) => (n / 1024 ** 3).toFixed(1) + ' GB';

console.log('\nEUREKA · diagnóstico en ' + root + '\n');

console.log('Código');
const head = sh('git log -1 --format="%h %cd" --date=format:"%d/%m/%Y %H:%M"');
head ? ok('Versión descargada: ' + head) : warn('No es una copia de git');
const dirty = (() => { try { return execSync('git status --porcelain --untracked-files=no', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').filter(Boolean); } catch { return []; } })();
if (dirty.length) warn(`${dirty.length} archivo(s) cambiados a mano en el servidor: ${dirty.slice(0, 4).map((l) => l.slice(3)).join(', ')}`, 'si git pull se queja: git checkout -- <archivo> (o git stash) y repite git pull');
const nodeMajor = Number(process.versions.node.split('.')[0]);
nodeMajor >= 18 ? ok('Node ' + process.version) : fail('Node ' + process.version + ' es muy antiguo', 'instala Node 20 LTS');

console.log('\nDependencias');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const missing = Object.keys(deps).filter((d) => !existsSync(path.join(root, 'node_modules', d, 'package.json')));
const omitDev = process.env.NODE_ENV === 'production' || /dev/.test(sh('npm config get omit'));
if (!missing.length) ok(`Las ${Object.keys(deps).length} librerías están instaladas`);
else fail('Faltan por instalar: ' + missing.join(', '), omitDev ? 'npm install --include=dev   (el servidor tiene NODE_ENV=production u omit=dev y se salta las de desarrollo)' : 'npm install');
if (omitDev) warn('NODE_ENV=production / omit=dev: instala siempre con  npm install --include=dev  antes de compilar');

console.log('\nCompilación');
const buildId = path.join(root, '.next', 'BUILD_ID');
if (!existsSync(buildId)) fail('No hay compilación (.next)', 'npm run build');
else {
  const built = (await fs.stat(buildId)).mtimeMs;
  const commit = Number(sh('git log -1 --format=%ct')) * 1000;
  if (commit && built < commit) fail(`La compilación (${new Date(built).toLocaleString('es-ES')}) es anterior al último código descargado`, 'npm run build  y luego  pm2 restart <nombre>');
  else ok('Compilada el ' + new Date(built).toLocaleString('es-ES'));
}

console.log('\nFotos');
const up = path.join(root, 'data', 'uploads');
try {
  await fs.mkdir(up, { recursive: true });
  const probe = path.join(up, '.prueba');
  await fs.writeFile(probe, 'ok'); await fs.rm(probe);
  const st = await fs.stat(up);
  ok(`data/uploads se puede escribir (propietario uid ${st.uid}; este usuario uid ${process.getuid?.()})`);
  if (process.getuid && st.uid !== process.getuid()) warn('La carpeta es de otro usuario: comprueba que pm2 corre con el mismo usuario', `sudo chown -R ${os.userInfo().username} ${path.join(root, 'data')}`);
} catch (e) {
  fail('No se puede escribir en data/uploads: ' + (e.code || e.message), `sudo chown -R ${os.userInfo().username} ${path.join(root, 'data')}`);
}
try {
  const sharp = (await import(path.join(root, 'node_modules', 'sharp', 'lib', 'index.js'))).default;
  await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).webp().toBuffer();
  ok('sharp funciona (' + (sharp.versions?.sharp || '') + ')');
} catch (e) { fail('sharp no funciona: ' + e.message, 'npm install  (y si sigue: npm rebuild sharp)'); }
existsSync(path.join(root, 'node_modules', 'heic-convert')) ? ok('Conversor HEIC instalado') : fail('Falta el conversor HEIC', 'npm install');

console.log('\nSeguridad y configuración (.env)');
const envv = {};
for (const f of ['.env', '.env.local', '.env.production', '.env.production.local']) {
  try { for (const l of readFileSync(path.join(root, f), 'utf8').split('\n')) { const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m) envv[m[1]] = m[2].replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '').trim(); } } catch { /* no existe */ }
}
const E = (k) => process.env[k] || envv[k] || '';
const PH = /cambia|cambiame|change|^eureka$|example|xxxx/i;
(!E('EUREKA_ADMIN_PASSWORD') || E('EUREKA_ADMIN_PASSWORD') === 'eureka' || E('EUREKA_ADMIN_PASSWORD').length < 10) ? fail('Contraseña del panel vacía, "eureka" o corta', 'EUREKA_ADMIN_PASSWORD con 10+ caracteres en .env') : ok('Contraseña del panel configurada');
(!E('EUREKA_AUTH_SECRET') || E('EUREKA_AUTH_SECRET').length < 24 || PH.test(E('EUREKA_AUTH_SECRET'))) ? fail('Falta EUREKA_AUTH_SECRET propio', 'EUREKA_AUTH_SECRET=$(openssl rand -hex 32) en .env') : ok('Secreto de sesiones configurado');
if (E('EUREKA_SYNC_SECRET') && (E('EUREKA_SYNC_SECRET').length < 24 || PH.test(E('EUREKA_SYNC_SECRET')))) fail('EUREKA_SYNC_SECRET es el de ejemplo', 'openssl rand -hex 32 (el mismo en n8n)');
E('EUREKA_BASE_URL') ? ok('EUREKA_BASE_URL=' + E('EUREKA_BASE_URL')) : warn('Falta EUREKA_BASE_URL', 'EUREKA_BASE_URL=https://eurekamoda.com');
if (E('STRIPE_SECRET_KEY')) E('STRIPE_WEBHOOK_SECRET') ? ok('Stripe y su webhook configurados') : warn('Falta STRIPE_WEBHOOK_SECRET', 'Stripe → Developers → Webhooks → https://eurekamoda.com/api/stripe/webhook');
(E('MAIL_RELAY_URL') && !/<|TU-SUB/i.test(E('MAIL_RELAY_URL')) && E('MAIL_RELAY_TOKEN')) ? ok('Correo: relé de Cloudflare configurado') : warn('Correo sin configurar (MAIL_RELAY_URL / MAIL_RELAY_TOKEN)');

console.log('\nServidor');
try {
  const s = await fs.statfs(root);
  const free = s.bavail * s.bsize;
  free > 2 * 1024 ** 3 ? ok('Disco: ' + gb(free) + ' libres') : free > 300 * 1024 ** 2 ? warn('Disco: solo ' + gb(free) + ' libres', 'pm2 flush, borrar copias antiguas') : fail('Disco casi lleno: ' + gb(free), 'pm2 flush, borrar copias antiguas');
} catch { /* */ }
let swap = 0;
try { swap = Number(/SwapTotal:\s+(\d+)/.exec(readFileSync('/proc/meminfo', 'utf8'))?.[1] || 0) * 1024; } catch { /* */ }
const mem = os.totalmem();
const memMsg = `Memoria: ${gb(os.freemem())} libres de ${gb(mem)} · swap ${gb(swap)}`;
mem < 2.5 * 1024 ** 3 && swap < 1024 ** 3 ? warn(memMsg, 'con poca memoria y sin swap, convertir HEIC puede tumbar la web. Añade 2 GB de swap:\n        sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab') : ok(memMsg);
const ngx = sh('grep -rhs "client_max_body_size" /etc/nginx');
ngx ? ok('Nginx: ' + ngx.split('\n').map((l) => l.trim()).join(' | ') + ' (la web sube por trozos de 768 KB: no le afecta)') : ok('Nginx sin client_max_body_size (1 MB por defecto): la web sube por trozos de 768 KB, no le afecta');
const pm2 = sh('pm2 jlist');
if (pm2) {
  try {
    for (const p of JSON.parse(pm2)) {
      const cwd = p.pm2_env?.pm_cwd || '';
      if (cwd && path.resolve(cwd) === path.resolve(root)) {
        p.pm2_env?.status === 'online' ? ok(`pm2: "${p.name}" en marcha (reinicios: ${p.pm2_env.restart_time})`) : fail(`pm2: "${p.name}" está ${p.pm2_env?.status}`, `pm2 restart ${p.name}  y  pm2 logs ${p.name} --lines 50`);
        if (p.pm2_env?.restart_time > 20) warn('Muchos reinicios: puede que se quede sin memoria', `pm2 logs ${p.name} --lines 80`);
      }
    }
  } catch { /* */ }
}

console.log(bad ? `\n\x1b[31m${bad} cosa(s) por arreglar.\x1b[0m Arregla lo marcado con ✗ y vuelve a ejecutar  npm run diagnostico\n` : '\n\x1b[32mTodo en orden.\x1b[0m\n');
process.exitCode = bad ? 1 : 0;
