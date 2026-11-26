export const metadata = { title: 'Admin · EUREKA', robots: { index: false, follow: false } };

// Formulario normal (no JavaScript) con usuario + contraseña: es lo que necesitan Safari, Chrome y
// los gestores de contraseñas para ofrecer guardarla y rellenarla sola la próxima vez.
export default function LoginPage({ searchParams }: { searchParams: { e?: string; next?: string } }) {
  return (
    <div className="adm-login">
      <form className="box" action="/admin/login/entrar" method="post" autoComplete="on">
        <h1>EUREKA · Panel</h1>
        <p>Acceso interno de la tienda</p>
        {searchParams.e === '1' && <div className="err">Contraseña incorrecta.</div>}
        {searchParams.e === '2' && <div className="err">Demasiados intentos. Espera unos minutos.</div>}
        {searchParams.next && <input type="hidden" name="next" value={searchParams.next} />}
        <label className="adm-login-l" htmlFor="usuario">Usuario</label>
        <input id="usuario" name="username" type="text" autoComplete="username" defaultValue="eureka" autoCapitalize="none" spellCheck={false} />
        <label className="adm-login-l" htmlFor="clave">Contraseña</label>
        <input id="clave" name="password" type="password" autoComplete="current-password" placeholder="Contraseña" autoFocus required />
        <button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }} type="submit">Entrar</button>
        <p className="adm-login-h">Al entrar, el navegador te ofrecerá guardar la contraseña: dile que sí y la próxima vez se rellena sola.</p>
      </form>
    </div>
  );
}
