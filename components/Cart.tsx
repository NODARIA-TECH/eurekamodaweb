'use client';
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { CartItem } from '@/lib/types';

type AddInput = { id: string; name: string; price: number; image: string; size?: string; qty?: number };
type CartCtx = {
  items: CartItem[];
  count: number;
  total: number;
  add: (item: AddInput) => void;
  remove: (id: string, size?: string) => void;
  setQty: (id: string, size: string | undefined, qty: number) => void;
  clear: () => void;
};
const Ctx = createContext<CartCtx>({ items: [], count: 0, total: 0, add: () => {}, remove: () => {}, setQty: () => {}, clear: () => {} });
export const useCart = () => useContext(Ctx);

const KEY = 'eureka_cart';
const same = (a: CartItem, id: string, size?: string) => a.id === id && (a.size ?? '') === (size ?? '');

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [toast, setToast] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setItems(JSON.parse(s)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const flash = (msg: string) => {
    setToast(msg); setShow(true);
    clearTimeout(timer.current); timer.current = setTimeout(() => setShow(false), 1900);
  };

  const add = useCallback((it: AddInput) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => same(x, it.id, it.size));
      if (i >= 0) { const copy = [...prev]; copy[i] = { ...copy[i], qty: copy[i].qty + (it.qty ?? 1) }; return copy; }
      return [...prev, { id: it.id, name: it.name, price: it.price, image: it.image, size: it.size, qty: it.qty ?? 1 }];
    });
    flash('Añadido · ' + it.name);
  }, []);
  const remove = useCallback((id: string, size?: string) => setItems((p) => p.filter((x) => !same(x, id, size))), []);
  const setQty = useCallback((id: string, size: string | undefined, qty: number) =>
    setItems((p) => p.map((x) => (same(x, id, size) ? { ...x, qty: Math.max(1, qty) } : x))), []);
  const clear = useCallback(() => setItems([]), []);

  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <Ctx.Provider value={{ items, count, total, add, remove, setQty, clear }}>
      {children}
      <div className={'toast' + (show ? ' show' : '')} role="status" aria-live="polite">
        <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
        <span>{toast}</span>
      </div>
    </Ctx.Provider>
  );
}
