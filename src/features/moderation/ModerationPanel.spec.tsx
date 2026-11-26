import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../test/fakeApi';
import { AvisosContext } from '../avisos/avisosContext';
import { ModerationPanel } from './ModerationPanel';

const renderPanel = () => {
  stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    'GET /v1/moderation/queue': { status: 200, body: { items: [] } },
    'GET /v1/moderation/store-proposals': { status: 200, body: { items: [] } },
    'GET /v1/moderation/product-requests': { status: 200, body: { items: [] } },
    'GET /v1/categories': { status: 200, body: { items: [] } },
  });
  render(
    <MemoryRouter initialEntries={['/moderacion']}>
      <ModerationPanel />
    </MemoryRouter>,
  );
};

describe('panel del moderador', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('abre en los precios en revisión, con las demás vistas en pestañas', async () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Moderación' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map(({ textContent }) => textContent);
    expect(tabs).toEqual(['Precios', 'Tiendas', 'Productos', 'Comercios', 'Roles']);
    expect(screen.getByRole('tab', { name: 'Precios' })).toHaveAttribute('aria-selected', 'true');
    expect(
      await screen.findByRole('heading', { name: 'No hay precios en revisión' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['Tiendas', 'No hay tiendas propuestas'],
    ['Productos', 'No hay productos propuestos'],
  ])('la pestaña %s muestra lo que espera decisión', async (tab, empty) => {
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: tab }));

    expect(screen.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    expect(
      await within(screen.getByRole('tabpanel', { name: tab })).findByRole('heading', {
        name: empty,
      }),
    ).toBeInTheDocument();
  });

  it('la pestaña Roles permite cambiar el rol de una cuenta', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Roles' }));

    expect(
      within(screen.getByRole('tabpanel', { name: 'Roles' })).getByRole('button', {
        name: 'Cambiar rol',
      }),
    ).toBeInTheDocument();
  });

  it('maneja las pestañas con el teclado y conserva ?vista= (H32)', async () => {
    renderPanel();
    const precios = screen.getByRole('tab', { name: 'Precios' });
    precios.focus();

    // Solo la pestaña activa está en el orden de Tab.
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toEqual([precios]);

    fireEvent.keyDown(precios, { key: 'ArrowRight' });
    const tiendas = screen.getByRole('tab', { name: 'Tiendas' });
    expect(tiendas).toHaveFocus();
    expect(tiendas).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('tabpanel', { name: 'Tiendas' })).toBeInTheDocument();

    fireEvent.keyDown(tiendas, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Roles' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Roles' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Precios' })).toHaveFocus();
  });

  it('abre la vista de la dirección y la tabpanel queda ligada a su pestaña', () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/categories': { status: 200, body: { items: [] } },
    });
    render(
      <MemoryRouter initialEntries={['/moderacion?vista=roles']}>
        <ModerationPanel />
      </MemoryRouter>,
    );

    const roles = screen.getByRole('tab', { name: 'Roles' });
    expect(roles).toHaveAttribute('aria-selected', 'true');
    expect(roles).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tabpanel', { name: 'Roles' })).toHaveAttribute(
      'id',
      roles.getAttribute('aria-controls'),
    );
  });
});

// ADR-043: cada pestaña dice cuántos casos esperan; son los mismos números de la campana.
describe('números en las pestañas del panel (ADR-043)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderWithCounts = () => {
    stubApi({
      'GET /v1/auth/session': sessionAs('moderador'),
      'GET /v1/moderation/queue': { status: 200, body: { items: [] } },
    });
    render(
      <MemoryRouter initialEntries={['/moderacion']}>
        <AvisosContext.Provider
          value={{
            kind: 'moderador',
            counts: { precios: 2, tiendas: 0, productos: 1, comercios: 0 },
          }}
        >
          <ModerationPanel />
        </AvisosContext.Provider>
      </MemoryRouter>,
    );
  };

  it('muestra el número de cada pestaña con casos y lo dice con palabras', async () => {
    renderWithCounts();

    expect(screen.getByRole('tab', { name: 'Precios, 2 pendientes' })).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: 'Productos, 1 pendiente' })).toHaveTextContent('1');
    expect(
      await screen.findByRole('heading', { name: 'No hay precios en revisión' }),
    ).toBeInTheDocument();
  });

  it('las pestañas sin casos y la de Roles no llevan número', async () => {
    renderWithCounts();

    expect(screen.getByRole('tab', { name: 'Tiendas' })).toHaveTextContent(/^Tiendas$/);
    expect(screen.getByRole('tab', { name: 'Comercios' })).toHaveTextContent(/^Comercios$/);
    expect(screen.getByRole('tab', { name: 'Roles' })).toHaveTextContent(/^Roles$/);
    expect(
      await screen.findByRole('heading', { name: 'No hay precios en revisión' }),
    ).toBeInTheDocument();
  });
});
