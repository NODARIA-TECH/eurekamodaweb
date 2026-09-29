import { login } from './actions';

export const metadata = { title: 'Admin · EUREKA' };

export default function LoginPage({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <div className="adm-login">
      <form className="box" action={login}>
        <h1>EUREKA · Panel</h1>
        <p>Acceso interno de la tienda</p>
        {searchParams.e && <div className="err">Contraseña incorrecta.</div>}
        <input name="password" type="password" placeholder="Contraseña" autoFocus />
        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} type="submit">Entrar</button>
        <p style={{ marginTop: 14, fontSize: '.72rem' }}>Demo: contraseña <b>eureka</b> (configurable con EUREKA_ADMIN_PASSWORD).</p>
      </form>
    </div>
  );
}
