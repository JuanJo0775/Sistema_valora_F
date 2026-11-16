import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { RequireRole } from './RequireRole';
import { SessionProvider } from './SessionProvider';

const unauthorized = {
  status: 401,
  body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' },
};
const sessionOf = (role: string, suspendedUntil?: string) => ({
  status: 200,
  body: { role, csrfToken: 'token-1', suspendedUntil },
});

function WhereAmI() {
  const { pathname, search } = useLocation();
  return <p>Estás en {pathname + search}</p>;
}

const renderAt = (path: string) =>
  render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/registrar"
            element={
              <RequireRole role="reportante">
                <h1>Registrar precio</h1>
              </RequireRole>
            }
          />
          <Route path="/entrar" element={<WhereAmI />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );

describe('secciones con sesión', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin sesión lleva a iniciar sesión y recuerda a dónde volver', async () => {
    stubApi({ 'GET /v1/auth/session': unauthorized });

    renderAt('/registrar?producto=abc');

    expect(
      await screen.findByText('Estás en /entrar?volver=%2Fregistrar%3Fproducto%3Dabc'),
    ).toBeInTheDocument();
  });

  it('con el rol pedido muestra la sección', async () => {
    stubApi({ 'GET /v1/auth/session': sessionOf('reportante') });

    renderAt('/registrar');

    expect(await screen.findByRole('heading', { name: 'Registrar precio' })).toBeInTheDocument();
  });

  it('con otro rol dice para quién es la sección y no la muestra', async () => {
    stubApi({ 'GET /v1/auth/session': sessionOf('comercio') });

    renderAt('/registrar');

    expect(
      await screen.findByRole('heading', { name: 'Esta sección es para cuentas de reportante' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Registrar precio' })).not.toBeInTheDocument();
  });

  it('mientras pregunta por la sesión dice «Cargando…» y no muestra la sección', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    renderAt('/registrar');

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('heading', { name: 'Registrar precio' })).not.toBeInTheDocument();
  });
});
