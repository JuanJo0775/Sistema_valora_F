import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, call } from '../../shared/api';
import { NO_SESSION, sessionAs, stubApi, stubPendingApi } from '../../test/fakeApi';
import { RequireRole } from './RequireRole';
import { SessionProvider } from './SessionProvider';

// Una sección cualquiera que consulta la API con la sesión.
function MyReports() {
  return (
    <>
      <h1>Mis aportes</h1>
      <button
        type="button"
        onClick={() => {
          call(api.GET('/me/reports')).catch(() => undefined);
        }}
      >
        Actualizar
      </button>
    </>
  );
}

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
          <Route
            path="/mis-aportes"
            element={
              <RequireRole role="reportante" allowSuspended>
                <MyReports />
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
    stubApi({ 'GET /v1/auth/session': NO_SESSION });

    renderAt('/registrar?producto=abc');

    expect(
      await screen.findByText('Estás en /entrar?volver=%2Fregistrar%3Fproducto%3Dabc'),
    ).toBeInTheDocument();
  });

  it('con el rol pedido muestra la sección', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });

    renderAt('/registrar');

    expect(await screen.findByRole('heading', { name: 'Registrar precio' })).toBeInTheDocument();
  });

  it('con otro rol dice para quién es la sección y no la muestra', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('comercio') });

    renderAt('/registrar');

    expect(
      await screen.findByRole('heading', { name: 'Esta sección es para cuentas de reportante' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Registrar precio' })).not.toBeInTheDocument();
  });

  it('mientras pregunta por la sesión dice «Cargando…» y no muestra la sección', () => {
    stubPendingApi();

    renderAt('/registrar');

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.queryByRole('heading', { name: 'Registrar precio' })).not.toBeInTheDocument();
  });

  it('sin red no da la sesión por cerrada: muestra el error y permite reintentar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    renderAt('/registrar');

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con Valora');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Registrar precio' })).not.toBeInTheDocument();
  });

  it('una cuenta suspendida no puede registrar y ve hasta cuándo', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante', '2026-11-20T17:00:00Z') });

    renderAt('/registrar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu cuenta está suspendida hasta el 20 de noviembre de 2026.',
    );
    expect(screen.queryByRole('heading', { name: 'Registrar precio' })).not.toBeInTheDocument();
  });

  it('una cuenta suspendida sí ve sus aportes, para poder apelar', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante', '2026-11-20T17:00:00Z') });

    renderAt('/mis-aportes');

    expect(await screen.findByRole('heading', { name: 'Mis aportes' })).toBeInTheDocument();
  });

  it('si la sesión vence mientras la usa, lleva a entrar y recuerda dónde estaba', async () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('reportante'),
      'GET /v1/me/reports': NO_SESSION,
    });
    renderAt('/mis-aportes');

    fireEvent.click(await screen.findByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByText('Estás en /entrar?volver=%2Fmis-aportes')).toBeInTheDocument();
  });
});
