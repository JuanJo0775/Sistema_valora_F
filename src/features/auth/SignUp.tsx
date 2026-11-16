import { type SyntheticEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';
import { safeReturn, withReturn } from './safeReturn';
import { useSession } from './session';
import './auth.css';

// Versión vigente de la política de datos (contrato: provisional hasta tener el texto).
const POLICY_VERSION = '2026-11';
const MIN_PASSWORD = 10;

// Lo mismo que exige el contrato, dicho antes de enviar: el servidor vuelve a validarlo.
function problemOf({ password, accepted }: { password: string; accepted: boolean }) {
  if (password.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${String(MIN_PASSWORD)} caracteres.`;
  }
  // Ley 1581: sin consentimiento no se crea la cuenta.
  if (!accepted) return 'Para crear la cuenta debes aceptar la política de tratamiento de datos.';
  return '';
}

// RF-001: toda cuenta nueva es reportante. El registro no inicia sesión: se entra justo después.
export function SignUp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [existing, setExisting] = useState(false);
  const [sending, setSending] = useState(false);
  const volver = safeReturn(params.get('volver'));

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const found = problemOf({ password, accepted });
    if (found) {
      setProblem(found);
      return;
    }
    setProblem('');
    setError(null);
    setExisting(false);
    setSending(true);
    call(
      api.POST('/auth/register', {
        body: { email, password, acceptedPolicyVersion: POLICY_VERSION },
      }),
    )
      .then(() => signIn({ email, password }))
      .then(() => {
        void navigate(volver, { replace: true });
      })
      .catch((failure: unknown) => {
        // EC-08: con un correo ya registrado el registro responde 201 igual y no cambia nada; si
        // luego la contraseña no coincide, se invita a entrar sin decir que la cuenta existía.
        if (failure instanceof ApiError && failure.status === 401) setExisting(true);
        else setError(failure);
        setSending(false);
      });
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>Crear cuenta</h1>
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
      {existing && (
        <p role="alert" className="banner warn">
          Si ya tenías una cuenta con ese correo, inicia sesión con tu contraseña.{' '}
          <Link to={withReturn('/entrar', volver)}>Iniciar sesión</Link>
        </p>
      )}
      <label className="field">
        Correo
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
        />
      </label>
      <label className="field">
        Contraseña
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => {
            setAccepted(event.target.checked);
          }}
        />
        Acepto la política de tratamiento de datos (versión {POLICY_VERSION}).
      </label>
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
      <p className="muted">
        ¿Ya tienes cuenta? <Link to={withReturn('/entrar', volver)}>Inicia sesión</Link>
      </p>
    </form>
  );
}
