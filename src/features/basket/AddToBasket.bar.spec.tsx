import { fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubMatchMedia } from '../../test/matchMedia';
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

const renderAdd = () =>
  render(
    <BasketProvider>
      <MemoryRouter>
        <AddToBasket product={rice} lowestPrice="$ 4.500" />
      </MemoryRouter>
    </BasketProvider>,
  );

describe('barra de acción del detalle', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('en computador no hay barra: el botón del panel es la acción', () => {
    stubMatchMedia(false);
    renderAdd();
    expect(screen.queryByRole('region', { name: 'Compra rápida' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Agregar a la canasta/ })).toHaveLength(1);
    expect(screen.getByText('Se agrega 500 g')).toBeInTheDocument();
  });

  it('en celular hay un solo botón de agregar: el de la barra; el del panel no existe', () => {
    stubMatchMedia(true);
    renderAdd();
    const bar = screen.getByRole('region', { name: 'Compra rápida' });
    expect(bar).toHaveTextContent('500 g');
    expect(bar).toHaveTextContent('$ 4.500');
    // Un solo botón en todo el documento: sin foco doble ni lectura doble.
    const buttons = screen.getAllByRole('button', { name: /Agregar a la canasta/ });
    expect(buttons).toHaveLength(1);
    expect(bar).toContainElement(buttons[0] ?? null);
    // La presentación elegida va en la descripción del botón, no en un texto aparte.
    expect(buttons[0]).toHaveAccessibleDescription(/500 g.*4\.500/);
    expect(screen.queryByText('Se agrega 500 g')).not.toBeInTheDocument();
  });

  it('la elección de presentación sigue en el panel y la barra agrega esa', () => {
    stubMatchMedia(true);
    renderAdd();
    fireEvent.click(screen.getByRole('radio', { name: '1 kg' }));
    const bar = screen.getByRole('region', { name: 'Compra rápida' });
    expect(bar).toHaveTextContent('1 kg');
    fireEvent.click(within(bar).getByRole('button', { name: 'Agregar a la canasta' }));
    expect(localStorage.getItem('valora:canasta')).toContain('1 kg');
  });

  it('con el hueco del Layout, la barra va después del contenido principal (foco al final)', () => {
    stubMatchMedia(true);
    render(
      <BasketProvider>
        <MemoryRouter>
          <main>
            <aside>
              <AddToBasket product={rice} />
            </aside>
          </main>
          <div id="acciones-fijas" />
        </MemoryRouter>
      </BasketProvider>,
    );
    const bar = screen.getByRole('region', { name: 'Compra rápida' });
    expect(bar.parentElement?.id).toBe('acciones-fijas');
    expect(screen.getByRole('main')).not.toContainElement(bar);
    expect(screen.getByRole('main').nextElementSibling).toBe(bar.parentElement);
  });

  it('al agregar, la barra deja su lugar a «Quitar de mi canasta» (un solo botón)', () => {
    stubMatchMedia(true);
    renderAdd();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la canasta' }));
    expect(screen.queryByRole('region', { name: 'Compra rápida' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Quitar de mi canasta' })).toBeInTheDocument();
  });

  it('con una sola presentación la barra la nombra y no hay nada que elegir', () => {
    stubMatchMedia(true);
    render(
      <BasketProvider>
        <MemoryRouter>
          <AddToBasket product={{ ...rice, presentations: rice.presentations.slice(0, 1) }} />
        </MemoryRouter>
      </BasketProvider>,
    );
    const bar = screen.getByRole('region', { name: 'Compra rápida' });
    expect(bar).toHaveTextContent('500 g');
    expect(bar).not.toHaveTextContent('Más barato');
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

  it('desaparece desde 960 px (la misma frontera con que el código la muestra)', () => {
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
