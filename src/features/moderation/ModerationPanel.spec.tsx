import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../test/fakeApi';
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
    expect(tabs).toEqual(['Precios', 'Tiendas', 'Productos', 'Roles']);
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
});
