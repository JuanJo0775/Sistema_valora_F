import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { Profile } from './Profile';
import { SessionProvider } from './SessionProvider';

const unauthorized = {
  status: 401,
  body: { code: 'UNAUTHORIZED', message: 'Se requiere sesión.' },
};

const renderProfile = () =>
  render(
    <SessionProvider>
      <MemoryRouter>
        <Profile />
      </MemoryRouter>
    </SessionProvider>,
  );

describe('pestaña Yo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin sesión invita a iniciar sesión o a crear una cuenta', async () => {
    stubApi({ 'GET /v1/auth/session': unauthorized });

    renderProfile();

    expect(await screen.findByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/entrar',
    );
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/crear-cuenta',
    );
  });

  it('con sesión dice con qué rol entraste', async () => {
    stubApi({
      'GET /v1/auth/session': { status: 200, body: { role: 'reportante', csrfToken: 'token-1' } },
    });

    renderProfile();

    expect(await screen.findByText('Entraste como reportante.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
  });
});
