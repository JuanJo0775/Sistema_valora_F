import { type SyntheticEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';
import { useSession } from './session';
import './auth.css';

// La contraseña vive solo en el estado del formulario y viaja en el cuerpo de la petición: nunca en
// la dirección, en localStorage ni en IndexedDB (OFFLINE_FIRST.md).
export function SignIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { reload } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setError(null);
    setSending(true);
    call(api.POST('/auth/login', { body: { email, password } }))
      .then(() => {
        reload();
        void navigate(safeReturn(params.get('volver')), { replace: true });
      })
      .catch((failure: unknown) => {
        setError(failure);
        setSending(false);
      });
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>Iniciar sesión</h1>
      {/* 401, 429 y sin red: el servidor y el cliente ya traen el mensaje en español. */}
      {error !== null && <ErrorState error={error} />}
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
        />
      </label>
      <button type="submit" className="btn" disabled={sending}>
        {sending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

// Solo rutas de la misma app: un enlace «/entrar?volver=//otro.sitio» no saca a nadie de Valora.
function safeReturn(path: string | null): string {
  // El navegador lee «/\» igual que «//» (otro sitio).
  return path && /^\/(?![/\\])/.test(path) ? path : '/';
}
