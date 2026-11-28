'use client';
import { useEffect, useState } from 'react';
import Newsletter from './Newsletter';

type Texts = { script: string; title: string; text: string };

// Franja del Club EUREKA arriba del todo (en todas las páginas): abre el alta al boletín en una ventana.
// Desaparece si la clienta ya se ha suscrito o la cierra (se recuerda en su navegador).
export default function ClubBar({ c }: { c: Texts }) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    let ok = true;
    try { ok = !localStorage.getItem('eureka_club') && !sessionStorage.getItem('eureka_club_x'); } catch {}
    setVisible(ok);
    const abrir = () => { setOpen(true); setVisible(true); };
    window.addEventListener('eureka:club', abrir);
    return () => window.removeEventListener('eureka:club', abrir);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const cerrarFranja = () => { try { sessionStorage.setItem('eureka_club_x', '1'); } catch {} setVisible(false); };

  return (
    <>
      {visible && !hecho && (
        <div className="clubbar">
          <div className="wrap">
            <button type="button" className="clubbar-go" onClick={() => setOpen(true)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7Zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7Z" /></svg>
              <span className="cb-larga"><b>Club EUREKA</b> · <b className="pct">20 % de descuento</b> en tu primera compra</span>
              <span className="cb-corta"><b className="pct">−20 %</b> en tu 1.ª compra</span>
              <span className="clubbar-btn">Suscribirme</span>
            </button>
            <button type="button" className="clubbar-x" aria-label="Cerrar" onClick={cerrarFranja}>×</button>
          </div>
        </div>
      )}
      {open && (
        <div className="club-modal" role="dialog" aria-modal="true" aria-labelledby="club-t" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="club-card">
            <button type="button" className="club-close" aria-label="Cerrar" onClick={() => setOpen(false)}>×</button>
            <Newsletter c={c} modal onDone={() => setHecho(true)} />
          </div>
        </div>
      )}
    </>
  );
}
