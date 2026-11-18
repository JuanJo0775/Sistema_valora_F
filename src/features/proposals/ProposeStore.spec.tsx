import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { stubLocation } from '../../test/location';
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

  it('«Estoy en la tienda» marca el punto donde está la persona, solo si lo toca', async () => {
    const api = renderPropose();
    stubLocation();
    fill();

    fireEvent.click(screen.getByRole('button', { name: 'Estoy en la tienda' }));
    expect(await screen.findByText('Marcado en 4.53, -75.68')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    await screen.findByRole('heading', { name: 'Recibido' });
    expect(sentBody(api)).toMatchObject({ lat: 4.53, lng: -75.68 });
  });

  it.each([
    ['el nombre', false, true, 'Escribe el nombre de la tienda.'],
    ['el punto en el mapa', true, false, 'Toca el mapa para marcar dónde queda la tienda.'],
  ])('sin %s lo dice y no envía', (_missing, withName, withPoint, message) => {
    const api = renderPropose();
    if (withName) fill();
    if (withPoint) fireEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(api.calls.some(({ method }) => method === 'POST')).toBe(false);
  });

  it('si el servidor no la acepta muestra por qué', async () => {
    renderPropose({
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: 'La ubicación está fuera del Quindío.' },
    });
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));

    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La ubicación está fuera del Quindío.',
    );
  });
});

describe('sugerir una tienda: salidas y ubicación', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('«Recibido» ofrece ver mis aportes y volver al mapa', async () => {
    renderPropose();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar el mapa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar propuesta' }));

    expect(await screen.findByRole('link', { name: 'Ver mis aportes' })).toHaveAttribute(
      'href',
      '/mis-aportes',
    );
    expect(screen.getByRole('link', { name: 'Volver al mapa' })).toHaveAttribute('href', '/mapa');
  });

  it('antes de usar la ubicación dice que no se guarda ni se publica', () => {
    renderPropose();

    expect(screen.getByRole('button', { name: 'Estoy en la tienda' })).toHaveAccessibleDescription(
      /no se guarda ni se publica/,
    );
  });
});
