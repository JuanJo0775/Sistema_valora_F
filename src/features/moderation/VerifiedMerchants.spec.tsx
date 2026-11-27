import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionAs, stubApi } from '../../test/fakeApi';
import { ModerationPanel } from './ModerationPanel';

vi.mock('../stores/StoreMap', () => ({ StoreMap: () => null }));

const merchant = (name: string, change: Record<string, unknown> = {}) => ({
  establishment: { id: `id-${name.replaceAll(' ', '-')}`, name },
  responsibleName: 'Rosa Gómez',
  nit: '900123456-7',
  phone: '3001234567',
  verifiedAt: '2026-11-21T15:00:00Z',
  ...change,
});

function open(roster: unknown, extra: Record<string, { status: number; body?: unknown }> = {}) {
  const api = stubApi({
    'GET /v1/auth/session': sessionAs('moderador'),
    'GET /v1/moderation/merchant-cases': { status: 200, body: { items: [] } },
    'GET /v1/moderation/merchants': { status: 200, body: roster },
    ...extra,
  });
  render(
    <MemoryRouter initialEntries={['/moderacion?vista=comercios']}>
      <ModerationPanel />
    </MemoryRouter>,
  );
  return api;
}

const card = async (name: string) =>
  within((await screen.findByRole('heading', { name })).closest('li') as HTMLElement);

// H14: moderación solo veía casos; ahora ve los comercios verificados y puede revocar uno.
describe('comercios verificados en moderación (H14)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lista cada comercio con su responsable, su NIT, su teléfono y desde cuándo está verificado', async () => {
    open({
      items: [merchant('Tienda La Rosa'), merchant('Tienda Informal', { nit: null })],
      total: 2,
    });

    const rosa = await card('Tienda La Rosa');
    expect(rosa.getByText('Rosa Gómez')).toBeInTheDocument();
    expect(rosa.getByText('900123456-7')).toBeInTheDocument();
    expect(rosa.getByText('3001234567')).toBeInTheDocument();
    expect(rosa.getByText(/Verificado el 21 nov/)).toBeInTheDocument();
    expect((await card('Tienda Informal')).getByText('Sin NIT')).toBeInTheDocument();
  });

  it('sin comercios verificados lo dice', async () => {
    open({ items: [], total: 0 });

    expect(await screen.findByText('No hay comercios verificados')).toBeInTheDocument();
  });

  it('si hay más de los que caben, dice cuántos se muestran y cuántos hay', async () => {
    open({ items: [merchant('Tienda La Rosa')], total: 340 });

    expect(await screen.findByText('Se muestran los 1 más recientes de 340.')).toBeInTheDocument();
  });

  it('revocar pide el motivo y una confirmación que dice qué se retira, y saca al comercio de la lista', async () => {
    const { calls } = open(
      { items: [merchant('Tienda La Rosa')], total: 1 },
      { 'POST /v1/moderation/merchants/id-Tienda-La-Rosa/revoke': { status: 204 } },
    );
    const rosa = await card('Tienda La Rosa');

    fireEvent.click(rosa.getByRole('radio', { name: 'Revocar comercio' }));
    fireEvent.change(rosa.getByRole('textbox', { name: 'Motivo de la decisión' }), {
      target: { value: 'La tienda cerró: confirmado por teléfono.' },
    });
    fireEvent.click(rosa.getByRole('button', { name: 'Registrar decisión' }));
    const confirmation = within(
      await screen.findByRole('group', { name: 'Confirmar la decisión' }),
    );
    expect(confirmation.getByText(/precios oficiales y las promociones/)).toBeInTheDocument();
    expect(calls.filter(({ method }) => method === 'POST')).toHaveLength(0);
    fireEvent.click(confirmation.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Decisión registrada: Tienda La Rosa.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tienda La Rosa' })).not.toBeInTheDocument();
    expect(calls.find(({ method }) => method === 'POST')?.body).toBe(
      JSON.stringify({ note: 'La tienda cerró: confirmado por teléfono.' }),
    );
  });

  it('si la lista falla, la cola de casos sigue y se puede reintentar', async () => {
    open(
      { code: 'INTERNAL_ERROR', message: 'Falló.' },
      {
        'GET /v1/moderation/merchants': {
          status: 500,
          body: { code: 'INTERNAL_ERROR', message: 'Falló.' },
        },
      },
    );

    expect(
      await screen.findByText('No pudimos cargar los comercios verificados.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByText('No hay casos de comercios pendientes')).toBeInTheDocument();
  });
});
