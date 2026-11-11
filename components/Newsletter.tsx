'use client';
import { useState } from 'react';
import Link from 'next/link';

type Texts = { script: string; title: string; text: string };
const DEF: Texts = { script: 'únete al', title: 'Club EUREKA · 20 % de bienvenida', text: 'Suscríbete y recibe tu descuento, además de acceso anticipado a novedades y rebajas.' };
type Note = { kind: 'info' | 'ok' | 'err'; msg: React.ReactNode };

// Alta en el boletín: se guarda en el servidor y se envía por email el código de bienvenida.
export default function Newsletter({ c = DEF }: { c?: Texts }) {
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>({ kind: 'info', msg: 'Sin spam. Solo moda y ofertas de verdad.' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) { setNote({ kind: 'err', msg: 'Introduce un correo válido.' }); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/boletin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: value, empresa: trap }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setNote({ kind: 'err', msg: j.error || 'No se ha podido completar. Inténtalo de nuevo.' }); return; }
      const code = <b className="nl-code">{j.code}</b>;
      setNote({
        kind: 'ok',
        msg: j.sent
          ? j.already
            ? <>¡Ya estabas en el club! Tu código es {code} (te lo enviamos a <b>{value}</b>).</>
            : <>¡Bienvenida! Te hemos enviado tu código a <b>{value}</b>: {code} · 20 % en tu primera compra.</>
          : <>¡Bienvenida! Tu código: {code} · 20 % en tu primera compra. Aplícalo al pagar.</>,
      });
      setEmail('');
    } catch {
      setNote({ kind: 'err', msg: 'Sin conexión. Inténtalo de nuevo.' });
    } finally { setBusy(false); }
  }

  return (
    <section className="news" id="nl">
      <div className="wrap">
        {c.script && <span className="script">{c.script}</span>}
        <h2>{c.title}</h2>
        {c.text && <p>{c.text}</p>}
        <form onSubmit={submit} noValidate>
          <div className="nlf">
            <input type="email" placeholder="tu@email.com" aria-label="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
            {/* campo trampa para robots: invisible para las personas */}
            <input type="text" name="empresa" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
            <button type="submit" className="btn btn-gold" disabled={busy}>{busy ? 'Enviando…' : 'Suscribirme'}</button>
          </div>
          <div className="nl-note" role="status" aria-live="polite">{note.kind === 'ok' ? <span className="nl-ok">{note.msg}</span> : note.kind === 'err' ? <span className="nl-err">{note.msg}</span> : note.msg}</div>
          <p className="nl-legal">Al suscribirte aceptas recibir emails de EUREKA y nuestra <Link href="/legal/privacidad">política de privacidad</Link>. Puedes darte de baja cuando quieras.</p>
        </form>
      </div>
    </section>
  );
}
