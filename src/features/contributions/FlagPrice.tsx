import { useState } from 'react';
import { api, call } from '../../shared/api';
import type { paths } from '../../shared/api/schema';
import { ErrorState } from '../../shared/ui/ErrorState';
import { useSession } from '../auth/session';

type Reason = NonNullable<
  paths['/reports/{reportId}/flag']['post']['requestBody']
>['content']['application/json']['reason'];

const REASONS: { value: Reason; label: string }[] = [
  { value: 'precio_falso', label: 'El precio es falso' },
  { value: 'producto_equivocado', label: 'No es este producto' },
  { value: 'establecimiento_equivocado', label: 'No es esta tienda' },
  { value: 'otro', label: 'Otro motivo' },
];

// RF-013 RN1: un reportante marca un precio como dudoso, una vez por reporte. Va a la cola de
// moderación; quién marcó no se muestra a nadie (EC-08).
export function FlagPrice({ reportId, storeName }: { reportId: string; storeName: string }) {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | ''>('');
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<unknown>(null);

  if (session.status !== 'active' || session.role !== 'reportante') return null;
  if (sent) {
    return (
      <p role="status" className="muted">
        Gracias: lo revisará un moderador.
      </p>
    );
  }
  if (!open) {
    return (
      <button
        type="button"
        className="link-button"
        onClick={() => {
          setOpen(true);
        }}
      >
        ¿Este precio está mal?
      </button>
    );
  }

  const send = () => {
    if (!reason) return;
    setError(null);
    const note = comment.trim();
    call(
      api.POST('/reports/{reportId}/flag', {
        params: { path: { reportId } },
        body: { reason, ...(note ? { comment: note } : {}) },
      }),
    )
      .then(() => {
        setSent(true);
      })
      .catch((failure: unknown) => {
        setError(failure);
      });
  };

  return (
    <div className="flag">
      <fieldset role="radiogroup" className="choices">
        <legend>{`¿Qué está mal en el precio de ${storeName}?`}</legend>
        {REASONS.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name={`flag-${reportId}`}
              value={option.value}
              checked={reason === option.value}
              onChange={() => {
                setReason(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="field">
        Comentario (opcional)
        <textarea
          rows={2}
          maxLength={280}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
          }}
        />
      </label>
      {error !== null && <ErrorState error={error} />}
      <button type="button" className="btn" disabled={!reason} onClick={send}>
        Enviar
      </button>
    </div>
  );
}
