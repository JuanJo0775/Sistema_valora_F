import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Las pruebas corren desde la raíz del repositorio.
const css = readFileSync(join(process.cwd(), 'src/shared/ui/tokens.css'), 'utf-8');

// #28 (WCAG 2.2 AA): el contraste de los colores del tema, en claro y en oscuro. axe no lo puede
// medir en jsdom (no pinta), así que se calcula aquí con la fórmula de WCAG sobre tokens.css.

// Las variables de un bloque: el primero es el tema claro (:root) y el de [data-theme='dark'], el
// oscuro (el mismo que se usa con prefers-color-scheme: dark).
function tokensOf(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map(([, name = '', value = '']) => [
      name,
      value,
    ]),
  );
}

const light = tokensOf(':root {');
const dark = tokensOf(":root[data-theme='dark']");

const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
};

// [primer plano, fondo, uso]. El texto pide 4,5:1 (1.4.3); los bordes de un control, 3:1 (1.4.11).
const TEXT: [string, string, string][] = [
  ['ink', 'bg', 'texto principal'],
  ['ink-2', 'bg', 'texto secundario'],
  ['ink-2', 'bg-2', 'texto secundario sobre gris'],
  ['ink-3', 'bg', 'rótulos en versalitas'],
  ['ink-3', 'bg-2', 'rótulos sobre gris («Últimos 30 días»)'],
  ['on-accent', 'accent', 'texto del botón naranja'],
  ['accent-ink', 'accent-soft', 'rótulo de la tarjeta naranja'],
  ['ok', 'ok-soft', 'píldora verde'],
  ['warn', 'warn-soft', 'píldora amarilla'],
  ['bad', 'bad-soft', 'píldora roja'],
  ['info', 'info-soft', 'píldora azul y cronómetro'],
];
const CONTROLS: [string, string, string][] = [
  ['accent', 'bg', 'borde del foco'],
  ['field-line', 'bg', 'borde de campos, contador y botones con borde'],
];

describe.each([
  ['claro', light],
  ['oscuro', dark],
])('contraste del tema %s', (_, tokens) => {
  it.each(TEXT)('el texto %s sobre %s (%s) tiene 4,5:1 o más', (fg, bg) => {
    expect(contrast(tokens[fg] ?? '', tokens[bg] ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CONTROLS)('%s sobre %s (%s) tiene 3:1 o más', (fg, bg) => {
    expect(contrast(tokens[fg] ?? '', tokens[bg] ?? '')).toBeGreaterThanOrEqual(3);
  });
});
