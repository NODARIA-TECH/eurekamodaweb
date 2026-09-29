'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/components/Cart';
import { pexels } from '@/lib/data';
import { money } from '@/lib/money';
import { checkout } from './actions';

export default function CestaPage() {
  const { items, total, setQty, remove, clear } = useCart();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const envio = total >= 5000 || total === 0 ? 0 : 395;
  const grand = total + envio;

  async function pay() {
    setLoading(true); setErr('');
    const res = await checkout({ items: items.map((i) => ({ productId: i.id, qty: i.qty, size: i.size })), name, email });
    setLoading(false);
    if (res.ok) { clear(); setDone(res.ref!); } else setErr(res.error || 'No se pudo completar el pedido.');
  }

  if (done) {
    return (
      <main className="page"><div className="wrap" style={{ maxWidth: 620 }}>
        <div className="page-head">
          <span className="lab">Pedido confirmado</span>
          <h1>¡Gracias por tu compra!</h1>
          <p>Tu pedido <b>{done}</b> se ha registrado. Recibirás la confirmación por email.</p>
        </div>
        <div style={{ textAlign: 'center' }}><Link className="btn btn-gold" href="/tienda">Seguir comprando</Link></div>
      </div></main>
    );
  }

  if (!items.length) {
    return (
      <main className="page"><div className="wrap" style={{ maxWidth: 620 }}>
        <div className="page-head"><span className="lab">Cesta</span><h1>Tu cesta está vacía</h1></div>
        <div style={{ textAlign: 'center' }}><Link className="btn btn-gold" href="/tienda">Descubrir la colección</Link></div>
      </div></main>
    );
  }

  return (
    <main className="page"><div className="wrap">
      <div className="page-head"><span className="lab">Cesta</span><h1>Tu cesta</h1></div>
      <div className="cart">
        <div className="cart-items">
          {items.map((it) => (
            <div className="cart-item" key={it.id + (it.size ?? '')}>
              <img src={pexels(it.image, 200, 260)} alt={it.name} />
              <div className="ci-info">
                <div className="ci-name">{it.name}</div>
                {it.size && <div className="ci-size">Talla {it.size}</div>}
                <button className="ci-remove" onClick={() => remove(it.id, it.size)}>Eliminar</button>
              </div>
              <div className="ci-qty">
                <button onClick={() => setQty(it.id, it.size, it.qty - 1)} aria-label="Menos">−</button>
                <span>{it.qty}</span>
                <button onClick={() => setQty(it.id, it.size, it.qty + 1)} aria-label="Más">+</button>
              </div>
              <div className="ci-price">{money(it.price * it.qty)}</div>
            </div>
          ))}
        </div>
        <aside className="cart-sum">
          <h3>Resumen</h3>
          <div className="row"><span>Subtotal</span><b>{money(total)}</b></div>
          <div className="row"><span>Envío</span><b>{envio === 0 ? 'Gratis' : money(envio)}</b></div>
          <div className="row total"><span>Total</span><b>{money(grand)}</b></div>
          <div className="cart-form">
            <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <div className="cart-err">{err}</div>}
          <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={pay} disabled={loading}>
            {loading ? 'Procesando…' : 'Finalizar compra'}
          </button>
          <p className="cart-note">Demo: el pedido se registra y descuenta stock. La pasarela de pago (Stripe/Redsys) se integra en el nivel Estándar+.</p>
        </aside>
      </div>
    </div></main>
  );
}
