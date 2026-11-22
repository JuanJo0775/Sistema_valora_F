import { type SyntheticEvent, useRef, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Field } from './Field';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import {
  confirmProblem,
  MIN_PASSWORD,
  newPasswordProblem,
  PASSWORD_HINT,
  useFocusFirstInvalid,
  waitText,
} from './formErrors';
import { ReauthPanel } from './ReauthPanel';
import { useSession } from './session';

type Failure =
  | { kind: 'current' }
  | { kind: 'reauth' }
  | { kind: 'message'; text: string }
  | { kind: 'other'; error: unknown };

function failureOf(error: unknown): Failure {
  if (error instanceof ApiError) {
    if (error.status === 403 && error.code === 'INVALID_PASSWORD') return { kind: 'current' };
    if (error.status === 403 && error.code === 'REAUTH_REQUIRED') return { kind: 'reauth' };
    if (error.status === 429) {
      return {
        kind: 'message',
        text: `Hiciste demasiados intentos. ${waitText(error.retryAfterSeconds)}`,
      };
    }
    if (error.status === 400) {
      return { kind: 'message', text: `La contraseña no cumple las reglas. ${PASSWORD_HINT}` };
    }
  }
  return { kind: 'other', error };
}

// Ajustes › Seguridad › Contraseña. Con contraseña, se cambia pidiendo la actual; una cuenta creada
// con Google (hasPassword false) puede crear la primera. Ninguna contraseña se guarda fuera del
// estado del formulario.
export function PasswordSettings() {
  const { session, passwordCreated } = useSession();
  const hasPassword = session.status === 'active' && session.hasPassword;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problems, setProblems] = useState<{ current?: string; next?: string; confirm?: string }>(
    {},
  );
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [byEmail, setByEmail] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstInvalid(formRef, attempt);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (sending) return;
    const found = {
      current: hasPassword && !current ? 'Escribe tu contraseña actual.' : undefined,
      next: newPasswordProblem(next) || undefined,
      confirm: confirmProblem(next, confirm) || undefined,
    };
    setProblems(found);
    if (found.current || found.next || found.confirm) {
      setAttempt((n) => n + 1);
      return;
    }
    setFailure(null);
    setDone(null);
    setByEmail(false);
    setSending(true);
    call(
      api.POST('/me/password', {
        body: hasPassword ? { currentPassword: current, newPassword: next } : { newPassword: next },
      }),
    )
      .then(() => {
        setDone(
          hasPassword
            ? 'Listo, cambiaste tu contraseña.'
            : 'Listo, creaste tu contraseña. Ahora también puedes entrar con tu correo.',
        );
        setCurrent('');
        setNext('');
        setConfirm('');
        setSending(false);
        if (!hasPassword) passwordCreated();
      })
      .catch((error: unknown) => {
        setFailure(failureOf(error));
        setAttempt((n) => n + 1);
        setSending(false);
      });
  };

  const wrongCurrent = failure?.kind === 'current';
  return (
    <div className="password-block">
      {failure?.kind === 'reauth' && (
        <ReauthPanel returnTo="/yo/ajustes">
          <button
            type="button"
            className="btn ghost"
            aria-expanded={byEmail}
            onClick={() => {
              setByEmail(true);
            }}
          >
            Enviarme un correo para crearla
          </button>
        </ReauthPanel>
      )}
      {byEmail && failure?.kind === 'reauth' && (
        <div className="password-email">
          <p className="muted">Escribe el correo de tu cuenta y te enviamos un enlace.</p>
          <ForgotPasswordForm />
        </div>
      )}
      <form className="password-form" onSubmit={submit} noValidate ref={formRef}>
        <h3 className="password-title">Contraseña</h3>
        {hasPassword ? (
          <p className="muted">Cámbiala cuando quieras. Necesitas la actual.</p>
        ) : (
          <p className="muted">
            Entraste con Google; si creas una contraseña también podrás entrar con tu correo.
          </p>
        )}
        {done && (
          <p role="status" className="banner">
            {done}
          </p>
        )}
        {failure?.kind === 'message' && (
          <p role="alert" className="banner warn">
            {failure.text}
          </p>
        )}
        {failure?.kind === 'other' && <ErrorState error={failure.error} />}
        {hasPassword && (
          <Field
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={current}
            onValue={(value) => {
              setCurrent(value);
              if (wrongCurrent) setFailure(null);
            }}
            error={
              wrongCurrent
                ? 'La contraseña actual no es correcta. Revísala e inténtalo de nuevo.'
                : problems.current
            }
          />
        )}
        <Field
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          aria-describedby="password-hint"
          value={next}
          onValue={setNext}
          error={problems.next}
        />
        <p id="password-hint" className="muted">
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
          {sending ? 'Guardando…' : hasPassword ? 'Cambiar contraseña' : 'Crear una contraseña'}
        </button>
      </form>
    </div>
  );
}
