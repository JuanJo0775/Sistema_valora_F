import { ApiError } from '../api';

// Los mensajes de la API ya están en español para el usuario; un error del código no se muestra tal cual.
export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof ApiError ? error.message : 'Algo salió mal. Inténtalo de nuevo.';
  return (
    <div className="state" role="alert">
      <p>{message}</p>
    </div>
  );
}
