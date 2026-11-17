import { useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { useSession } from './session';

type Sending = 'idle' | 'sending' | 'sent' | 'limit' | 'error';

// ADR-029: con una cuenta sin el correo verificado se puede navegar, pero no registrar precios. El
// aviso lo dice y deja pedir otro enlace (el servidor limita a 3 por hora).
export function VerifyEmailBanner() {
  const { session } = useSession();
  const [state, setState] = useState<Sending>('idle');
  if (session.status !== 'active' || session.emailVerified || !session.emailVerificationRequired) {
    return null;
  }

  const resend = () => {
    setState('sending');
    call(api.POST('/auth/resend-verification'))
      .then(() => {
        setState('sent');
      })
      .catch((error: unknown) => {
        setState(error instanceof ApiError && error.status === 429 ? 'limit' : 'error');
      });
  };

  return (
    <div className="banner warn" role="status">
      <p>
        Verifica tu correo para registrar precios. Te enviamos un enlace; vale 24 horas. Para
        comparar y ver el mapa no hace falta.
      </p>
      {state === 'sent' && <p>Listo, revisa tu bandeja de entrada (y la carpeta de spam).</p>}
      {state === 'limit' && <p>Ya pediste varios enlaces. Prueba de nuevo en una hora.</p>}
      {state === 'error' && <p>No pudimos enviar el enlace. Inténtalo de nuevo más tarde.</p>}
      <button
        type="button"
        className="btn ghost"
        disabled={state === 'sending' || state === 'sent'}
        onClick={resend}
      >
        {state === 'sending' ? 'Enviando…' : 'Enviarme otro enlace'}
      </button>
    </div>
  );
}
