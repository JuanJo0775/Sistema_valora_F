import { vi } from 'vitest';

// jsdom no trae `matchMedia`: esto simula una ventana ancha (computador) o angosta, y deja cambiarla
// y avisar a quien escucha, como cuando se redimensiona la ventana. Se deshace con vi.unstubAllGlobals.
export function stubMatchMedia(matches: boolean) {
  const state = { matches };
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (media: string) => ({
    get matches() {
      return state.matches;
    },
    media,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return {
    listeners,
    set(next: boolean) {
      state.matches = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
  };
}
