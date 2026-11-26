// ¿Por qué FacturaScripts no deja entrar a la web?  node scripts/revisar-fs.mjs   [--desbloquear]
// NO llama a la API de FacturaScripts (cada llamada fallida cuenta para su bloqueo de 10 minutos):
// mira el .env de la web, el config.php de FacturaScripts, su base de datos y su lista de bloqueos.
// No enseña ninguna clave. Pega la salida a Nodaria.
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';

const FS_DIR = process.env.FS_DIR || '/var/www/factura';
const ok = (t) => console.log('  ✓ ' + t), mal = (t) => console.log('  ✗ ' + t), info = (t) => console.log('  · ' + t);

// 1) La clave de la web
console.log('\n1) Clave de la web (.env)');
let token = '';
try {
  const env = readFileSync('.env', 'utf8');
  const m = env.match(/^\s*FS_API_TOKEN\s*=(.*)$/m);
  const raw = m ? m[1] : '';
  token = raw.replace(/\s+#.*$/, '').trim();
  if (!m) mal('no hay línea FS_API_TOKEN en el .env');
  else if (!token) mal('FS_API_TOKEN está vacío');
  else {
    if (/^["']|["']$/.test(token)) token = token.replace(/^["']|["']$/g, '');
    if (/\s/.test(token)) mal('FS_API_TOKEN tiene espacios dentro');
    ok(`FS_API_TOKEN puesto (${token.length} caracteres)`);
  }
  const url = (env.match(/^\s*FS_API_URL\s*=(.*)$/m) || [])[1];
  info('FS_API_URL: ' + (url ? url.trim() : 'por defecto http://127.0.0.1/api/3'));
} catch { mal('no encuentro el .env (ejecútalo dentro de /var/www/eureka-web)'); }

// 2) config.php de FacturaScripts
console.log('\n2) FacturaScripts (' + FS_DIR + '/config.php)');
const cfg = {};
try {
  const php = readFileSync(FS_DIR + '/config.php', 'utf8');
  for (const m of php.matchAll(/define\(\s*['"](FS_[A-Z_]+)['"]\s*,\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([^)\s]+))\s*\)/g)) cfg[m[1]] = m[2] ?? m[3] ?? m[4];
  info(`base de datos: ${cfg.FS_DB_TYPE || 'mysql'} · ${cfg.FS_DB_NAME || '?'}`);
  if (cfg.FS_API_KEY) info(token && cfg.FS_API_KEY === token ? 'tu FS_API_TOKEN es la clave maestra de config.php (acceso completo)' : 'hay clave maestra FS_API_KEY en config.php (no es la del .env)');
  const lim = Number(cfg.FS_API_RATE_LIMIT || 0);
  if (lim > 0) mal(`límite de ${lim} peticiones por minuto (FS_API_RATE_LIMIT): la web y n8n juntos pueden pasarlo → 429. Súbelo o quítalo`);
  else ok('sin límite de peticiones por minuto');
} catch { mal('no puedo leer ' + FS_DIR + '/config.php (¿otra carpeta? FS_DIR=/ruta node scripts/revisar-fs.mjs)'); }

// 3) La clave en la base de datos y sus permisos
console.log('\n3) La clave en FacturaScripts');
const RECURSOS = { productos: 'GET POST PUT', variantes: 'GET PUT', stocks: 'GET POST PUT', almacenes: 'GET' };
if (token && cfg.FS_DB_NAME && cfg.FS_API_KEY !== token && (cfg.FS_DB_TYPE || 'mysql').startsWith('mysql')) {
  const sql = `SELECT CONCAT('K\t',id,'\t',enabled,'\t',fullaccess,'\t',IFNULL(description,'')) FROM api_keys WHERE apikey='${token.replace(/'/g, "''")}';
SELECT CONCAT('A\t',a.resource,'\t',a.allowget,'\t',a.allowpost,'\t',a.allowput) FROM api_access a JOIN api_keys k ON k.id=a.idapikey WHERE k.apikey='${token.replace(/'/g, "''")}';
SELECT CONCAT('S\t',IFNULL((SELECT value FROM settings WHERE name='default' LIMIT 1),''));`;
  const args = ['-N', '-B', '-h', cfg.FS_DB_HOST || 'localhost', '-P', String(cfg.FS_DB_PORT || 3306), '-u', cfg.FS_DB_USER || 'root', cfg.FS_DB_NAME];
  const r = spawnSync('mysql', args, { input: sql, encoding: 'utf8', env: { ...process.env, MYSQL_PWD: cfg.FS_DB_PASS || '' } });
  if (r.error || r.status !== 0) mal(r.error ? 'no está el programa mysql en el servidor; mira la clave a mano en FacturaScripts → Admin → API' : 'no he podido consultar la base de datos: ' + String(r.stderr).split('\n')[0]);
  else {
    const lines = r.stdout.trim().split('\n').map((l) => l.split('\t'));
    const k = lines.find((l) => l[0] === 'K');
    if (!k) mal('esa clave NO existe en FacturaScripts (Admin → API → claves): copia la buena en FS_API_TOKEN');
    else {
      ok(`la clave existe (nº ${k[1]}${k[4] ? ', «' + k[4] + '»' : ''})`);
      if (k[2] !== '1') mal('pero está DESACTIVADA: actívala en FacturaScripts');
      if (k[3] === '1') ok('tiene acceso completo');
      else {
        const acc = Object.fromEntries(lines.filter((l) => l[0] === 'A').map((l) => [l[1], { GET: l[2] === '1', POST: l[3] === '1', PUT: l[4] === '1' }]));
        let falta = false;
        for (const [res, mets] of Object.entries(RECURSOS)) {
          const no = mets.split(' ').filter((m) => !acc[res]?.[m]);
          if (no.length) { falta = true; mal(`sin permiso en «${res}» para ${no.join(', ')}`); } else ok(`«${res}» bien`);
        }
        if (falta) info('lo más fácil: en FacturaScripts → Admin → API, marca «Acceso completo» en esta clave');
      }
    }
    const s = lines.find((l) => l[0] === 'S');
    if (s && !cfg.FS_API_KEY && !/"enable_api";(s:1:"1"|b:1|i:1)|"enable_api":"?(1|true)/.test(s[1] || '')) info('ojo: puede que la API esté desactivada en FacturaScripts → Admin → Panel de control');
  }
} else if (token && cfg.FS_API_KEY !== token) info('no compruebo la base de datos (faltan datos o no es MySQL)');

// 4) ¿Está bloqueado ahora?
console.log('\n4) Bloqueo de FacturaScripts (5 fallos en 10 min = 10 min bloqueado)');
const cache = FS_DIR + '/MyFiles/Tmp/FileCache/api-ip-list.cache';
if (!existsSync(cache)) ok('no hay bloqueos apuntados');
else {
  const txt = readFileSync(cache, 'utf8');
  const now = Math.floor(Date.now() / 1000);
  const porIp = {};
  for (const m of txt.matchAll(/s:2:"ip";s:\d+:"([^"]+)";s:4:"time";i:(\d+)/g)) if (now - +m[2] < 600) (porIp[m[1]] ||= []).push(+m[2]);
  if (!Object.keys(porIp).length) ok('no hay fallos recientes');
  for (const [ip, ts] of Object.entries(porIp)) {
    const hasta = new Date((Math.max(...ts) + 600) * 1000).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' });
    (ts.length >= 5 ? mal : info)(`${ip}: ${ts.length} fallos en los últimos 10 min${ts.length >= 5 ? ` → BLOQUEADA hasta las ${hasta} (también para n8n)` : ''}`);
  }
  if (process.argv.includes('--desbloquear')) { unlinkSync(cache); ok('lista de bloqueos borrada: ya se puede volver a entrar'); }
  else if (Object.values(porIp).some((t) => t.length >= 5)) info('para desbloquear ya (después de arreglar la clave): node scripts/revisar-fs.mjs --desbloquear');
}
console.log('');
