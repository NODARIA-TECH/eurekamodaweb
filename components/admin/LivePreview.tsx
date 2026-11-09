'use client';
// Portada dentro del iframe del editor. Recibe el contenido por postMessage y lo pinta al instante.
// Los enlaces no navegan: un clic en un bloque abre su tarjeta en el editor.
import { useEffect, useState } from 'react';
import { CartProvider } from '@/components/Cart';
import Promo from '@/components/Promo';
import Header from '@/components/Header';
import HomeBody from '@/components/HomeBody';
import { Footer } from '@/components/Sections';
import { normalizeContent, type SiteContent } from '@/lib/site-content';
import type { Category, Product } from '@/lib/types';

export default function LivePreview({ initial, products, categories }: { initial: SiteContent; products: Product[]; categories: Category[] }) {
  const [c, setC] = useState(initial);
  const [sel, setSel] = useState<string | null>(null);
  const embedded = typeof window !== 'undefined' && window.parent !== window;

  useEffect(() => {
    const post = (msg: object) => window.parent !== window && window.parent.postMessage(msg, location.origin);
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const d = e.data || {};
      if (d.type === 'eureka:content') setC(normalizeContent(d.content));
      if (d.type === 'eureka:focus') {
        setSel(d.id);
        const el = document.querySelector(`[data-sec="${d.id}"]`);
        if (el && d.scroll !== false) el.scrollIntoView({ behavior: 'smooth', block: d.id === 'promo' ? 'start' : 'start' });
      }
    };
    const onClick = (e: MouseEvent) => {
      if (window.parent === window) return;              // abierta en pestaña aparte: navegación normal
      const t = e.target as HTMLElement;
      if (t.closest('a')) e.preventDefault();
      if (t.closest('.nlf')) return;                        // dejar escribir en el formulario
      const sec = t.closest('[data-sec]') as HTMLElement | null;
      if (sec) post({ type: 'eureka:select', id: sec.dataset.sec });
    };
    window.addEventListener('message', onMsg);
    document.addEventListener('click', onClick, true);
    post({ type: 'eureka:ready' });
    return () => { window.removeEventListener('message', onMsg); document.removeEventListener('click', onClick, true); };
  }, []);

  useEffect(() => {
    document.querySelectorAll('[data-sec]').forEach((el) => el.classList.toggle('pv-on', (el as HTMLElement).dataset.sec === sel));
  }, [sel, c]);

  return (
    <CartProvider>
      <div className={embedded ? 'pv-root pv-embed' : 'pv-root'}>
        <div data-sec="promo" className="pv-sec" data-label="Barra de aviso">
          {c.promo.show && c.promo.text.trim() ? <Promo show text={c.promo.text} /> : embedded ? <div className="pv-hidden">Barra de aviso oculta</div> : null}
        </div>
        <Header />
        <main id="top"><HomeBody c={c} products={products} categories={categories} mark /></main>
        <Footer />
      </div>
    </CartProvider>
  );
}
