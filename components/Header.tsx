'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NAV } from '@/lib/data';
import { useCart } from './Cart';

export default function Header() {
  const { count } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 5);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={'header' + (scrolled ? ' sc' : '')}>
      <div className="wrap">
        <div className="nav">
          <div className="nl">
            <button className="gicon burger" aria-label="Menú" onClick={() => setOpen((o) => !o)}>
              <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
            <button className="gicon" aria-label="Buscar">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>
            </button>
          </div>
          <a className="brand" href="#top" aria-label="EUREKA">
            <img src="/eureka-logo.png" alt="EUREKA — tu tienda de moda" />
          </a>
          <div className="nr">
            <button className="gicon" aria-label="Cuenta">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.9 3.1-6 7-6s7 2.1 7 6" /></svg>
            </button>
            <Link className="gicon bag" aria-label="Cesta" href="/cesta">
              <svg viewBox="0 0 24 24"><path d="M6 8h12l-1 12H7L6 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
              {count > 0 && <span className="ct">{count}</span>}
            </Link>
          </div>
        </div>
        <nav className="navlinks">
          {NAV.map((n) => (<a key={n.href} href={n.href}>{n.label}</a>))}
        </nav>
        <div className={'mobile-menu' + (open ? ' open' : '')}>
          <nav onClick={() => setOpen(false)}>
            {NAV.map((n) => (<a key={n.href} href={n.href}>{n.label}</a>))}
          </nav>
        </div>
      </div>
    </header>
  );
}
