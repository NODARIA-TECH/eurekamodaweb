import type { Metadata } from 'next';
import Link from 'next/link';
import { register, activate } from '../actions';
import { findPendingClaim } from '@/lib/store';

export const metadata: Metadata = { title: 'Crear cuenta · EUREKA' };

export const dynamic = 'force-dynamic';

export default async function RegistroPage({ searchParams }: { searchParams: { e?: string; enviado?: string; activar?: string } }) {
  if (searchParams.activar) {
    const claim = await findPendingClaim(searchParams.activar);
    return (
      <main className="page">
        <div className="wrap">
          <div className="auth-card">
            <span className="lab">Área de cliente</span>
            <h1>Activar tu cuenta</h1>
            {claim ? (
              <>
                <p className="auth-sub">Confirma para activar la cuenta de <b>{claim.email}</b> y ver tus pedidos.</p>
                <form className="auth-form" action={activate}>
                  <input type="hidden" name="t" value={searchParams.activar} />
                  <button className="btn btn-gold" type="submit">Activar y entrar</button>
                </form>
              </>
            ) : (
              <div className="auth-err">El enlace no es válido, ya se usó o ha caducado. Vuelve a crear la cuenta para recibir otro.</div>
            )}
          </div>
        </div>
      </main>
    );
  }
  if (searchParams.enviado) {
    return (
      <main className="page">
        <div className="wrap">
          <div className="auth-card">
            <span className="lab">Área de cliente</span>
            <h1>Revisa tu correo</h1>
            <p className="auth-sub">Ya habías comprado con este correo. Te hemos enviado un enlace para activar tu cuenta (caduca en 24 horas). Si no lo ves, mira en la carpeta de spam.</p>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="page">
      <div className="wrap">
        <div className="auth-card">
          <span className="lab">Área de cliente</span>
          <h1>Crear cuenta</h1>
          <p className="auth-sub">Guarda tus datos y sigue tus pedidos</p>

          {searchParams.e && <div className="auth-err">{searchParams.e}</div>}

          <form className="auth-form" action={register}>
            <label>
              Nombre
              <input name="name" type="text" placeholder="Tu nombre" autoComplete="name" required autoFocus />
            </label>
            <label>
              Correo electrónico
              <input name="email" type="email" placeholder="tucorreo@ejemplo.com" autoComplete="email" required />
            </label>
            <label>
              Contraseña
              <input name="password" type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" minLength={6} required />
            </label>
            <button className="btn btn-gold" type="submit">Crear cuenta</button>
          </form>

          <p className="auth-alt">¿Ya tienes cuenta? <Link href="/cuenta/login">Iniciar sesión</Link></p>
        </div>
      </div>
    </main>
  );
}
