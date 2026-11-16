import { ApiError } from '../api';

// Los mensajes de la API ya están en español para el usuario; un error del código no se muestra tal cual.
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
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
