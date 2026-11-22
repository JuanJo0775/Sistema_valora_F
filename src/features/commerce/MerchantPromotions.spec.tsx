import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../app/App';
import { sessionAs, stubApi } from '../../test/fakeApi';

const path = '/v1/commerce/promotions';
const price = {
  presentationId: 'p1',
  establishmentId: 's1',
  priceCop: 2200,
  freshness: 'vigente',
  confirmedAt: '2026-11-22T12:00:00Z',
};
const promotion = {
  id: 'promo-1',
  presentationId: 'p1',
  type: 'descuento_porcentual',
  percent: 10,
  validFrom: '2026-11-22',
  validUntil: '2026-11-25',
  status: 'activa',
  conditions: { whileStocksLast: false, paymentMethod: 'cualquiera' },
  officialPriceCop: 2200,
  promotedPriceCop: 1980,
};

async function open(overrides: Parameters<typeof stubApi>[0] = {}) {
  const api = stubApi({
    'GET /v1/auth/session': sessionAs('comercio'),
    'GET /v1/commerce/prices': { status: 200, body: { items: [price] } },
    'GET /v1/commerce/alerts': { status: 200, body: { items: [] } },
    'GET /v1/establishments/s1/prices': {
      status: 200,
      body: { prices: [{ presentationId: 'p1', productName: 'Arroz · 500 g' }] },
    },
    [`GET ${path}`]: { status: 200, body: { items: [] } },
    ...overrides,
  });
  window.history.pushState({}, '', '/comercios');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Promociones' }));
  return api;
}

const fill = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

describe('promociones del comercio (#167)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.pushState({}, '', '/');
  });

  it('publica una promoción con fechas y condiciones fijas', async () => {
    const { calls } = await open({ [`POST ${path}`]: { status: 201, body: promotion } });
    await screen.findByRole('option', { name: /Arroz/ });
    fill('Presentación', 'p1');
    fill('Descuento (%)', '10');
    fill('Desde', '2026-11-22');
    fill('Hasta', '2026-11-25');
    fill('Máximo por cliente (opcional)', '2');
    fill('Medio de pago', 'efectivo');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Hasta agotar existencias' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publicar promoción' }));
    expect(await screen.findByText('Promoción publicada.')).toBeInTheDocument();
    const sent = calls.find(({ method, path: url }) => method === 'POST' && url === path);
    expect(JSON.parse(sent?.body ?? '{}')).toEqual({
      presentationId: 'p1',
      type: 'descuento_porcentual',
      percent: 10,
      validFrom: '2026-11-22',
      validUntil: '2026-11-25',
      conditions: { maxPerCustomer: 2, whileStocksLast: true, paymentMethod: 'efectivo' },
    });
  });

  it('muestra los estados de la API y retira una promoción con confirmación', async () => {
    const { calls } = await open({
      [`GET ${path}`]: [
        {
          status: 200,
          body: {
            items: [
              promotion,
              ...['pausada', 'programada', 'vencida'].map((status) => ({
                ...promotion,
                id: status,
                status,
              })),
            ],
          },
        },
        { status: 200, body: { items: [] } },
      ],
      [`DELETE ${path}/promo-1`]: { status: 204 },
    });
    expect(await screen.findByText('Activa')).toBeInTheDocument();
    expect(screen.getByText('Pausada')).toBeInTheDocument();
    expect(screen.getByText('Programada')).toBeInTheDocument();
    expect(screen.getByText('Vencida')).toBeInTheDocument();
    const [first] = screen.getAllByRole('button', { name: 'Retirar promoción' });
    if (!first) throw new Error('Falta el botón para retirar');
    fireEvent.click(first);
    expect(calls.some(({ method }) => method === 'DELETE')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
    expect(await screen.findByText('Promoción retirada.')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        calls.some(({ method, path: url }) => method === 'DELETE' && url === `${path}/promo-1`),
      ).toBe(true);
      expect(screen.getByText('Aún no tienes promociones publicadas.')).toBeInTheDocument();
    });
  });

  it('guía a publicar o reconfirmar si no tiene precios vigentes', async () => {
    await open({
      'GET /v1/commerce/prices': {
        status: 200,
        body: { items: [{ ...price, freshness: 'desactualizado' }] },
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Ir a Precios' }));
    expect(await screen.findByRole('heading', { name: 'Mis precios' })).toBeInTheDocument();
  });
});
