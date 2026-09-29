'use client';
import { createContext, useContext, useState, useCallback, useRef } from 'react';

type CartCtx = { count: number; add: (name: string) => void };
const Ctx = createContext<CartCtx>({ count: 0, add: () => {} });
export const useCart = () => useContext(Ctx);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState('');
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const add = useCallback((name: string) => {
    setCount((c) => c + 1);
    setToast('Añadido · ' + name);
    setShow(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShow(false), 1800);
  }, []);

  return (
    <Ctx.Provider value={{ count, add }}>
      {children}
      <div className={'toast' + (show ? ' show' : '')} role="status" aria-live="polite">
        <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
        <span>{toast}</span>
      </div>
    </Ctx.Provider>
  );
}
