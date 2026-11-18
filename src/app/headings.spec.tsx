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
    ['/canasta', 'Tu canasta está vacía'],
    ['/yo', 'Tu cuenta'],
    ['/pendientes', 'No tienes reportes guardados en este teléfono'],
  ])('%s tiene el h1 «%s»', async (path, title) => {
    stubApi({ 'GET /v1/auth/session': NO_SESSION });
    window.history.pushState({}, '', path);
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });
});
