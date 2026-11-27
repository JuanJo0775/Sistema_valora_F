import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, sessionAs, stubApi } from '../../test/fakeApi';
import { decideCase, decisionLabels, pendingCase } from '../../test/moderation';
import { StoreProposals } from './StoreProposals';

// Leaflet necesita un navegador de verdad para dibujar; aquí el mapa dice qué punto marca.
vi.mock('../stores/StoreMap', () => ({
  StoreMap: ({ label, picked }: { label: string; picked: { lat: number; lng: number } }) => (
    <p>{`${label}: ${String(picked.lat)}, ${String(picked.lng)}`}</p>
  ),
}));

const ARA_ID = '5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d';

const proposal = (name: string, extra: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  name,
  type: 'barrio',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
  outOfZone: false,
  possibleDuplicates: [],
  createdAt: '2026-11-16T15:00:00Z',
  ...extra,
});

const list = (...items: unknown[]): FakeReply => ({ status: 200, body: { items } });

const renderProposals = (routes: Record<string, FakeReply | FakeReply[]>) => {
  const api = stubApi({ 'GET /v1/auth/session': sessionAs('moderador'), ...routes });
  render(
    <MemoryRouter>
      <StoreProposals />
    </MemoryRouter>,
  );
  return api;
};

const NOTE = 'Revisé la dirección en el mapa.';
const decide = (card: Awaited<ReturnType<typeof pendingCase>>, decision: string) => {
  decideCase(card, decision, NOTE);
};

