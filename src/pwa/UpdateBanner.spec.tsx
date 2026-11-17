import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from './UpdateBanner';

const updateServiceWorker = vi.fn(() => Promise.resolve());
let needRefresh = true;

// El registro del service worker lo da vite-plugin-pwa; aquí se simula su respuesta.
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

describe('aviso de versión nueva', () => {
  it('con una versión nueva lo dice y «Actualizar» la instala', () => {
    needRefresh = true;
    render(<UpdateBanner />);

    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva de Valora');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('sin versión nueva no muestra nada', () => {
    needRefresh = false;
    const { container } = render(<UpdateBanner />);

    expect(container).toBeEmptyDOMElement();
  });
});
