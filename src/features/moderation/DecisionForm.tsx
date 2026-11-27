import { useId, useRef, useState } from 'react';
import { ErrorState } from '../../shared/ui/ErrorState';

const MIN_NOTE = 10;
const MAX_NOTE = 500;

// RF-013: toda decisión de moderación lleva su motivo (10 a 500 letras) y queda auditada.
export function DecisionForm<T extends string>({
  id,
  options,
  onDecide,
  explain,
}: {
  id: string;
  // hint: lo que hace la opción, visible y ligado al radio. confirm: la opción tiene una sanción y
  // se pide confirmar en línea antes de enviar.
  options: { value: T; label: string; hint?: string; confirm?: string }[];
  onDecide: (decision: T, note: string) => Promise<unknown>;
  // Mensajes propios para algunos rechazos del servidor; lo demás muestra el del servidor.
  explain?: (error: unknown) => string | null;
}) {
  const [decision, setDecision] = useState<T | ''>('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const problemId = useId();
  const hintId = useId();
  const sendButton = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLInputElement>(null);
  const noteBox = useRef<HTMLTextAreaElement>(null);

  const chosen = options.find((option) => option.value === decision);

  const submit = (value: T) => {
    setConfirming(false);
    setError(null);
    setSending(true);
    onDecide(value, note.trim()).catch((failure: unknown) => {
      setError(failure);
      setSending(false);
    });
  };

  const send = () => {
    const found = !decision
      ? 'Elige la decisión.'
      : note.trim().length < MIN_NOTE
        ? `Escribe el motivo: al menos ${String(MIN_NOTE)} letras.`
        : '';
    setProblem(found);
    if (found || !decision) {
      // El foco va al primer campo inválido: la decisión primero, luego el motivo.
      (decision ? noteBox : firstChoice).current?.focus();
      return;
    }
    if (chosen?.confirm) {
      setConfirming(true);
      return;
    }
    submit(decision);
  };

  const decisionInvalid = problem !== '' && !decision;
  const noteInvalid = problem !== '' && !!decision;
  const explained = error === null ? null : (explain?.(error) ?? null);
  return (
    <div className="decision stack">
      <fieldset
        role="radiogroup"
        className="choices"
        aria-invalid={decisionInvalid || undefined}
        aria-describedby={decisionInvalid ? problemId : undefined}
      >
        <legend>Decisión</legend>
        {options.map((option, index) => (
          <label key={option.value} className="choice">
            <input
              ref={index === 0 ? firstChoice : undefined}
              type="radio"
              name={`decision-${id}`}
              value={option.value}
              checked={decision === option.value}
              onChange={() => {
                setDecision(option.value);
                setProblem('');
                setConfirming(false);
              }}
              aria-describedby={option.hint ? `${hintId}-${option.value}` : undefined}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {options.map(
        (option) =>
          option.hint && (
            <p key={option.value} id={`${hintId}-${option.value}`} className="muted">
              {option.hint}
            </p>
          ),
      )}
      <label className="field">
        Motivo de la decisión
        <textarea
          ref={noteBox}
          aria-invalid={noteInvalid || undefined}
          aria-describedby={noteInvalid ? problemId : undefined}
          rows={2}
          maxLength={MAX_NOTE}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setProblem('');
            setConfirming(false);
          }}
        />
      </label>
      {problem && (
        <p id={problemId} role="alert" className="banner warn">
          {problem}
        </p>
      )}
      {explained ? (
        <p role="alert" className="banner warn">
          {explained}
        </p>
      ) : (
        error !== null && <ErrorState error={error} />
      )}
      {confirming && chosen?.confirm && decision && (
        <div className="banner warn" role="group" aria-label="Confirmar la decisión">
          <p>{chosen.confirm}</p>
          <div className="actions">
            <button
              type="button"
              className="btn"
              // Pedir la confirmación mueve el foco a ella: quien usa teclado no la pierde.
              autoFocus
              onClick={() => {
                submit(decision);
              }}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setConfirming(false);
                sendButton.current?.focus();
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      <button ref={sendButton} type="button" className="btn" disabled={sending} onClick={send}>
        Registrar decisión
      </button>
    </div>
  );
}