describe('tiendas propuestas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cada propuesta muestra su tipo, su dirección, su punto en el mapa y si está fuera del Quindío', async () => {
    renderProposals({
      'GET /v1/moderation/store-proposals': list(
        proposal('Tienda La Esquina', { address: 'Calle 10 # 15-20' }),
        proposal('Granero El Sol', {
          type: 'minimercado',
          outOfZone: true,
          lat: 4.81,
          lng: -75.69,
        }),
      ),
    });

    const corner = await pendingCase('Tienda La Esquina');
    expect(corner.getByText('Tienda de barrio · Armenia')).toBeInTheDocument();
    expect(corner.getByText('Calle 10 # 15-20')).toBeInTheDocument();
    expect(
      corner.getByText('Ubicación de Tienda La Esquina: 4.5339, -75.6811'),
    ).toBeInTheDocument();
    expect(corner.queryByText('Fuera del Quindío')).not.toBeInTheDocument();
    const sun = await pendingCase('Granero El Sol');
    expect(sun.getByText('Fuera del Quindío')).toBeInTheDocument();
  });

  // H16: sin límites oficiales de municipios, el sistema avisa al moderador y él decide.
  it('avisa cuando la ubicación parece de otro municipio que el registrado', async () => {
    renderProposals({
      'GET /v1/moderation/store-proposals': list(
        proposal('Tienda Prueba QA', {
          municipality: 'armenia',
          suggestedMunicipality: 'la-tebaida',
        }),
        proposal('Tienda Bien Ubicada'),
      ),
    });

    const flagged = await pendingCase('Tienda Prueba QA');
    expect(
      flagged.getByText('La ubicación parece de La Tebaida, pero se registró como Armenia.'),
    ).toBeInTheDocument();
    const fine = await pendingCase('Tienda Bien Ubicada');
    expect(fine.queryByText(/La ubicación parece de/)).not.toBeInTheDocument();
  });

  // H5: aprobar una propuesta que nace de un reclamo verifica a la cuenta; el moderador lo ve antes.
  it('una propuesta de un comercio muestra al responsable y avisa que aprobarla lo verifica', async () => {
    renderProposals({
      'GET /v1/moderation/store-proposals': list(
        proposal('Tienda Doña Rosa', {
          claim: {
            responsibleName: 'Rosa Gómez',
            phone: '3001234567',
            nit: '900123456-7',
            grantsMerchantRole: true,
          },
        }),
        proposal('Tienda Informal', {
          claim: { responsibleName: 'Luis Ramírez', phone: '3157654321', grantsMerchantRole: true },
        }),
        proposal('Tienda Sugerida'),
      ),
    });

    const registered = await pendingCase('Tienda Doña Rosa');
    const owner = registered.getByRole('group', { name: 'Quien la pide' });
    expect(within(owner).getByText('Rosa Gómez')).toBeInTheDocument();
    expect(within(owner).getByText('3001234567')).toBeInTheDocument();
    expect(within(owner).getByText('900123456-7')).toBeInTheDocument();
    expect(
      registered.getByText(/Aprobarla verifica a esta cuenta como comercio/),
    ).toBeInTheDocument();

    const informal = await pendingCase('Tienda Informal');
    expect(
      within(informal.getByRole('group', { name: 'Quien la pide' })).getByText('Sin NIT'),
    ).toBeInTheDocument();

    const suggested = await pendingCase('Tienda Sugerida');
    expect(suggested.queryByRole('group', { name: 'Quien la pide' })).not.toBeInTheDocument();
    expect(suggested.queryByText(/verifica a esta cuenta/)).not.toBeInTheDocument();
  });

  it('muestra las tiendas parecidas cercanas y solo con ellas se puede fusionar', async () => {
    renderProposals({
      'GET /v1/moderation/store-proposals': list(
        proposal('Ara Centro', {
          possibleDuplicates: [{ id: ARA_ID, name: 'Ara', distanceM: 30 }],
        }),
        proposal('Tienda Nueva'),
      ),
    });

    const ara = await pendingCase('Ara Centro');
    expect(ara.getByText('Posibles duplicados: Ara (30 m)')).toBeInTheDocument();
    expect(decisionLabels(ara)).toEqual([
      'Aprobar como tienda nueva',
      'Fusionar con Ara',
      'Rechazar',
    ]);
    const fresh = await pendingCase('Tienda Nueva');
    expect(fresh.queryByText(/Posibles duplicados/)).not.toBeInTheDocument();
    expect(fresh.queryByRole('radio', { name: /Fusionar/ })).not.toBeInTheDocument();
  });

  it('fusionar envía la tienda elegida y quita la propuesta de la lista', async () => {
    const ara = proposal('Ara Centro', {
      possibleDuplicates: [{ id: ARA_ID, name: 'Ara', distanceM: 30 }],
    });
    const api = renderProposals({
      'GET /v1/moderation/store-proposals': list(ara),
      [`POST /v1/moderation/store-proposals/${ara.id}/decision`]: { status: 204 },
    });

    decide(await pendingCase('Ara Centro'), 'Fusionar con Ara');

    expect(await screen.findByRole('status')).toHaveTextContent('Decisión registrada: Ara Centro.');
    // La tarjeta decidida desaparece: el foco pasa al aviso y no se pierde en <body>.
    expect(screen.getByRole('status')).toHaveFocus();
    expect(screen.queryByRole('heading', { name: 'Ara Centro' })).not.toBeInTheDocument();
    const sent = api.calls.find(({ method }) => method === 'POST');
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      decision: 'fusionar',
      note: NOTE,
      mergeInto: ARA_ID,
    });
  });

  it('aprobar no envía tienda con la cual fusionar', async () => {
    const fresh = proposal('Tienda Nueva');
    const api = renderProposals({
      'GET /v1/moderation/store-proposals': list(fresh),
      [`POST /v1/moderation/store-proposals/${fresh.id}/decision`]: { status: 204 },
    });

    decide(await pendingCase('Tienda Nueva'), 'Aprobar como tienda nueva');

    await screen.findByRole('status');
    expect(JSON.parse(api.calls.find(({ method }) => method === 'POST')?.body ?? '{}')).toEqual({
      decision: 'aprobar',
      note: NOTE,
    });
  });

  it('si otro moderador ya la decidió, lo dice', async () => {
    const fresh = proposal('Tienda Nueva');
    renderProposals({
      'GET /v1/moderation/store-proposals': list(fresh),
      [`POST /v1/moderation/store-proposals/${fresh.id}/decision`]: {
        status: 404,
        body: { code: 'NOT_FOUND', message: 'No encontrado.' },
      },
    });

    decide(await pendingCase('Tienda Nueva'), 'Rechazar');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta propuesta ya no está pendiente: otro moderador la decidió.',
    );
  });

  it('si la tienda con la que se fusiona ya no existe, lo dice', async () => {
    const ara = proposal('Ara Centro', {
      possibleDuplicates: [{ id: ARA_ID, name: 'Ara', distanceM: 30 }],
    });
    renderProposals({
      'GET /v1/moderation/store-proposals': list(ara),
      [`POST /v1/moderation/store-proposals/${ara.id}/decision`]: {
        status: 422,
        body: { code: 'UNKNOWN_ESTABLISHMENT', message: 'No existe.' },
      },
    });

    decide(await pendingCase('Ara Centro'), 'Fusionar con Ara');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esa tienda ya no existe: elige otra decisión.',
    );
  });

  it('sin propuestas lo dice', async () => {
    renderProposals({ 'GET /v1/moderation/store-proposals': list() });

    expect(
      await screen.findByRole('heading', { name: 'No hay tiendas propuestas' }),
    ).toBeInTheDocument();
  });
});
