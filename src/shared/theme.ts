import { readStored, writeStored } from './storage';

// Tema de la app: seguir al sistema (por defecto), claro u oscuro. Los colores de cada tema están en
// shared/ui/tokens.css: sin elección, el navegador decide con prefers-color-scheme; con elección, el
// atributo data-theme de <html> la impone.
export type Theme = 'system' | 'light' | 'dark';

const KEY = 'valora:tema';

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export function getTheme(): Theme {
  const stored = readStored(KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function apply(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme) {
  writeStored(KEY, theme === 'system' ? null : theme);
  apply(theme);
}

// Se llama al arrancar, antes de pintar, para que no parpadee el otro tema.
export function applyStoredTheme() {
  apply(getTheme());
}
