'use client';
import { useState } from 'react';

type Texts = { script: string; title: string; text: string };
const DEF: Texts = { script: 'únete al', title: 'Club EUREKA · 20% de bienvenida', text: 'Suscríbete y recibe tu descuento, además de acceso anticipado a novedades y rebajas.' };

export default function Newsletter({ c = DEF }: { c?: Texts }) {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<{ ok: boolean; msg: string }>({ ok: false, msg: 'Sin spam. Solo moda y ofertas de verdad.' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setNote({ ok: true, msg: '¡Bienvenida! Tu código: BIENVENIDA20 — 20% en tu primera compra. Aplícalo al pagar.' });
      setEmail('');
    } else {
      setNote({ ok: false, msg: 'Introduce un correo válido.' });
    }
  }

  return (
    <section className="news" id="nl">
      <div className="wrap">
        {c.script && <span className="script">{c.script}</span>}
        <h2>{c.title}</h2>
        {c.text && <p>{c.text}</p>}
        <form onSubmit={submit}>
          <div className="nlf">
            <input type="email" placeholder="tu@email.com" aria-label="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <button type="submit" className="btn btn-gold">Suscribirme</button>
          </div>
          <div className="nl-note">{note.ok ? <span className="nl-ok">{note.msg}</span> : note.msg}</div>
        </form>
      </div>
    </section>
  );
}
