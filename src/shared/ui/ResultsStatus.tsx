// Anuncia a los lectores de pantalla cuántos resultados dio una búsqueda (WCAG 4.1.3). La región
// vive siempre en la página, vacía, para que el cambio de texto se anuncie. `count` en `null` es
// «aún no se buscó»; con `silentWhenEmpty`, el cero no se anuncia aquí porque otro aviso ya lo dice.
export function ResultsStatus({
  count,
  silentWhenEmpty = false,
}: {
  count: number | null;
  silentWhenEmpty?: boolean;
}) {
  const text =
    count === null || (count === 0 && silentWhenEmpty)
      ? ''
      : count === 0
        ? 'No encontramos resultados.'
        : count === 1
          ? '1 resultado'
          : `${String(count)} resultados`;
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {text}
    </p>
  );
}
