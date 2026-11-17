import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { seriousViolations } from './axe';

// La revisión de accesibilidad sí encuentra fallas: si no, las pruebas de #28 pasarían siempre.
describe('revisión de accesibilidad con axe', () => {
  it('encuentra un botón sin nombre y un campo sin etiqueta', async () => {
    const { container } = render(
      <main>
        <button type="button" />
        <input type="text" />
      </main>,
    );

    const found = await seriousViolations(container);

    expect(found.some((line) => line.startsWith('button-name'))).toBe(true);
    expect(found.some((line) => line.startsWith('label'))).toBe(true);
  });

  it('una pantalla bien etiquetada no tiene fallas graves', async () => {
    const { container } = render(
      <main>
        <label>
          Precio
          <input type="text" />
        </label>
        <button type="button">Enviar</button>
      </main>,
    );

    expect(await seriousViolations(container)).toEqual([]);
  });
});
