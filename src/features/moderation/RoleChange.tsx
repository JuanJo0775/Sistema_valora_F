import { type SyntheticEvent, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { Field } from '../auth/Field';
import { explainWith } from './explain';
import './moderation.css';

type Role = 'reportante' | 'moderador';

const ROLES: { value: Role; label: string }[] = [
  { value: 'reportante', label: 'Reportante' },
  { value: 'moderador', label: 'Moderador' },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_NOTE = 10;
const MAX_NOTE = 500;

const explained = explainWith({
  OWN_ROLE: 'No puedes cambiar tu propio rol: lo cambia otro moderador.',
  ROLE_UNCHANGED: 'Esa cuenta ya tiene ese rol.',
  404: 'Ninguna cuenta tiene ese correo.',
});

function explain(error: unknown): string {
  if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds) {
    const minutes = Math.ceil(error.retryAfterSeconds / 60);
    return `Hiciste muchos cambios seguidos. Inténtalo de nuevo en ${String(minutes)} ${minutes === 1 ? 'minuto' : 'minutos'}.`;
  }
  return (
    explained(error) ??
    (error instanceof ApiError ? error.message : 'Algo salió mal. Inténtalo de nuevo.')
  );
}

// #58 (RF-002): un moderador vuelve moderadora una cuenta reportante, o al revés. El cambio queda
// en una bitácora que no se puede modificar, con su motivo.
export function RoleChange() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState('');
  const [sending, setSending] = useState(false);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    setDone('');
    const wanted = email.trim();
    const found = !EMAIL.test(wanted)
      ? 'Escribe el correo de la cuenta.'
      : !role
        ? 'Elige el rol nuevo.'
        : note.trim().length < MIN_NOTE
          ? `Escribe el motivo: al menos ${String(MIN_NOTE)} letras.`
          : '';
    setProblem(found);
    if (found || !role) return;
    setSending(true);
    call(api.POST('/moderation/roles', { body: { email: wanted, role, note: note.trim() } }))
      .then(() => {
        setDone(`Listo: ${wanted} ahora es ${role}.`);
        setEmail('');
        setRole('');
        setNote('');
      })
      .catch((error: unknown) => {
        setProblem(explain(error));
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <form className="role-change" noValidate onSubmit={submit}>
      <p className="muted">
        El cambio se nota desde la siguiente acción de esa cuenta y queda anotado con su motivo.
      </p>
      <Field label="Correo de la cuenta" type="email" value={email} onValue={setEmail} />
      <fieldset role="radiogroup" className="choices">
        <legend>Rol nuevo</legend>
        {ROLES.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name="role"
              value={option.value}
              checked={role === option.value}
              onChange={() => {
                setRole(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="field">
        Motivo del cambio
        <textarea
          rows={2}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </label>
      {problem && (
        <p role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {done && (
        <p role="status" className="muted">
          {done}
        </p>
      )}
      <button type="submit" className="btn" disabled={sending}>
        Cambiar rol
      </button>
    </form>
  );
}
