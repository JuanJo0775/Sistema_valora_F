import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Field } from './Field';
import { emailProblem, useFocusFirstInvalid, waitText } from './formErrors';

// Siempre el mismo mensaje, exista o no la cuenta (el servidor responde 202 igual): no revela qué
// correos están registrados (EC-08).
export const FORGOT_SENT =
  'Si hay una cuenta con ese correo, te enviamos un enlace para crear una contraseña nueva. Vence en 1 hora.';

const RESEND_AFTER = 60;

// Cuenta regresiva en segundos: baja una vez por segundo hasta cero.
function useCountdown() {
  const [left, setLeft] = useState(0);
  const running = left > 0;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setLeft((n) => Math.max(0, n - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [running]);
  return [left, setLeft] as const;
}

// Pide el enlace para crear una contraseña nueva (POST /auth/forgot-password). Lo usan la pantalla
// «Olvidé mi contraseña» y la salida por correo de Ajustes.
export function ForgotPasswordForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [problem, setProblem] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [limit, setLimit] = useState<string | null>(null);
  const [left, setLeft] = useCountdown();
  const formRef = useRef<HTMLFormElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  const send = () => {
    setError(null);
    setLimit(null);
    setSending(true);
    call(api.POST('/auth/forgot-password', { body: { email: email.trim() } }))
      .then(() => {
        setSent(true);
        setLeft(RESEND_AFTER);
        setSending(false);
      })
      .catch((failure: unknown) => {
        if (failure instanceof ApiError && failure.status === 429) {
          setLimit(`Hiciste demasiados intentos. ${waitText(failure.retryAfterSeconds)}`);
          setLeft(failure.retryAfterSeconds ?? 0);
        } else setError(failure);
        setSending(false);
      });
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (sending || left > 0) return;
    const found = emailProblem(email);
    setProblem(found || undefined);
    if (found) {
      setAttempt((n) => n + 1);
      return;
    }
    send();
  };

  const alerts = (
    <>
      {limit && (
        <p role="alert" className="banner warn">
          {limit}
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
    </>
  );

  if (sent) {
    return (
      <div className="forgot-sent">
        <div ref={sentRef} tabIndex={-1} role="status" className="banner forgot-message">
          <p>{FORGOT_SENT}</p>
          <p className="muted">
            Si no lo ves en unos minutos, revisa la carpeta de spam o correo no deseado.
          </p>
        </div>
        {alerts}
        <div className="actions">
          <button type="button" className="btn" disabled={sending || left > 0} onClick={send}>
            {sending ? 'Enviando…' : 'Reenviar el enlace'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setSent(false);
              setLimit(null);
              setError(null);
            }}
          >
            Usar otro correo
          </button>
        </div>
        {left > 0 && <p className="muted forgot-wait">Podrás reenviarlo en {left} s.</p>}
      </div>
    );
  }

  return (
    <form className="forgot-form" onSubmit={submit} noValidate ref={formRef}>
      {alerts}
      <Field
        label="Correo"
        type="email"
        autoComplete="email"
        value={email}
        onValue={setEmail}
        error={problem}
      />
      <button type="submit" className="btn" disabled={sending || left > 0}>
        {sending ? 'Enviando…' : 'Enviarme el enlace'}
      </button>
      {left > 0 && <p className="muted forgot-wait">Podrás intentarlo de nuevo en {left} s.</p>}
    </form>
  );
}
