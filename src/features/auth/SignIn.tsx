import { type SyntheticEvent, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { BackLink } from '../../shared/ui/BackLink';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Field } from './Field';
import { emailProblem, useFocusFirstInvalid } from './formErrors';
import { safeReturn, withReturn } from './safeReturn';
import { useSession } from './session';
import './auth.css';

// La contraseña vive solo en el estado del formulario y viaja en el cuerpo de la petición: nunca en
// la dirección, en localStorage ni en IndexedDB (OFFLINE_FIRST.md).
export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [problems, setProblems] = useState<{ email?: string; password?: string }>({});
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const volver = safeReturn(params.get('volver'));
  useFocusFirstInvalid(formRef, attempt);

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
        setError(failure);
        setSending(false);
      });
  };

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
      <p className="muted">
        ¿No tienes cuenta? <Link to={withReturn('/crear-cuenta', volver)}>Crea una cuenta</Link>
      </p>
    </form>
  );
}
