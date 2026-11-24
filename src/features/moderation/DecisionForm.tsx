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
  options: { value: T; label: string }[];
  onDecide: (decision: T, note: string) => Promise<unknown>;
  // Mensajes propios para algunos rechazos del servidor; lo demás muestra el del servidor.
  explain?: (error: unknown) => string | null;
}) {
  const [decision, setDecision] = useState<T | ''>('');
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const problemId = useId();
  const firstChoice = useRef<HTMLInputElement>(null);
  const noteBox = useRef<HTMLTextAreaElement>(null);

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
    setError(null);
    setSending(true);
    onDecide(decision, note.trim()).catch((failure: unknown) => {
      setError(failure);
      setSending(false);
    });
  };

  const decisionInvalid = problem !== '' && !decision;
  const noteInvalid = problem !== '' && !!decision;
  const explained = error === null ? null : (explain?.(error) ?? null);
  return (
    <div className="decision">
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
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
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
      <button type="button" className="btn" disabled={sending} onClick={send}>
        Registrar decisión
      </button>
    </div>
  );
}
