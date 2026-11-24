import { useId, useRef, useState } from 'react';
import { api, call } from '../../shared/api';
import { dayInColombia } from '../../shared/days';
import { ErrorState } from '../../shared/ui/ErrorState';

const MIN_NOTE = 10;
const MAX_NOTE = 500;

// RF-013 RN4: un descarte se apela una sola vez y hasta appealableUntil (7 días, valor del backend).
// La decide un moderador distinto del que descartó; aquí no se dice quién (EC-08).
export function AppealForm({
  reportId,
  until,
  onAppealed,
}: {
  reportId: string;
  until: string;
  onAppealed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const problemId = useId();
  const noteBox = useRef<HTMLTextAreaElement>(null);

  const send = () => {
    if (note.trim().length < MIN_NOTE) {
      setProblem(`Cuéntanos un poco más: al menos ${String(MIN_NOTE)} letras.`);
      noteBox.current?.focus();
      return;
    }
    setProblem('');
    setError(null);
    setSending(true);
    call(
      api.POST('/reports/{reportId}/appeal', {
        params: { path: { reportId } },
        body: { note: note.trim() },
      }),
    )
      .then(onAppealed)
      .catch((failure: unknown) => {
        setError(failure);
        setSending(false);
      });
  };

  if (!open) {
    return (
      <p className="appeal">
        <span className="muted">{`Puedes apelar hasta el ${dayInColombia(until)}`}</span>{' '}
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setOpen(true);
          }}
        >
          Apelar
        </button>
      </p>
    );
  }
  return (
    <div className="appeal">
      <label className="field">
        ¿Por qué el precio era correcto?
        <textarea
          ref={noteBox}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? problemId : undefined}
          rows={3}
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
      {error !== null && <ErrorState error={error} />}
      <button type="button" className="btn" disabled={sending} onClick={send}>
        Enviar apelación
      </button>
    </div>
  );
}
