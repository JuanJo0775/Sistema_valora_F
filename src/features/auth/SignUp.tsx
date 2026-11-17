import { type SyntheticEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError, call } from '../../shared/api';
import { BackLink } from '../../shared/ui/BackLink';
import { ErrorState } from '../../shared/ui/ErrorState';
import { Field } from './Field';
import { safeReturn, withReturn } from './safeReturn';
import { POLICY_VERSION } from '../legal/policy';
import { useSession } from './session';
import './auth.css';

const MIN_PASSWORD = 10;

// B#133: letras (con tildes y ñ) y, entre palabras, un espacio, apóstrofo o guion.
const NAME = /^\p{L}+(?:[ '-]\p{L}+)*$/u;

// Lo mismo que exige el contrato, dicho antes de enviar: el servidor vuelve a validarlo.
function problemOf({
  name,
  password,
  accepted,
}: {
  name: string;
  password: string;
  accepted: boolean;
}) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40 || !NAME.test(trimmed)) {
    return 'Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.';
  }
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
  const [name, setName] = useState('');
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
    const found = problemOf({ name, password, accepted });
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
    <form className="form" onSubmit={submit}>
      <BackLink fallback="/yo" />
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
      <Field
        label="Tu nombre"
        autoComplete="given-name"
        maxLength={40}
        value={name}
        onValue={setName}
        aria-describedby="nombre-privado"
      />
      <p id="nombre-privado" className="muted">
        Solo tú lo ves. Nunca se publica.
      </p>
      <Field label="Correo" type="email" autoComplete="email" value={email} onValue={setEmail} />
      <Field
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD}
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
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>
      <p className="muted">
        ¿Ya tienes cuenta? <Link to={withReturn('/entrar', volver)}>Inicia sesión</Link>
      </p>
    </form>
  );
}
