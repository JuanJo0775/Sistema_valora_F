import { useEffect, useRef, useState } from 'react';

// ADR-043: consulta `load` al abrir y devuelve lo último que respondió el servidor. Cuando cambia
// `refreshSignal` consulta de inmediato, sin esperar al próximo intervalo.
export function usePolling<T>(
  load: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  enabled = true,
  refreshSignal = 0,
): T | undefined {
  const [value, setValue] = useState<T>();
  const loadRef = useRef(load);
  // La referencia se actualiza después de dibujar, no durante el render.
  useEffect(() => {
    loadRef.current = load;
  });

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
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      run();
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    // ADR-031: con la pestaña oculta no se consulta; al volver, se actualiza de inmediato.
    const onVisibility = () => {
      stop();
      if (document.visibilityState === 'visible') start();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      controller.abort();
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs, refreshSignal]);

  return enabled ? value : undefined;
}
