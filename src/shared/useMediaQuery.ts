import { useSyncExternalStore } from 'react';

// Si la ventana cumple una consulta de CSS (por ejemplo `(width < 960px)`) y sigue sus cambios. Sin
// `matchMedia` (pruebas, navegadores viejos) vale false: se ve la versión de computador.
export function useMediaQuery(query: string): boolean {
  const subscribe = (notify: () => void) => {
    if (typeof window.matchMedia !== 'function') return () => undefined;
    const list = window.matchMedia(query);
    list.addEventListener('change', notify);
    return () => {
      list.removeEventListener('change', notify);
    };
  };
  const now = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, now, () => false);
}
