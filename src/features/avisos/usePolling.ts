import { useEffect, useRef, useState } from 'react';

// ADR-043: consulta `load` al abrir y devuelve lo último que respondió el servidor.
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  enabled = true,
): T | undefined {
  const [value, setValue] = useState<T>();
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    const run = () => {
      loadRef
        .current(controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setValue(data);
        })
        .catch(() => undefined);
    };
    run();
    return () => {
      controller.abort();
    };
  }, [enabled, intervalMs]);

  return enabled ? value : undefined;
}
