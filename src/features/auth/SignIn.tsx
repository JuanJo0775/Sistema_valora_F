import { type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../../shared/api';
import { BackLink } from '../../shared/ui/BackLink';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Field } from './Field';
import { GoogleButton } from './GoogleButton';
import { GoogleNotice, useGoogleNotice } from './GoogleNotice';
import { emailProblem, useFocusFirstInvalid } from './formErrors';
import { safeReturn, withReturn } from './safeReturn';
import { longDate } from './scheduledDate';
import { useSession } from './session';
import './auth.css';

// La contraseña vive solo en el estado del formulario y viaja en el cuerpo de la petición: nunca en
// la dirección, en localStorage ni en IndexedDB (OFFLINE_FIRST.md).
export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, restoreAccount } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [problems, setProblems] = useState<{ email?: string; password?: string }>({});
  const [attempt, setAttempt] = useState(0);
  // 403 ACCOUNT_PENDING_DELETION: no es un error de credenciales, la cuenta está en período de gracia.
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<unknown>(null);
  const panelRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const volver = safeReturn(params.get('volver'));
  const googleCode = useGoogleNotice();
  useFocusFirstInvalid(formRef, attempt);

  // Google pide aceptar la política antes de crear una cuenta nueva: eso se hace en /crear-cuenta.
  useEffect(() => {
    if (googleCode === 'consentimiento') {
      void navigate(`${withReturn('/crear-cuenta', volver)}&google=consentimiento`, {
        replace: true,
      });
    }
  }, [googleCode, navigate, volver]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const found = {
      email: emailProblem(email) || undefined,
      password: password ? undefined : 'Escribe tu contraseña.',
    };
    setProblems(found);
    if (found.email || found.password) {
      setAttempt((n) => n + 1);
      return;
    }
    setError(null);
    setSending(true);
    signIn({ email, password })
      .then(() => {
        void navigate(volver, { replace: true });
      })
      .catch((failure: unknown) => {
        if (
          failure instanceof ApiError &&
          failure.status === 403 &&
          failure.code === 'ACCOUNT_PENDING_DELETION' &&
          failure.scheduledFor
        ) {
          setPendingFor(failure.scheduledFor);
          setRestoreError(null);
        } else setError(failure);
        setSending(false);
      });
  };

  const restore = () => {
    setRestoreError(null);
    setSending(true);
    restoreAccount({ email, password })
      .then(() => {
        void navigate(volver, { replace: true });
      })
      .catch((failure: unknown) => {
        setRestoreError(failure);
        setSending(false);
      });
  };

  useEffect(() => {
    if (pendingFor) panelRef.current?.focus();
  }, [pendingFor]);

  if (pendingFor) {
    return (
      <section className="form pending-deletion">
        <BackLink fallback="/yo" />
        <h1 ref={panelRef} tabIndex={-1}>
          Tu cuenta está programada para eliminarse el {longDate(pendingFor)}
        </h1>
        <p>
          Pediste eliminar tu cuenta. Hasta esa fecha puedes cambiar de opinión y restaurarla con
          todo como estaba. Pasada la fecha se elimina de forma definitiva.
        </p>
        {restoreError !== null && <ErrorState error={restoreError} />}
        <div className="actions">
          <button type="button" className="btn" disabled={sending} onClick={restore}>
            {sending ? 'Restaurando…' : 'Restaurar mi cuenta'}
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={sending}
            onClick={() => {
              setPendingFor(null);
              setRestoreError(null);
              setPassword('');
            }}
          >
            Dejar que se elimine
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate ref={formRef}>
      <BackLink fallback="/yo" />
      <h1>Iniciar sesión</h1>
      {volver.startsWith('/registrar') && (
        <p className="banner">
          Para registrar un precio necesitas una cuenta. Así tu aporte se cuenta una sola vez y se
          evitan abusos. Al entrar vuelves a registrar tu precio.
        </p>
      )}
      {googleCode !== null && googleCode !== 'consentimiento' && <GoogleNotice code={googleCode} />}
      {/* 401, 429 y sin red: el servidor y el cliente ya traen el mensaje en español. */}
      {error !== null && <ErrorState error={error} />}
      <Field
        label="Correo"
        type="email"
        autoComplete="email"
        value={email}
        onValue={setEmail}
        error={problems.email}
      />
      <Field
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        value={password}
        onValue={setPassword}
        error={problems.password}
      />
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Entrando…' : 'Entrar'}
      </button>
      <GoogleButton returnTo={volver} />
      <p className="muted">
        ¿No tienes cuenta? <Link to={withReturn('/crear-cuenta', volver)}>Crea una cuenta</Link>
      </p>
    </form>
  );
}
