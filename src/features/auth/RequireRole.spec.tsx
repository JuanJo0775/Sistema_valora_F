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
});
