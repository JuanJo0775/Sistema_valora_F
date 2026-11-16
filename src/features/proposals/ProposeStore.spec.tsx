import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { ProposeStore } from './ProposeStore';

// El mapa simulado: un botón hace de toque en el mapa y dice el punto elegido.
vi.mock('../stores/StoreMap', () => ({
  StoreMap: ({
    onPick,
    picked,
  }: {
    onPick?: (point: { lat: number; lng: number }) => void;
    picked?: { lat: number; lng: number } | null;
  }) => (
    <div>
      <button type="button" onClick={() => onPick?.({ lat: 4.5401, lng: -75.6702 })}>
        Tocar el mapa
      </button>
      {picked && <p>{`Marcado en ${String(picked.lat)}, ${String(picked.lng)}`}</p>}
    </div>
  ),
}));

const renderPropose = (
  reply: FakeReply = { status: 202, body: { id: crypto.randomUUID(), status: 'pendiente' } },
) => {
  const api = stubApi({
    'GET /v1/auth/session': sessionAs('reportante'),
    'POST /v1/establishment-proposals': reply,
  });
  render(
    <MemoryRouter>
      <ProposeStore />
    </MemoryRouter>,
  );
  return api;
};

const fill = () => {
  fireEvent.change(screen.getByLabelText('Nombre de la tienda'), {
    target: { value: 'Tienda La Esperanza' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Tipo' }), { target: { value: 'barrio' } });
  fireEvent.change(screen.getByLabelText('Dirección (opcional)'), {
    target: { value: 'Carrera 19 # 10-20' },
  });
};

const sentBody = (api: ReturnType<typeof stubApi>) =>
  JSON.parse(api.calls.find(({ method }) => method === 'POST')?.body ?? '{}') as Record<
    string,
    unknown
  >;

describe('proponer una tienda', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('se marca la tienda en el mapa y queda pendiente de un moderador', async () => {
    const api = renderPropose();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(await screen.findByRole('heading', { name: 'Recibido' })).toBeInTheDocument();
    expect(
      screen.getByText('Aparecerá en el mapa cuando un moderador la apruebe.'),
    ).toBeInTheDocument();
    expect(sentBody(api)).toEqual({
      name: 'Tienda La Esperanza',
      type: 'barrio',
      lat: 4.5401,
      lng: -75.6702,
      municipality: 'armenia',
      address: 'Carrera 19 # 10-20',
    });
  });
});
