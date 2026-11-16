import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiStatus } from './ApiStatus';

// El fetch del navegador es la frontera con el backend: se reemplaza solo aquí.
const respondWith = (status: number, body: unknown) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
};

describe('estado de la API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dice «API conectada» cuando el backend responde que está bien', async () => {
    respondWith(200, { status: 'ok' });

    render(<ApiStatus />);

    expect(await screen.findByText('API conectada')).toBeInTheDocument();
  });
});
