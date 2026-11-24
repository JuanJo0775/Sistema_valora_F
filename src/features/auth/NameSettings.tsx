import { type KeyboardEvent, type SyntheticEvent, useEffect, useRef, useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import { NameField } from './AccountConsent';
import { NAME_PROBLEM, nameProblem, useFocusFirstInvalid, waitText } from './formErrors';
import { useSession } from './session';

// Un nombre que el servidor rechaza (400 VALIDATION_ERROR, como en el registro) se dice junto al campo,
// con el mismo texto del cliente (el del servidor lleva el nombre técnico del campo); el resto, arriba.
function failureText(error: unknown): { field: boolean; text: string } {
  if (error instanceof ApiError) {
    if (error.status === 400) return { field: true, text: NAME_PROBLEM };
    if (error.status === 429) {
      return {
        field: false,
        text: `Cambiaste tu nombre demasiadas veces. ${waitText(error.retryAfterSeconds)}`,
      };
    }
    return { field: false, text: error.message };
  }
  return { field: false, text: 'Algo salió mal. Inténtalo de nuevo.' };
}

// Ajustes › Cuenta › Nombre. La fila muestra el nombre y el botón abre el formulario en el lugar; las
// reglas del nombre son las del registro (nameProblem), el servidor las vuelve a validar.
export function NameSettings() {
  const { session, nameChanged } = useSession();
  const current = session.status === 'active' ? (session.displayName ?? '') : '';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useFocusFirstInvalid(formRef, attempt);

  // El foco va al campo al abrir y de vuelta al botón al cerrar.
  useEffect(() => {
    if (editing) formRef.current?.querySelector('input')?.focus();
    else if (wasEditing.current) openRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const open = () => {
    setName(current);
    setProblem(undefined);
    setFailure(null);
    setDone('');
    setEditing(true);
  };

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (sending) return;
    const found = nameProblem(name) || undefined;
    setProblem(found);
    setFailure(null);
    if (found) {
      setAttempt((n) => n + 1);
      return;
    }
    setSending(true);
    call(api.PATCH('/me/profile', { body: { displayName: name.trim() } }))
      .then(({ displayName }) => {
        nameChanged(displayName);
        setDone(`Listo: tu nombre ahora es ${displayName}.`);
        setEditing(false);
        setSending(false);
      })
      .catch((error: unknown) => {
        const { field, text } = failureText(error);
        if (field) setProblem(text);
        else setFailure(text);
        setAttempt((n) => n + 1);
        setSending(false);
      });
  };

  const cancel = () => {
    if (sending) return;
    setEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') cancel();
  };

  return (
    <div>
      {editing ? (
        <form
          className="name-form"
          onSubmit={submit}
          onKeyDown={onKeyDown}
          noValidate
          ref={formRef}
        >
          <h3 className="password-title">Nombre</h3>
          {failure && (
            <p role="alert" className="banner warn">
              {failure}
            </p>
          )}
          <NameField
            value={name}
            onValue={(value) => {
              setName(value);
              setProblem(undefined);
            }}
            error={problem}
          />
          <div className="actions">
            <button type="submit" className="btn" disabled={sending}>
              {sending ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="btn ghost" onClick={cancel}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="name-row">
          <span className="settings-text">
            <strong>Nombre</strong>
            <span className="muted">{current || 'Aún no tienes un nombre.'}</span>
          </span>
          <button type="button" className="btn ghost" onClick={open} ref={openRef}>
            {current ? 'Cambiar nombre' : 'Agregar nombre'}
          </button>
        </div>
      )}
      {done && (
        <p role="status" className="banner name-status">
          {done}
        </p>
      )}
    </div>
  );
}
