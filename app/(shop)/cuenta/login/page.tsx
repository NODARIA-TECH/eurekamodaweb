import type { Metadata } from 'next';
import Link from 'next/link';
import { login } from '../actions';

export const metadata: Metadata = { title: 'Iniciar sesión · EUREKA' };

export default function LoginPage({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <main className="page">
      <div className="wrap">
        <div className="auth-card">
          <span className="lab">Área de cliente</span>
          <h1>Iniciar sesión</h1>
          <p className="auth-sub">Accede para ver tus pedidos y tu saldo</p>

          {searchParams.e && <div className="auth-err">{searchParams.e}</div>}

          <form className="auth-form" action={login}>
            <label>
              Correo electrónico
              <input name="email" type="email" placeholder="tucorreo@ejemplo.com" autoComplete="email" required autoFocus />
            </label>
            <label>
              Contraseña
              <input name="password" type="password" placeholder="Tu contraseña" autoComplete="current-password" required />
            </label>
            <button className="btn btn-gold" type="submit">Entrar</button>
          </form>

          <p className="auth-alt">¿No tienes cuenta? <Link href="/cuenta/registro">Crear una cuenta</Link></p>
        </div>
      </div>
    </main>
  );
}
