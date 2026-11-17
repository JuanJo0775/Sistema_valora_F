import { act, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { components } from '../../shared/api/schema';
import { AddToBasket } from './AddToBasket';
import { BasketProvider } from './BasketProvider';

const rice: components['schemas']['Product'] = {
  id: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  name: 'Arroz blanco',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [
    { id: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b', quantity: 500, unit: 'g', packCount: 1 },
    { id: '0b3f8d21-2c3e-4f40-9b0c-1d2e3f4a5b6c', quantity: 1, unit: 'kg', packCount: 1 },
  ],
};

let notify: (intersecting: boolean) => void = () => undefined;
const disconnect = vi.fn();

class FakeObserver {
  constructor(callback: IntersectionObserverCallback) {
    notify = (isIntersecting) => {
      callback([{ isIntersecting } as IntersectionObserverEntry], this as never);
    };
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = disconnect;
}

const renderAdd = () =>
  render(
    <BasketProvider>
      <MemoryRouter>
        <AddToBasket product={rice} lowestPrice="$ 4.500" />
      </MemoryRouter>
    </BasketProvider>,
  );

describe('barra de acción del detalle', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('no existe mientras el botón del panel se ve (sin duplicar la acción)', () => {
    renderAdd();
    act(() => {
      notify(true);
    });
    expect(screen.queryByRole('region', { name: 'Compra rápida' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Agregar a la canasta' })).toHaveLength(1);
  });

  it('aparece cuando el botón del panel sale de la pantalla, con la presentación y el precio', () => {
    renderAdd();
    act(() => {
      notify(false);
    });
    const bar = screen.getByRole('region', { name: 'Compra rápida' });
    expect(bar).toHaveTextContent('500 g');
    expect(bar).toHaveTextContent('$ 4.500');
  });

  it('usa la presentación elegida y agrega esa', () => {
    renderAdd();
    fireEvent.click(screen.getByRole('radio', { name: '1 kg' }));
    act(() => {
      notify(false);
    });
    const bar = screen.getByRole('region', { name: 'Compra rápida' });
    expect(bar).toHaveTextContent('1 kg');
    fireEvent.click(bar.querySelector('button') as HTMLButtonElement);
    expect(localStorage.getItem('valora:canasta')).toContain('1 kg');
  });

  it('sin IntersectionObserver no hay barra', () => {
    vi.unstubAllGlobals();
    renderAdd();
    expect(screen.queryByRole('region', { name: 'Compra rápida' })).not.toBeInTheDocument();
  });
});

describe('barra de acción: CSS', () => {
  const css = readFileSync(join(process.cwd(), 'src/features/basket/basket.css'), 'utf-8');
  const layout = readFileSync(join(process.cwd(), 'src/app/layout.css'), 'utf-8');
  const legal = readFileSync(join(process.cwd(), 'src/features/legal/legal.css'), 'utf-8');

  it('es fija sobre la barra de navegación y respeta la zona segura', () => {
    expect(css).toMatch(/\.action-bar\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.action-bar\s*\{[^}]*var\(--tabbar-h\)/);
    expect(css).toMatch(/\.action-bar\s*\{[^}]*safe-area-inset-bottom/);
  });

  it('desaparece desde 960 px', () => {
    const start = css.indexOf('@media (width >= 960px)');
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start)).toMatch(/\.action-bar\s*\{\s*display:\s*none/);
  });

  it('la página y el aviso de cookies cuentan su altura con una variable', () => {
    expect(layout).toMatch(/--action-bar-h/);
    expect(layout).toMatch(/\.page\s*\{[^}]*var\(--action-bar-h\)/);
    expect(legal).toMatch(/\.cookie-notice\s*\{[^}]*var\(--action-bar-h\)/);
    expect(layout).toMatch(/:root:has\(\.action-bar\)/);
  });
});
