import type { Metadata } from 'next';
import Link from 'next/link';
import { register } from '../actions';

export const metadata: Metadata = { title: 'Crear cuenta · EUREKA' };

export default function RegistroPage({ searchParams }: { searchParams: { e?: string } }) {
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
