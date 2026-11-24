import { type SyntheticEvent, useEffect, useState } from 'react';
import { api, call } from '../../shared/api';
import { ErrorState } from '../../shared/ui/ErrorState';
import { useSession } from '../auth/session';

export function MerchantReport({ establishmentId }: { establishmentId: string }) {
  const { session } = useSession();
  const enabled =
    session.status === 'active' &&
    !session.suspendedUntil &&
    (session.role === 'reportante' || session.role === 'comercio');
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    call(
      api.GET('/establishments/{establishmentId}/merchant-reports', {
        params: { path: { establishmentId } },
        signal: controller.signal,
      }),
    )
      .then(({ canReport }) => {
        if (!controller.signal.aborted) setAvailable(canReport);
      })
      .catch(() => {
        // Una ficha pública sigue disponible aunque falle esta consulta privada.
      });
    return () => {
      controller.abort();
    };
  }, [enabled, establishmentId]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reason.trim().length < 10) return;
    setBusy(true);
    setError(null);
    try {
      await call(
        api.POST('/establishments/{establishmentId}/merchant-reports', {
          params: { path: { establishmentId } },
          body: { reason: reason.trim() },
        }),
      );
      setSent(true);
    } catch (failure: unknown) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled || !available) return null;
  if (sent) return <p role="status">Denuncia recibida. Un moderador revisará el caso.</p>;
  if (!open)
    return (
      <button
        type="button"
        className="link-button"
        onClick={() => {
          setOpen(true);
        }}
      >
        ¿Este comercio no es de quien dice?
      </button>
    );
  return (
    <form
      className="merchant-report"
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <label className="field">
        Motivo de la denuncia
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          minLength={10}
          maxLength={500}
          rows={3}
          required
          disabled={busy}
          aria-describedby="merchant-report-hint"
        />
      </label>
      <p id="merchant-report-hint" className="muted">
        {reason.trim().length < 10
          ? 'Cuenta qué pasa, con al menos 10 letras, para poder enviar la denuncia.'
          : 'Un moderador revisará lo que escribas.'}
      </p>
      {error !== null && <ErrorState error={error} />}
      <div className="actions">
        <button type="submit" className="btn" disabled={busy || reason.trim().length < 10}>
          Enviar denuncia
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
