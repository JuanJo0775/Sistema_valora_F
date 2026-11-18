import { type SyntheticEvent, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { BackLink } from '../../shared/ui/BackLink';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Field } from './Field';
import { emailProblem, useFocusFirstInvalid } from './formErrors';
import { safeReturn, withReturn } from './safeReturn';
import { POLICY_VERSION } from '../legal/policy';
import { useSession } from './session';
import { rememberVerifyReturn } from './verifyReturn';
import './auth.css';

const MIN_PASSWORD = 10;

// B#133: letras (con tildes y ñ) y, entre palabras, un espacio, apóstrofo o guion.
const NAME = /^\p{L}+(?:[ '-]\p{L}+)*$/u;

type Problems = { name?: string; email?: string; password?: string; accepted?: string };

// Lo mismo que exige el contrato, dicho antes de enviar y junto a cada campo: el servidor vuelve a
// validarlo.
function problemsOf({
  name,
  email,
  password,
  accepted,
}: {
  name: string;
  email: string;
  password: string;
  accepted: boolean;
}): Problems {
  const trimmed = name.trim();
  const found: Problems = {};
  if (trimmed.length < 2 || trimmed.length > 40 || !NAME.test(trimmed)) {
    found.name = 'Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.';
  }
  const mail = emailProblem(email);
  if (mail) found.email = mail;
  if (password.length < MIN_PASSWORD) {
    found.password = `La contraseña debe tener al menos ${String(MIN_PASSWORD)} caracteres.`;
  }
  // Ley 1581: sin consentimiento no se crea la cuenta.
  if (!accepted) {
    found.accepted = 'Para crear la cuenta debes aceptar la política de tratamiento de datos.';
  }
  return found;
}

// RF-001: toda cuenta nueva es reportante. El registro no inicia sesión: se entra justo después.
export function SignUp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signIn } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  const [attempt, setAttempt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<unknown>(null);
  const [existing, setExisting] = useState(false);
  const [sending, setSending] = useState(false);
  const volver = safeReturn(params.get('volver'));
  useFocusFirstInvalid(formRef, attempt);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const found = problemsOf({ name, email, password, accepted });
    setProblems(found);
    if (Object.keys(found).length > 0) {
      setAttempt((n) => n + 1);
      return;
    }
    setError(null);
    setExisting(false);
    setSending(true);
    // El correo de verificación sale con el registro: se recuerda lo que se estaba haciendo (H-02).
    rememberVerifyReturn(volver);
    call(
      api.POST('/auth/register', {
        body: {
          email,
          displayName: name.trim(),
          password,
          acceptedPolicyVersion: POLICY_VERSION,
        },
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
    <form className="form" onSubmit={submit} noValidate ref={formRef}>
      <BackLink fallback="/yo" />
      <h1>Crear cuenta</h1>
      {volver.startsWith('/registrar') && (
        <p className="banner">
          Para registrar un precio necesitas una cuenta. Así tu aporte se cuenta una sola vez y se
          evitan abusos.
        </p>
      )}
      {error !== null && <ErrorState error={error} />}
      {existing && (
        <p role="alert" className="banner warn">
          Si ya tenías una cuenta con ese correo, inicia sesión con tu contraseña.{' '}
          <Link to={withReturn('/entrar', volver)}>Iniciar sesión</Link>
        </p>
      )}
      <Field
        label="Tu nombre"
        autoComplete="given-name"
        maxLength={40}
        value={name}
        onValue={setName}
        aria-describedby="nombre-privado"
        error={problems.name}
      />
      <p id="nombre-privado" className="muted">
        Solo tú lo ves. Nunca se publica.
      </p>
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
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
        error={problems.password}
        value={password}
        onValue={setPassword}
      />
      <p className="muted" id="aviso-privacidad">
        Aviso de privacidad: usamos tu correo y tu nombre solo para tu cuenta y tus aportes. No
        publicamos tus datos ni los usamos para publicidad. Puedes conocerlos, corregirlos, pedir su
        supresión o revocar tu autorización cuando quieras.
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={accepted}
          aria-invalid={problems.accepted ? true : undefined}
          aria-describedby={problems.accepted ? 'error-politica' : undefined}
          onChange={(event) => {
            setAccepted(event.target.checked);
          }}
        />
        <span>
          Acepto la{' '}
          <Link to="/privacidad" target="_blank" rel="noopener">
            política de tratamiento de datos
          </Link>{' '}
          (versión {POLICY_VERSION}).
        </span>
      </label>
      {problems.accepted && (
        <p id="error-politica" role="alert" className="field-error">
          {problems.accepted}
        </p>
      )}
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
      <p className="muted">
        ¿Ya tienes cuenta? <Link to={withReturn('/entrar', volver)}>Inicia sesión</Link>
      </p>
    </form>
  );
}
