import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { Loading } from '../../shared/ui/Loading';
import { useSession } from './session';

type Outcome = 'checking' | 'verified' | 'invalid' | 'error';

// ADR-029: el enlace del correo trae un token de un solo uso. Se confirma con un POST (un GET con
// efectos lo gastarían los antivirus y las vistas previas). Se llama una sola vez: repetir el mismo
// token da 422 aunque la primera vez haya funcionado.
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { reload } = useSession();
  const [outcome, setOutcome] = useState<Outcome>(token ? 'checking' : 'invalid');
  const asked = useRef(false);

  useEffect(() => {
    if (!token || asked.current) return;
    asked.current = true;
    call(api.POST('/auth/verify-email', { body: { token } }))
      .then(() => {
        setOutcome('verified');
        // La sesión ya trae el correo como verificado: se vuelve a pedir para quitar el aviso.
        reload();
      })
      .catch((error: unknown) => {
        setOutcome(error instanceof ApiError && error.status === 422 ? 'invalid' : 'error');
      });
  }, [token, reload]);

  if (outcome === 'checking') return <Loading />;
  if (outcome === 'verified') {
    return (
      <section className="state">
        <h1>Correo verificado</h1>
        <p>Ya puedes registrar precios.</p>
        <Link to="/registrar" className="btn">
          Registrar un precio
        </Link>
      </section>
    );
  }
  return (
    <section className="state" role="alert">
      <h1>No pudimos verificar tu correo</h1>
      <p>
        {outcome === 'error'
          ? 'Hubo un problema de conexión. Abre el enlace otra vez en unos minutos.'
          : 'El enlace no es válido o ya venció. Inicia sesión y pide uno nuevo desde el aviso de la parte superior.'}
      </p>
      <Link to="/entrar" className="btn ghost">
        Iniciar sesión
      </Link>
    </section>
  );
}
