import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../test/fakeApi';
import { ModerationPanel } from './ModerationPanel';

const renderPanel = () => {
  stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    'GET /v1/moderation/queue': { status: 200, body: { items: [] } },
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

  it('otra pestaña muestra su vista', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('tab', { name: 'Tiendas' }));

    expect(screen.getByRole('tab', { name: 'Tiendas' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Tiendas' })).toHaveTextContent(
      'Esta vista está en construcción (issue #57).',
    );
  });
});
