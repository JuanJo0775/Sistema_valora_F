import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { Loading } from '../../shared/ui/Loading';
import { ResendVerification } from './ResendVerification';
import { withReturn } from './safeReturn';
import { useSession } from './session';
import { forgetVerifyReturn, readVerifyReturn, rememberVerifyReturn } from './verifyReturn';

type Outcome = 'checking' | 'verified' | 'already' | 'invalid' | 'error';

// ADR-029: el enlace del correo trae un token de un solo uso. Se confirma con un POST (un GET con
// efectos lo gastarían los antivirus y las vistas previas). Se llama una sola vez: repetir el mismo
// token da 422 aunque la primera vez haya funcionado; por eso, ante un 422 se consulta la sesión por
// si el correo ya quedó verificado.
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { session, reload } = useSession();
  const [outcome, setOutcome] = useState<Outcome>(token ? 'checking' : 'invalid');
  const asked = useRef(false);
  // Lo que la persona estaba haciendo cuando pidió el correo (H-02), leído una sola vez. También
  // puede venir en la dirección (?volver=) y entonces se recuerda.
  const [next] = useState(() => {
    rememberVerifyReturn(params.get('volver'));
    return readVerifyReturn();
  });

  useEffect(() => {
    if (!token || asked.current) return;
    asked.current = true;
    call(api.POST('/auth/verify-email', { body: { token } }))
      .then(() => {
        setOutcome('verified');
        forgetVerifyReturn();
        // La sesión ya trae el correo como verificado: se vuelve a pedir para quitar el aviso.
        reload();
      })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 422)) {
          setOutcome('error');
          return;
        }
        call(api.GET('/auth/session'))
          .then((current) => {
            setOutcome(current.emailVerified ? 'already' : 'invalid');
            if (current.emailVerified) {
              forgetVerifyReturn();
              reload();
            }
          })
          .catch(() => {
            setOutcome('invalid');
          });
      });
  }, [token, reload]);

  if (outcome === 'checking' || session.status === 'loading') return <Loading />;
  const signedIn = session.status === 'active';

  if (outcome === 'verified' || outcome === 'already') {
    return (
      <section className="state">
        <h1>{outcome === 'already' ? 'Tu correo ya está verificado' : 'Correo verificado'}</h1>
        {signedIn ? (
          <>
            <p>Ya puedes registrar precios.</p>
            {next ? (
              <>
                <Link to={next.path} className="btn">
                  {`Seguir con ${next.label}`}
                </Link>
                {next.path.split('?')[0] !== '/registrar' && (
                  <Link to="/registrar" className="btn ghost">
                    Registrar un precio
                  </Link>
                )}
              </>
            ) : (
              <Link to="/registrar" className="btn">
                Registrar un precio
              </Link>
            )}
          </>
        ) : (
          <>
            <p>Inicia sesión para registrar precios.</p>
            <Link to={withReturn('/entrar', next?.path ?? '/registrar')} className="btn">
              {next ? `Iniciar sesión y seguir con ${next.label}` : 'Iniciar sesión'}
            </Link>
          </>
        )}
      </section>
    );
  }

  // Entró a la página sin enlace estando con sesión: puede pedir otro sin buscar el aviso.
  if (!token && session.status === 'active') {
    return (
      <section className="state">
        <h1>{session.emailVerified ? 'Tu correo ya está verificado' : 'Verifica tu correo'}</h1>
        {session.emailVerified ? (
          <Link to="/registrar" className="btn">
            Registrar un precio
          </Link>
        ) : (
          <>
            <p>Abre el enlace que te enviamos por correo. Si no lo encuentras, pide otro.</p>
            <ResendVerification from={params.get('volver')} />
          </>
        )}
      </section>
    );
  }

  return (
    <section className="state" role="alert">
      <h1>No pudimos verificar tu correo</h1>
      <p>
        {outcome === 'error'
          ? 'Hubo un problema de conexión. Abre el enlace otra vez en unos minutos.'
          : signedIn
            ? 'El enlace no es válido o ya venció. Pide uno nuevo.'
            : 'El enlace ya se usó o venció. Si ya lo habías abierto, tu correo está verificado: inicia sesión. Si no, entra y pide uno nuevo.'}
      </p>
      {signedIn && outcome === 'invalid' && <ResendVerification from={params.get('volver')} />}
      {!signedIn && (
        <Link to="/entrar" className="btn ghost">
          Iniciar sesión
        </Link>
      )}
    </section>
  );
}
