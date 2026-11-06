import { login } from './actions';

export const metadata = { title: 'Admin · EUREKA' };

export default function LoginPage({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <div className="adm-login">
      <form className="box" action={login}>
        <h1>EUREKA · Panel</h1>
        <p>Acceso interno de la tienda</p>
        {searchParams.e === '1' && <div className="err">Contraseña incorrecta.</div>}
        {searchParams.e === '2' && <div className="err">Demasiados intentos. Espera unos minutos.</div>}
        <input name="password" type="password" placeholder="Contraseña" autoFocus />
        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} type="submit">Entrar</button>
      </form>
    </div>
  );
}
