import { useSyncExternalStore } from 'react';

// Computador: desde 960 px, el mismo punto de corte de `.with-side` en base.css.
const WIDE = '(width >= 960px)';

const query = () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE) : null);

function subscribe(onChange: () => void) {
  const media = query();
  media?.addEventListener('change', onChange);
  return () => {
    media?.removeEventListener('change', onChange);
  };
}

// ¿La ventana es de computador? Sin `matchMedia` (jsdom) siempre es falso: la pantalla angosta.
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false,
  );
}
