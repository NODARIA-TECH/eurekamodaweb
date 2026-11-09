// Diagnóstico del servidor: versión desplegada, fotos (carpeta, permisos, conversores), disco,
// memoria y email. Sirve para saber al momento por qué algo no se guarda.
import { promises as fs, constants as FS } from 'fs';
import os from 'os';
import path from 'path';
import { requireAdmin } from '@/lib/admin-auth';
import { UPLOAD_DIR, recentUploadErrors } from '@/lib/uploads';
import { checkMail, providerName, mailProvider } from '@/lib/mailer';
import PhotoTest from './PhotoTest';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Diagnóstico · EUREKA' };

type Check = { name: string; ok: boolean | 'warn'; detail: string; fix?: string };
const mb = (n: number) => (n / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' MB';
const gb = (n: number) => (n / 1024 / 1024 / 1024).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + ' GB';

async function checks(): Promise<Check[]> {
  const out: Check[] = [];

  // Versión
  const build = process.env.EUREKA_BUILD || 'desconocida';
  const builtAt = process.env.EUREKA_BUILT_AT ? new Date(process.env.EUREKA_BUILT_AT).toLocaleString('es-ES') : '—';
  out.push({ name: 'Versión en marcha', ok: true, detail: `${build.replace('·', ' · ').replace('_', ' ')} (compilada el ${builtAt})`, fix: 'Si no coincide con la última de GitHub, el despliegue no terminó: repite git pull, npm install, npm run build y pm2 restart.' });
  out.push({ name: 'Node.js', ok: Number(process.versions.node.split('.')[0]) >= 18 ? true : false, detail: process.version, fix: 'Hace falta Node 18 o superior.' });

  // Carpeta de fotos
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const probe = path.join(UPLOAD_DIR, `.prueba-${process.pid}`);
    await fs.writeFile(probe, 'ok');
    await fs.rm(probe, { force: true });
    const files = (await fs.readdir(UPLOAD_DIR)).filter((f) => /\.(webp|jpe?g|png|avif|gif)$/i.test(f));
    let size = 0;
    for (const f of files.slice(0, 5000)) { try { size += (await fs.stat(path.join(UPLOAD_DIR, f))).size; } catch { /* */ } }
    out.push({ name: 'Carpeta de fotos (data/uploads)', ok: true, detail: `Se puede escribir · ${files.length} fotos subidas · ${mb(size)} · ${UPLOAD_DIR}` });
  } catch (e: any) {
    let owner = '';
    try { const st = await fs.stat(UPLOAD_DIR); owner = ` (la carpeta es del usuario ${st.uid}, la web corre como ${process.getuid?.()})`; } catch { /* */ }
    out.push({ name: 'Carpeta de fotos (data/uploads)', ok: false, detail: `No se puede guardar: ${e?.code || e?.message}${owner}`, fix: `En el VPS: sudo chown -R $(whoami) ${path.dirname(UPLOAD_DIR)} (con el usuario que arranca pm2).` });
  }

  // Conversores
  try {
    const sharp = (await import('sharp')).default;
    const v = (sharp as any).versions || {};
    const meta = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#c2a053' } }).webp().toBuffer();
    out.push({ name: 'Optimizador de fotos (sharp)', ok: meta.length > 0, detail: `sharp ${v.sharp || ''} · libvips ${v.vips || ''} · JPG, PNG y WebP OK` });
  } catch (e: any) {
    out.push({ name: 'Optimizador de fotos (sharp)', ok: false, detail: 'No carga: ' + (e?.message || e), fix: 'En el VPS: npm install (y si sigue: npm rebuild sharp).' });
  }
  try {
    const t0 = Date.now();
    const mod: any = await import('heic-convert');
    out.push({ name: 'Conversor HEIC/HEIF (InShot, iPhone)', ok: typeof (mod.default || mod) === 'function', detail: `Cargado en ${Date.now() - t0} ms` });
  } catch (e: any) {
    out.push({ name: 'Conversor HEIC/HEIF (InShot, iPhone)', ok: false, detail: 'No está instalado: ' + (e?.message || e), fix: 'En el VPS: npm install y luego npm run build y pm2 restart.' });
  }

  // Disco y memoria
  try {
    const st = await (fs as any).statfs(UPLOAD_DIR);
    const free = st.bavail * st.bsize, total = st.blocks * st.bsize;
    out.push({ name: 'Disco', ok: free > 2 * 1024 ** 3 ? true : free > 300 * 1024 ** 2 ? 'warn' : false, detail: `${gb(free)} libres de ${gb(total)}`, fix: 'Libera espacio (copias antiguas, logs de pm2: pm2 flush).' });
  } catch { /* statfs no disponible */ }
  const free = os.freemem(), total = os.totalmem();
  out.push({ name: 'Memoria', ok: free > 350 * 1024 ** 2 ? true : 'warn', detail: `${mb(free)} libres de ${mb(total)} · esta web usa ${mb(process.memoryUsage().rss)}`, fix: 'Convertir una foto HEIC necesita ~300 MB. Si va justo, añade swap al VPS (ver instrucciones).' });

  // Email
  let mailer = true;
  try { await import('nodemailer'); } catch { mailer = false; }
  const mail = mailer ? await checkMail() : { ok: false, detail: 'Falta instalar nodemailer (npm install)' };
  out.push({
    name: 'Email del boletín', ok: mail.ok ? true : mailProvider() ? false : 'warn',
    detail: mail.detail === 'Sin configurar' ? 'Sin configurar (las suscripciones se guardan, pero no sale el email)' : (mailProvider() ? providerName() + ' · ' : '') + mail.detail,
    fix: 'Configúralo con Resend: ver Panel → Boletín.',
  });

  // Límite de subida (Nginx): la web sube por trozos de 768 KB, así que no le afecta
  out.push({ name: 'Límite de tamaño de Nginx', ok: true, detail: 'Las fotos y ZIP se suben por trozos de 768 KB: funcionan aunque Nginx tenga el límite por defecto (1 MB).' });
  return out;
}

export default async function Diagnostico() {
  requireAdmin();
  const list = await checks();
  const bad = list.filter((c) => c.ok === false).length;
  return (
    <>
      <div className="adm-h">
        <div><h1>Diagnóstico</h1><p>{bad ? `${bad} cosa(s) por arreglar` : 'Todo en orden'} · comprobado ahora mismo en el servidor</p></div>
      </div>

      <div className="adm-card">
        <h2>Servidor</h2>
        <ul className="dg-list">
          {list.map((c) => (
            <li key={c.name} className={c.ok === true ? 'ok' : c.ok === 'warn' ? 'warn' : 'bad'}>
              <span className="dg-dot" />
              <div><b>{c.name}</b><span>{c.detail}</span>{c.ok !== true && c.fix && <em>{c.fix}</em>}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="adm-card">
        <h2>Probar una subida</h2>
        <p className="adm-help">Sube aquí una foto (por ejemplo, una HEIC de InShot) y verás si llega, cuánto tarda y cómo queda. No se añade a ningún producto.</p>
        <PhotoTest />
      </div>

      <div className="adm-card">
        <h2>Últimos fallos al subir fotos</h2>
        {recentUploadErrors.length ? (
          <ul className="dg-err">{recentUploadErrors.map((e, i) => <li key={i}><b>{new Date(e.at).toLocaleString('es-ES')}</b> {e.error}</li>)}</ul>
        ) : <p className="adm-help">Ninguno desde que se arrancó la web.</p>}
      </div>
    </>
  );
}
