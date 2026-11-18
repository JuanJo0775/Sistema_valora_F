import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { UpdateBanner } from './UpdateBanner';

const layoutCss = readFileSync(join(process.cwd(), 'src/app/layout.css'), 'utf-8');
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

    expect(screen.getByRole('status')).toHaveTextContent('Hay una versión nueva');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('sin versión nueva no muestra nada', () => {
    needRefresh = false;
    const { container } = render(<UpdateBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('es un aviso de estado que no queda bajo la barra inferior', () => {
    needRefresh = true;
    render(<UpdateBanner />);

    expect(screen.getByRole('status')).toHaveClass('update-banner');
    const rule = /\.update-banner\s*\{[^}]*\}/.exec(layoutCss)?.[0] ?? '';
    expect(rule).not.toMatch(/position:\s*(fixed|sticky)/);
    expect(rule).toMatch(/justify-content:\s*space-between/);
  });
});
