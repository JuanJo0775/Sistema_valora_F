import { useEffect, useRef } from 'react';
import { ApiError } from '../api';
import { useOnline } from './offline';
import { OfflineMessage } from './OfflineMessage';

const isNetworkError = (error: unknown) => error instanceof ApiError && error.status === 0;

// Los mensajes de la API ya están en español para el usuario; un error del código no se muestra tal cual.
// H-08: sin red el navegador, un solo mensaje y «Reintentar» no sale (no puede funcionar): la
// pantalla se vuelve a pedir sola cuando vuelve la conexión.
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const online = useOnline();
  const offline = !online && isNetworkError(error);
  const retry = useRef(onRetry);
  useEffect(() => {
    retry.current = onRetry;
  }, [onRetry]);
  useEffect(() => {
    if (!offline) return;
    const again = () => {
      retry.current?.();
    };
    window.addEventListener('online', again, { once: true });
    return () => {
      window.removeEventListener('online', again);
    };
  }, [offline]);

  if (offline) {
    return (
      <div className="state">
        <OfflineMessage>
          Sin conexión: esta pantalla necesita internet.
          {onRetry && ' Se actualizará sola cuando vuelva la señal.'}
        </OfflineMessage>
      </div>
    );
  }
  const message = error instanceof ApiError ? error.message : 'Algo salió mal. Inténtalo de nuevo.';
  return (
    <div className="state" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn ghost" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
