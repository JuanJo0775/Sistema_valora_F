import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Field } from './Field';
import {
  confirmProblem,
  MIN_PASSWORD,
  newPasswordProblem,
  PASSWORD_HINT,
  useFocusFirstInvalid,
  waitText,
} from './formErrors';
import './auth.css';

type Phase = 'form' | 'done' | 'invalid';

// El enlace del correo trae un token de un solo uso (vence en 1 hora). Se lee una vez, se guarda solo
// en el estado de la pantalla y se quita de la dirección: no queda en el historial, en una captura
// ni en lo que se comparte. Nunca va a localStorage. La contraseña nueva tampoco se guarda.
export function ResetPassword() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get('token') ?? '');
  const [phase, setPhase] = useState<Phase>(token ? 'form' : 'invalid');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problems, setProblems] = useState<{ password?: string; confirm?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'form') headingRef.current?.focus();
  }, [phase]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (sending) return;
    const found = {
      password: newPasswordProblem(password) || undefined,
      confirm: confirmProblem(password, confirm) || undefined,
    };
    setProblems(found);
    if (found.password || found.confirm) {
      setAttempt((n) => n + 1);
      return;
    }
    setError(null);
    setMessage(null);
    setSending(true);
    call(api.POST('/auth/reset-password', { body: { token, password } }))
      .then(() => {
        setPassword('');
        setConfirm('');
        setPhase('done');
      })
      .catch((failure: unknown) => {
        setSending(false);
        if (failure instanceof ApiError && failure.status === 422) setPhase('invalid');
        else if (failure instanceof ApiError && failure.status === 429) {
          setMessage(`Hiciste demasiados intentos. ${waitText(failure.retryAfterSeconds)}`);
        } else if (failure instanceof ApiError && failure.status === 400) {
          setMessage(`La contraseña no cumple las reglas. ${PASSWORD_HINT}`);
        } else setError(failure);
      });
  };

  if (phase === 'done') {
    return (
      <section className="state">
        <h1 ref={headingRef} tabIndex={-1}>
          Tu contraseña quedó actualizada
        </h1>
        <p role="status">Ya puedes entrar con tu correo y tu contraseña nueva.</p>
        <Link to="/entrar" replace className="btn">
          Iniciar sesión
        </Link>
      </section>
    );
  }

  if (phase === 'invalid') {
    return (
      <section className="state">
        <h1 ref={headingRef} tabIndex={-1}>
          El enlace venció o ya se usó
        </h1>
        <p role="alert">
          Por seguridad, cada enlace vale 1 hora y se puede usar una sola vez. Pide uno nuevo.
        </p>
        <Link to="/olvide-contrasena" replace className="btn">
          Pedir otro enlace
        </Link>
      </section>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate ref={formRef}>
      <h1>Crea tu contraseña nueva</h1>
      {message && (
        <p role="alert" className="banner warn">
          {message}
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
      <Field
        label="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        aria-describedby="reset-hint"
        value={password}
        onValue={setPassword}
        error={problems.password}
      />
      <p id="reset-hint" className="muted">
        {PASSWORD_HINT}
      </p>
      <Field
        label="Repite la contraseña nueva"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onValue={setConfirm}
        error={problems.confirm}
      />
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
