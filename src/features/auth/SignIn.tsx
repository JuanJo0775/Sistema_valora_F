import { type SyntheticEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, call } from '../../shared/api';
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

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    void call(api.POST('/auth/login', { body: { email, password } })).then(() => {
      reload();
      void navigate(safeReturn(params.get('volver')), { replace: true });
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <h1>Iniciar sesión</h1>
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
      <button type="submit" className="btn">
        Entrar
      </button>
    </form>
  );
}

// Solo rutas de la misma app: un enlace «/entrar?volver=//otro.sitio» no saca a nadie de Valora.
function safeReturn(path: string | null): string {
  // El navegador lee «/\» igual que «//» (otro sitio).
  return path && /^\/(?![/\\])/.test(path) ? path : '/';
}
