import { useState } from 'react';
import { api, ApiError, call } from '../../shared/api';
import type { components } from '../../shared/api/schema';
import './moderation.css';

type Image = NonNullable<components['schemas']['Product']['image']>;

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TOO_BIG = 'La foto pesa más de 2 MB. Elige una más liviana.';

// Antes de subir: el mismo límite del servidor, para no esperar un rechazo.
const problemWith = (file: File) =>
  !TYPES.includes(file.type)
    ? 'Usa una foto JPEG, PNG o WebP.'
    : file.size > MAX_BYTES
      ? TOO_BIG
      : '';

// #58 (RF-002, ADR-020): un moderador cambia la foto de un producto. El servidor la reduce, la
// guarda en WebP y le quita los metadatos, incluida la ubicación (EC-08).
export function ChangeProductPhoto({
  productId,
  onChanged,
}: {
  productId: string;
  onChanged: (image: Image) => void;
}) {
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  const upload = (file: File) => {
    setDone(false);
    const found = problemWith(file);
    setProblem(found);
    if (found) return;
    setSending(true);
    call(
      api.PUT('/moderation/products/{productId}/image', {
        params: { path: { productId } },
        body: { file: '' },
        bodySerializer: () => {
          const form = new FormData();
          form.append('file', file);
          return form;
        },
      }),
    )
      .then((image) => {
        onChanged(image);
        setDone(true);
      })
      .catch((error: unknown) => {
        setProblem(
          error instanceof ApiError && error.status === 413
            ? TOO_BIG
            : error instanceof ApiError
              ? error.message
              : 'Algo salió mal. Inténtalo de nuevo.',
        );
      })
      .finally(() => {
        setSending(false);
      });
  };

  return (
    <div className="change-photo">
      <label className="btn ghost">
        {sending ? 'Subiendo…' : 'Cambiar foto'}
        <input
          type="file"
          accept={TYPES.join(',')}
          aria-label="Cambiar foto"
          disabled={sending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = '';
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
          Foto actualizada.
        </p>
      )}
    </div>
  );
}
