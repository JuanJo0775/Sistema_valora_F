import { type SyntheticEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';
import { POLICY_VERSION } from '../legal/policy';
import { Field } from './Field';
import { nameProblem, POLICY_REQUIRED, useFocusFirstInvalid } from './formErrors';
import { useSession } from './session';
import './auth.css';

type Problems = { name?: string; accepted?: string };

// RF-001 y grill de la #178, pregunta 2 (F#154): quien entró con Google y no tenía cuenta llega aquí
// desde el servidor. El correo no se muestra ni se pide: va en una cookie firmada que la página no lee
// (EC-08). Pulsar el botón de Google no es aceptar la política: se acepta aquí.
export function Welcome() {
  const [name, setName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [problems, setProblems] = useState<Problems>({});
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const { reload } = useSession();
  useFocusFirstInvalid(formRef, attempt);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const found: Problems = {
      name: nameProblem(name) || undefined,
      accepted: accepted ? undefined : POLICY_REQUIRED,
    };
    setProblems(found);
    if (found.name || found.accepted) {
      setAttempt((n) => n + 1);
      return;
    }
    setError(null);
    setSending(true);
    // El correo no viaja en el cuerpo: el servidor lo toma de la cookie firmada que dejó Google.
    call(
      api.POST('/auth/google/complete', {
        body: { displayName: name.trim(), acceptedPolicyVersion: POLICY_VERSION },
      }),
    )
      .then(() => {
        // La sesión ya quedó abierta en la cookie: se vuelve a leer para saludar y mostrar el rol.
        reload();
        void navigate('/', { replace: true });
      })
      .catch((failure: unknown) => {
        setError(failure);
        setSending(false);
      });
  };

  return (
    <form className="form" onSubmit={submit} noValidate ref={formRef}>
      <h1>Te damos la bienvenida a Valora</h1>
      <p>
        Entraste con Google. Para terminar, dinos cómo te llamamos y acepta la política de datos.
      </p>
      {error !== null && <ErrorState error={error} />}
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
      <p className="muted">
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
        <p id="error-politica" className="field-error" role="alert">
          {problems.accepted}
        </p>
      )}
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Creando cuenta…' : 'Crear mi cuenta'}
      </button>
    </form>
  );
}
