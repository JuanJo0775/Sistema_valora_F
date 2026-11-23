import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_SESSION, stubApi } from '../test/fakeApi';
import { App } from './App';

vi.mock('../features/stores/StoreMap', () => ({ StoreMap: () => null }));

// H-15: toda pantalla tiene un h1, también sus estados vacíos.
describe('un h1 en los estados vacíos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
    localStorage.clear();
  });

  it.each([
    // Con las pestañas «Mi lista | Guardadas» la canasta vacía conserva su h1 «Mi canasta» (para ver
    // «Guardadas» sin productos); el aviso «Tu canasta está vacía» pasa a h2 (prueba de abajo).
    ['/canasta', 'Mi canasta'],
    ['/yo', 'Tu cuenta'],
    ['/pendientes', 'No tienes reportes guardados en este teléfono'],
  ])('%s tiene el h1 «%s»', async (path, title) => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    window.history.pushState({}, '', path);
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('/canasta vacía dice «Tu canasta está vacía» como h2 y mantiene un solo h1', async () => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    window.history.pushState({}, '', '/canasta');
    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Tu canasta está vacía' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
