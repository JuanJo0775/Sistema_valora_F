import { type SyntheticEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import { safeReturn } from './safeReturn';
import { useSession } from './session';
import './auth.css';

// Versión vigente de la política de datos (contrato: provisional hasta tener el texto).
const POLICY_VERSION = '2026-11';

// RF-001: toda cuenta nueva es reportante. El registro no inicia sesión: se entra justo después.
export function SignUp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { reload } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    void call(
      api.POST('/auth/register', {
        body: { email, password, acceptedPolicyVersion: POLICY_VERSION },
      }),
    )
      .then(() => call(api.POST('/auth/login', { body: { email, password } })))
      .then(() => {
        reload();
        void navigate(safeReturn(params.get('volver')), { replace: true });
      });
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>Crear cuenta</h1>
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
          minLength={10}
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
      <button type="submit" className="btn">
        Crear cuenta
      </button>
    </form>
  );
}
