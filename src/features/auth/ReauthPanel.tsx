import { type ReactNode, useEffect, useRef } from 'react';
import { googleReauthUrl } from './GoogleSignIn';

// 403 REAUTH_REQUIRED: la cuenta no tiene contraseña y su sesión tiene más de 10 minutos. Dos salidas
// claras: volver a entrar con Google (que regresa a `returnTo`) u otra que pone quien lo usa.
export function ReauthPanel({ returnTo, children }: { returnTo: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} role="alert" className="reauth">
      <p>
        <strong>Confirma que eres tú.</strong> Por seguridad, antes de seguir necesitamos que lo
        confirmes de nuevo. Elige una opción.
      </p>
      <div className="actions">
        <a className="btn" href={googleReauthUrl(returnTo)}>
          Confirmar con Google
        </a>
        {children}
      </div>
    </div>
  );
}
