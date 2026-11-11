// Ficha de un pedido: por dónde va, avisar a la clienta, envío, datos, artículos, notas y borrar.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder, listProducts, getCustomer } from '@/lib/store';
import { money } from '@/lib/money';
import { ORDER_STATUSES, STATUS_LABEL } from '@/lib/types';
import OrderTracker from '@/components/OrderTracker';
import ConfirmSubmit from '@/components/admin/ConfirmSubmit';
import { saveProgress, saveCustomer, saveItems, saveNotes, removeOrder, removeCustomerFromOrder } from '../actions';

export const dynamic = 'force-dynamic';

const CARRIERS = ['Correos', 'Correos Express', 'SEUR', 'MRW', 'GLS', 'CTT Express', 'DHL', 'Recogida en tienda', 'Entrega en mano'];
const OK: Record<string, string> = { progreso: 'Estado y envío guardados.', datos: 'Datos de la clienta guardados.', articulos: 'Artículos actualizados.', notas: 'Notas guardadas.', clienta: 'Clienta eliminada (el pedido se conserva).' };
const MAIL: Record<string, string> = { enviado: ' Se ha enviado a la clienta el email «Tu pedido va de camino».', aviso: ' Se ha avisado a la clienta por email.', fallo: ' No se pudo enviar el email a la clienta.' };
const fecha = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export default async function PedidoAdmin({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; e?: string; mail?: string } }) {
  const o = await getOrder(params.id);
  if (!o) notFound();
  const [products, cust] = await Promise.all([listProducts(), o.customerId ? getCustomer(o.customerId) : Promise.resolve(undefined)]);
  const a = o.shipping || {};
  const addOptions: [string, string][] = [];
  for (const p of products) {
    if (p.variants?.length) for (const v of p.variants) addOptions.push([`${p.id}|${v.size || ''}|${v.color || ''}`, `${p.name} · ${[v.size, v.color].filter(Boolean).join(' · ')} (${v.stock} uds · ${money(p.price)})`]);
    else addOptions.push([`${p.id}||`, `${p.name} (${p.stock} uds · ${money(p.price)})`]);
  }
  // Tras guardar, los formularios se vuelven a montar con los datos nuevos (y vacían el mensaje)
  const ver = `${o.history?.length || 0}-${o.editedAt || ''}-${o.status}`;
  const paidDiff = o.amountPaid != null ? o.amountPaid - (o.shippingCost || 0) + (o.discount || 0) - o.total : 0;

  return (
    <>
      <div className="adm-h">
        <div>
          <p style={{ margin: 0 }}><Link href="/admin/pedidos">← Pedidos</Link></p>
          <h1>Pedido {o.ref} <span className={'badge-pill st-' + o.status} style={{ verticalAlign: 'middle', fontSize: '.8rem' }}>{STATUS_LABEL[o.status]}</span></h1>
          <p>{fecha(o.createdAt)} · {o.customerName || 'Sin nombre'} · <b>{money(o.amountPaid ?? o.total)}</b>{o.stripeSessionId ? ' · pago online (Stripe)' : ''}{o.syncedAt ? ` · pasado a FacturaScripts${o.facturaRef ? ' (' + o.facturaRef + ')' : ''}` : ''}</p>
        </div>
      </div>
      {searchParams.ok && <div className="adm-ok">{OK[searchParams.ok] || 'Guardado.'}{searchParams.mail ? MAIL[searchParams.mail] || '' : ''}</div>}
      {searchParams.e && <div className="adm-ok adm-err">{searchParams.e}</div>}

      <div className="adm-card">
        <h2>Por dónde va</h2>
        <OrderTracker status={o.status} history={o.history} carrier={o.carrier} trackingNumber={o.trackingNumber} trackingUrl={o.trackingUrl} />
        <form key={'saveProgress' + ver} action={saveProgress} className="adm-form" style={{ marginTop: 16 }}>
          <input type="hidden" name="id" value={o.id} />
          <label>Estado
            <select name="status" defaultValue={o.status}>{ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          </label>
          <label>Empresa de envío
            <input name="carrier" list="carriers" defaultValue={o.carrier || ''} placeholder="Correos, SEUR…" />
            <datalist id="carriers">{CARRIERS.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label>Nº de seguimiento<input name="trackingNumber" defaultValue={o.trackingNumber || ''} placeholder="PQ123456789ES" /></label>
          <label>Enlace de seguimiento (opcional)<input name="trackingUrl" defaultValue={o.trackingUrl || ''} placeholder="https://…" /></label>
          <label style={{ gridColumn: '1 / -1' }}>Mensaje para la clienta (opcional · sale en su seguimiento)
            <textarea name="note" rows={2} placeholder="Ej.: Ya lo tenemos preparado, sale mañana por la mañana." />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8, gridColumn: '1 / -1' }}>
            <input type="checkbox" name="notify" defaultChecked={!!o.customerEmail} disabled={!o.customerEmail} style={{ width: 'auto' }} />
            Avisar a la clienta por email{o.customerEmail ? ` (${o.customerEmail})` : ' (no tiene correo)'}
          </label>
          <button className="btn-sm gold" type="submit" style={{ height: 40 }}>Guardar estado y envío</button>
        </form>
        <p className="adm-help">Al cancelar un pedido, sus unidades vuelven al stock. Las fechas y los mensajes de arriba son los que ve la clienta en «Seguir pedido» y en su cuenta.</p>
      </div>

      <div className="adm-card">
        <h2>Artículos</h2>
        <form key={'saveItems' + ver} action={saveItems}>
          <input type="hidden" name="id" value={o.id} />
          <table className="adm-table">
            <thead><tr><th>Artículo</th><th>Precio</th><th>Cantidad</th><th>Importe</th><th>Quitar</th></tr></thead>
            <tbody>
              {o.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.name}{it.size || it.color ? <span className="adm-help" style={{ margin: 0 }}> · {[it.size, it.color].filter(Boolean).join(' · ')}</span> : null}{it.variantSku ? <div className="adm-help" style={{ margin: 0 }}>{it.variantSku}</div> : null}</td>
                  <td>{money(it.price)}</td>
                  <td><input name={'qty' + i} type="number" min={0} max={99} defaultValue={it.qty} style={{ width: 70 }} /></td>
                  <td>{money(it.price * it.qty)}</td>
                  <td><input type="checkbox" name={'del' + i} aria-label={'Quitar ' + it.name} /></td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}>
                  <select name="add" defaultValue="" style={{ width: '100%' }}>
                    <option value="">+ Añadir otro artículo…</option>
                    {addOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td><input name="addQty" type="number" min={1} max={99} defaultValue={1} style={{ width: 70 }} /></td>
                <td colSpan={2}><b>Total artículos: {money(o.total)}</b></td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn-sm gold" type="submit">Guardar artículos</button>
            <span className="adm-help" style={{ margin: 0 }}>Si el pedido ya descontó stock, se ajusta solo con la diferencia.</span>
          </div>
        </form>
        {o.amountPaid != null && (
          <p className="adm-help">Cobrado por Stripe: <b>{money(o.amountPaid)}</b>{o.shippingCost ? ` (envío ${money(o.shippingCost)})` : ''}{o.discount ? ` · descuento ${money(o.discount)}` : ''}.
            {paidDiff !== 0 && <> Con los cambios, los artículos {paidDiff > 0 ? 'suman ' + money(paidDiff) + ' menos' : 'suman ' + money(-paidDiff) + ' más'} de lo cobrado: haz el reembolso o el cobro de la diferencia desde Stripe.</>}
          </p>
        )}
      </div>

      <div className="adm-card">
        <h2>Clienta y envío</h2>
        <form key={'saveCustomer' + ver} action={saveCustomer} className="adm-form">
          <input type="hidden" name="id" value={o.id} />
          <label>Nombre<input name="customerName" defaultValue={o.customerName || ''} /></label>
          <label>Correo<input name="customerEmail" type="email" defaultValue={o.customerEmail || ''} /></label>
          <label>Teléfono<input name="phone" defaultValue={o.phone || ''} /></label>
          <label>Destinataria<input name="sname" defaultValue={a.name || ''} /></label>
          <label>Dirección<input name="line1" defaultValue={a.line1 || ''} /></label>
          <label>Piso, puerta…<input name="line2" defaultValue={a.line2 || ''} /></label>
          <label>Código postal<input name="postalCode" defaultValue={a.postalCode || ''} /></label>
          <label>Localidad<input name="city" defaultValue={a.city || ''} /></label>
          <label>Provincia<input name="state" defaultValue={a.state || ''} /></label>
          <input type="hidden" name="country" value={a.country || 'ES'} />
          <button className="btn-sm gold" type="submit" style={{ height: 40 }}>Guardar datos</button>
        </form>
        {cust && (
          <form action={removeCustomerFromOrder} style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="customerId" value={cust.id} />
            <span className="adm-help" style={{ margin: 0 }}>Ficha de clienta: <Link href={`/admin/clientes/${cust.id}`}>{cust.name}</Link>{cust.passwordHash ? ' · tiene cuenta' : ' · sin cuenta'}{cust.balance ? ` · saldo ${money(cust.balance)}` : ''}</span>
            <ConfirmSubmit className="btn-sm danger" message={`¿Eliminar la clienta ${cust.name}? Se borran su ficha, su cuenta y su saldo. Este pedido y los demás se conservan.`}>Eliminar clienta</ConfirmSubmit>
          </form>
        )}
      </div>

      <div className="adm-card">
        <h2>Notas internas</h2>
        <form key={'saveNotes' + ver} action={saveNotes}>
          <input type="hidden" name="id" value={o.id} />
          <textarea name="notes" rows={3} defaultValue={o.notes || ''} placeholder="Solo las ve la tienda: «la quiere envolver para regalo», «llamar antes de enviar»…" style={{ width: '100%' }} />
          <button className="btn-sm" type="submit" style={{ marginTop: 8 }}>Guardar notas</button>
        </form>
      </div>

      <div className="adm-card">
        <h2>Eliminar pedido</h2>
        <form action={removeOrder} style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="hidden" name="id" value={o.id} />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name="restock" defaultChecked /> Devolver las unidades al stock</label>
          <ConfirmSubmit className="btn-sm danger" message={`¿Eliminar el pedido ${o.ref}? No se puede deshacer. Si solo no se va a enviar, mejor cámbialo a «Cancelado».`}>Eliminar pedido</ConfirmSubmit>
        </form>
        <p className="adm-help">Para un pedido real que no sigue adelante es mejor «Cancelado»: queda constancia y la clienta lo ve.</p>
      </div>
    </>
  );
}
