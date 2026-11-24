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
              <RequireRole role="reportante" allowOffline>
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
          <Route
            path="/portal"
            element={
              <RequireRole role="comercio">
                <h1>Portal</h1>
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
    localStorage.clear();
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
    // Nadie se queda sin salida: la pantalla ofrece a dónde ir.
    expect(screen.getByRole('link', { name: 'Volver a Yo' })).toHaveAttribute('href', '/yo');
  });

  it('a un reportante que abre el portal de comercios le ofrece registrar su tienda', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });

    renderAt('/portal');

    expect(
      await screen.findByRole('heading', { name: 'Esta sección es para cuentas de comercio' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar mi tienda' })).toHaveAttribute(
      'href',
      '/comercios/registro',
    );
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

  it('una cuenta suspendida ve por qué y tiene un enlace a sus aportes', async () => {
    stubApi({
      'GET /v1/auth/session': {
        status: 200,
        body: {
          role: 'reportante',
          csrfToken: 'token-1',
          suspendedUntil: '2026-12-01T17:00:00Z',
          suspension: { reason: 'observada_por_moderacion' },
          emailVerified: true,
          emailVerificationRequired: true,
          hasPassword: true,
        },
      },
    });

    renderAt('/registrar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Moderación observó tu cuenta por un reporte de precio.',
    );
    expect(screen.getByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute(
      'href',
      '/mis-aportes',
    );
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

  // #26: registrar sin señal. Sin red no se sabe si la sesión sigue; si la última vez entró como
  // reportante, puede guardar el reporte en el teléfono. El servidor lo verifica al sincronizar.
  const offline = () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
  };

  it('sin red, quien entró como reportante la última vez puede registrar en el teléfono', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    const before = renderAt('/registrar');
    await screen.findByRole('heading', { name: 'Registrar precio' });
    before.unmount();
    offline();

    renderAt('/registrar');

    expect(await screen.findByRole('heading', { name: 'Registrar precio' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin conexión: tu reporte se guardará en el teléfono y se enviará solo.',
    );
  });

  it('sin red, si cerró sesión no recuerda el rol y muestra el error', async () => {
    stubApi({ 'GET /v1/auth/session': sessionAs('reportante') });
    const before = renderAt('/registrar');
    await screen.findByRole('heading', { name: 'Registrar precio' });
    before.unmount();
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    const signedOut = renderAt('/registrar');
    await screen.findByText(/Estás en \/entrar/);
    signedOut.unmount();
    offline();

    renderAt('/registrar');

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con Valora');
  });
});
