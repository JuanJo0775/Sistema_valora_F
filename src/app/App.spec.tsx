import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('inicio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra el nombre de la app y si la API está conectada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok' })))),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Valora' })).toBeInTheDocument();
    expect(await screen.findByText('API conectada')).toBeInTheDocument();
  });
});
