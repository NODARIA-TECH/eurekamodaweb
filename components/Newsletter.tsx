'use client';
import { useState } from 'react';

export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<{ ok: boolean; msg: string }>({ ok: false, msg: 'Sin spam. Solo moda y ofertas de verdad.' });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setNote({ ok: true, msg: '¡Listo! Tu código de bienvenida está en tu correo.' });
      setEmail('');
    } else {
      setNote({ ok: false, msg: 'Introduce un correo válido.' });
    }
  }

  return (
    <section className="news" id="nl">
      <div className="wrap">
        <span className="script">únete al</span>
        <h2>Club EUREKA · 10% de bienvenida</h2>
        <p>Suscríbete y recibe tu descuento, además de acceso anticipado a novedades y rebajas.</p>
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
