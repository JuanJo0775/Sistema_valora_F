import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, stubApi } from '../../test/fakeApi';
import { SessionProvider } from './SessionProvider';
import { Welcome } from './Welcome';

const renderWelcome = () =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={['/bienvenida']}>
        <Routes>
          <Route path="/" element={<h1>Inicio</h1>} />
          <Route path="/bienvenida" element={<Welcome />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

const writeName = (name: string) => {
  fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: name } });
};
const create = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));
};

// RF-001 y grill de la #178, pregunta 2 (F#154): quien entró con Google y no tenía cuenta llega aquí.
// Pulsar el botón de Google no es aceptar la política: se acepta en esta página.
describe('bienvenida de quien entró con Google', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin aceptar la política no crea la cuenta y dice por qué', async () => {
    const api = stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderWelcome();

    writeName('Ana María');
    create();

    expect(
      await screen.findByText(
        'Para crear la cuenta debes aceptar la política de tratamiento de datos.',
      ),
    ).toBeInTheDocument();
    expect(api.calls.some(({ path }) => path === '/v1/auth/google/complete')).toBe(false);
  });

  it('con un nombre que no son letras no crea la cuenta', async () => {
    const api = stubApi({ 'GET /v1/auth/session': NO_SESSION });
    renderWelcome();

    writeName('x');
    fireEvent.click(screen.getByRole('checkbox'));
    create();

    expect(
      await screen.findByText('Escribe tu nombre: de 2 a 40 letras, sin números ni símbolos.'),
    ).toBeInTheDocument();
    expect(api.calls.some(({ path }) => path === '/v1/auth/google/complete')).toBe(false);
  });
});
