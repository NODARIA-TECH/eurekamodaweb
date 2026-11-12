'use client';
import Link from 'next/link';
import { DIAS_DEVOLUCION } from '@/lib/legal';
import { useState } from 'react';
import { useCart } from '@/components/Cart';
import { productImg } from '@/lib/data';
import { money } from '@/lib/money';
import { checkout } from './actions';
import { costeEnvio, ENVIO_PRECIO, RECOGIDA, type Entrega } from '@/lib/envio';

export default function CestaPage() {
  const { items, total, setQty, remove, clear } = useCart();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [entrega, setEntrega] = useState<Entrega>('envio');

  const envio = costeEnvio(total, entrega);
  const envioCasa = costeEnvio(total, 'envio');
  const grand = total + envio;

  async function pay() {
    setLoading(true); setErr('');
    const res = await checkout({ items: items.map((i) => ({ productId: i.id, qty: i.qty, size: i.size, color: i.color })), name, email, code: code.trim() || undefined, delivery: entrega });
    if (res.url) { window.location.href = res.url; return; } // redirige a la pasarela de Stripe
    setLoading(false);
    if (res.ok && res.ref) { clear(); setDone(res.ref); } else setErr(res.error || 'No se pudo completar el pedido.');
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
            <div className="cart-item" key={it.id + (it.size ?? '') + (it.color ?? '')}>
              <img src={productImg(it.image, 200, 260)} alt={it.name} />
              <div className="ci-info">
                <div className="ci-name">{it.name}</div>
                {(it.size || it.color) && (
                  <div className="ci-size">
                    {it.size ? `Talla ${it.size}` : ''}{it.size && it.color ? ' · ' : ''}{it.color ? `Color ${it.color}` : ''}
                  </div>
                )}
                <button className="ci-remove" onClick={() => remove(it.id, it.size, it.color)}>Eliminar</button>
              </div>
              <div className="ci-qty">
                <button onClick={() => setQty(it.id, it.size, it.color, it.qty - 1)} aria-label="Menos">−</button>
                <span>{it.qty}</span>
                <button onClick={() => setQty(it.id, it.size, it.color, it.qty + 1)} aria-label="Más">+</button>
              </div>
              <div className="ci-price">{money(it.price * it.qty)}</div>
            </div>
          ))}
        </div>
        <aside className="cart-sum">
          <h3>Resumen</h3>
          <div className="row"><span>Subtotal</span><b>{money(total)}</b></div>
          <fieldset className="cart-entrega">
            <legend>Entrega</legend>
            <label className={entrega === 'envio' ? 'on' : ''}>
              <input type="radio" name="entrega" value="envio" checked={entrega === 'envio'} onChange={() => setEntrega('envio')} />
              <span><b>Envío a domicilio</b><small>24–48 h laborables · {envioCasa === 0 ? 'gratis' : money(ENVIO_PRECIO) + ' (gratis desde 50 €)'}</small></span>
            </label>
            <label className={entrega === 'recogida' ? 'on' : ''}>
              <input type="radio" name="entrega" value="recogida" checked={entrega === 'recogida'} onChange={() => setEntrega('recogida')} />
              <span><b>Recogida en tienda · gratis</b><small>{RECOGIDA.direccion}</small></span>
            </label>
            {entrega === 'recogida' && <p className="cart-entrega-nota">{RECOGIDA.nota}</p>}
          </fieldset>
          <div className="row"><span>{entrega === 'recogida' ? 'Recogida en tienda' : 'Envío'}</span><b>{envio === 0 ? 'Gratis' : money(envio)}</b></div>
          <div className="cart-code">
            <label htmlFor="promo">¿Tienes un código?</label>
            <input id="promo" placeholder="BIENVENIDA20" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <small>El descuento se aplica en el pago.</small>
          </div>
          <div className="row total"><span>Total</span><b>{money(grand)}</b></div>
          <div className="cart-form">
            <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {err && <div className="cart-err">{err}</div>}
          <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} onClick={pay} disabled={loading}>
            {loading ? 'Procesando…' : 'Finalizar compra'}
          </button>
          <ul className="cart-trust">
            <li>Pago seguro con tarjeta (Stripe)</li>
            <li>Devoluciones en {DIAS_DEVOLUCION} días</li>
            <li>Envío gratis desde 50 € · recogida en tienda gratis</li>
          </ul>
          <p className="cart-legal">Al finalizar aceptas las <Link href="/legal/condiciones">condiciones de compra</Link> y la <Link href="/legal/devoluciones">política de devoluciones</Link>.</p>
        </aside>
      </div>
    </div></main>
  );
}
