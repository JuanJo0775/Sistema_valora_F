import { useState } from 'react';
import { useLocation } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { rememberVerifyReturn } from './verifyReturn';

type Sending = 'idle' | 'sending' | 'sent' | 'limit' | 'error';

// Pide otro enlace de verificación (el servidor limita a 3 por hora). Un solo botón de una línea y
// el resultado en una frase anunciada a lectores de pantalla.
// H-02: al pedirlo se recuerda lo que la persona estaba haciendo (`from`, o la pantalla donde está)
// para ofrecerle seguir con eso cuando abra el enlace del correo.
export function ResendVerification({ from }: { from?: string | null }) {
  const [state, setState] = useState<Sending>('idle');
  const { pathname, search } = useLocation();

  const resend = () => {
    rememberVerifyReturn(from ?? pathname + search);
    setState('sending');
    call(api.POST('/auth/resend-verification'))
      .then(() => {
        setState('sent');
      })
      .catch((error: unknown) => {
        setState(error instanceof ApiError && error.status === 429 ? 'limit' : 'error');
      });
  };

  const note =
    state === 'sent'
      ? 'Listo, revisa tu bandeja de entrada (y la carpeta de spam).'
      : state === 'limit'
        ? 'Ya pediste varios enlaces. Prueba de nuevo en una hora.'
        : state === 'error'
          ? 'No pudimos enviar el enlace. Inténtalo de nuevo más tarde.'
          : '';

  return (
    <>
      <button
        type="button"
        className="link-button resend"
        disabled={state === 'sending' || state === 'sent'}
        onClick={resend}
      >
        {state === 'sending'
          ? 'Enviando…'
          : state === 'sent'
            ? 'Enlace enviado'
            : 'Enviarme otro enlace'}
      </button>
      {note && (
        <span role="status" className="resend-note">
          {note}
        </span>
      )}
    </>
  );
}
