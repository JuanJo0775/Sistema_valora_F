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
    'GET /v1/commerce/prices': { status: 200, body: { items: [price], inReview: [] } },
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
  fireEvent.click(await screen.findByRole('tab', { name: 'Promociones' }));
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

  it.each([
    ['precio_especial', [['Precio especial en pesos', '1700']], { specialPriceCop: 1700 }],
    [
      'pague_x_lleve_y',
      [
        ['Unidades que lleva', '3'],
        ['Unidades que paga', '2'],
      ],
      { takeY: 3, payX: 2 },
    ],
  ] as const)('envía solo las cantidades de una oferta %s', async (type, fields, expected) => {
    const { calls } = await open({ [`POST ${path}`]: { status: 201, body: promotion } });
    await screen.findByRole('option', { name: /Arroz/ });
    fill('Presentación', 'p1');
    fill('Tipo de promoción', type);
    for (const [label, value] of fields) fill(label, value);
    fill('Desde', '2026-11-22');
    fill('Hasta', '2026-11-25');
    fireEvent.click(screen.getByRole('button', { name: 'Publicar promoción' }));
    expect(await screen.findByText('Promoción publicada.')).toBeInTheDocument();
    const sent = calls.find(({ method, path: url }) => method === 'POST' && url === path);
    expect(JSON.parse(sent?.body ?? '{}') as unknown).toEqual({
      presentationId: 'p1',
      type,
      ...expected,
      validFrom: '2026-11-22',
      validUntil: '2026-11-25',
      conditions: { whileStocksLast: false, paymentMethod: 'cualquiera' },
    });
  });

  it('rechaza fechas que superan los 30 días antes de publicar', async () => {
    const { calls } = await open();
    await screen.findByRole('option', { name: /Arroz/ });
    fill('Presentación', 'p1');
    fill('Descuento (%)', '10');
    fill('Desde', '2026-11-22');
    fill('Hasta', '2026-12-22');
    fireEvent.click(screen.getByRole('button', { name: 'Publicar promoción' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('1 a 30 días');
    // El aviso está pegado al botón que lo provocó, y el botón lo referencia.
    const publish = screen.getByRole('button', { name: 'Publicar promoción' });
    expect(publish.closest('form')).toContainElement(alert);
    expect(publish).toHaveAccessibleDescription(/1 a 30 días/);
    expect(calls.some(({ method, path: url }) => method === 'POST' && url === path)).toBe(false);
  });

  it('ofrece volver a Precios si el backend detecta un precio vencido', async () => {
    await open({
      [`POST ${path}`]: {
        status: 422,
        body: {
          code: 'OFFICIAL_PRICE_REQUIRED',
          message: 'Se requiere un precio oficial vigente.',
        },
      },
    });
    await screen.findByRole('option', { name: /Arroz/ });
    fill('Presentación', 'p1');
    fill('Descuento (%)', '10');
    fill('Desde', '2026-11-22');
    fill('Hasta', '2026-11-25');
    fireEvent.click(screen.getByRole('button', { name: 'Publicar promoción' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Se requiere un precio oficial vigente.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Precios' }));
    expect(screen.getByRole('heading', { name: 'Mis precios' })).toBeInTheDocument();
  });

  it('muestra el precio absurdo de la promoción junto al botón «Publicar promoción»', async () => {
    const message =
      'El precio de la promoción está fuera de lo normal. Lo más barato que vemos es $2.000. Revisa si faltan o sobran ceros.';
    await open({
      [`POST ${path}`]: { status: 422, body: { code: 'IMPLAUSIBLE_OFFICIAL_PRICE', message } },
    });
    await screen.findByRole('option', { name: /Arroz/ });
    fill('Presentación', 'p1');
    fill('Descuento (%)', '90');
    fill('Desde', '2026-11-22');
    fill('Hasta', '2026-11-25');
    const publish = screen.getByRole('button', { name: 'Publicar promoción' });
    fireEvent.click(publish);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(screen.getAllByText(message)).toHaveLength(1);
    // Está dentro del formulario, pegado al botón, y el botón lo referencia.
    expect(publish.closest('form')).toContainElement(alert);
    expect(publish).toHaveAccessibleDescription(message);
  });

  it('usa el nombre del servidor en la lista y en el selector «Presentación» (H3)', async () => {
    const named = { productName: 'Arroz blanco Diana', presentationLabel: '1 kg' };
    const { calls } = await open({
      'GET /v1/commerce/prices': {
        status: 200,
        body: { items: [{ ...price, ...named }], inReview: [] },
      },
      [`GET ${path}`]: { status: 200, body: { items: [{ ...promotion, ...named }] } },
    });
    expect(
      await screen.findByRole('heading', { name: 'Arroz blanco Diana · 1 kg' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Arroz blanco Diana · 1 kg · $2.200' }),
    ).toBeInTheDocument();
    expect(calls.some(({ path: url }) => url === '/v1/establishments/s1/prices')).toBe(false);
  });

  it('muestra el solapamiento de promociones junto al botón «Publicar promoción» (H20)', async () => {
    const message =
      'Ya tienes otra promoción de esta presentación del 22 al 25 de nov. Retírala o cambia las fechas.';
    await open({
      [`POST ${path}`]: { status: 422, body: { code: 'PROMOTION_OVERLAP', message } },
    });
    await screen.findByRole('option', { name: /Arroz/ });
    fill('Presentación', 'p1');
    fill('Descuento (%)', '10');
    fill('Desde', '2026-11-22');
    fill('Hasta', '2026-11-25');
    const publish = screen.getByRole('button', { name: 'Publicar promoción' });
    fireEvent.click(publish);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(publish.closest('form')).toContainElement(alert);
    expect(publish).toHaveAccessibleDescription(message);
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
    // «Retirar» se reemplaza por «Confirmar retiro»: el foco pasa a este botón.
    expect(screen.getByRole('button', { name: 'Confirmar retiro' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));
    expect(await screen.findByText('Promoción retirada.')).toHaveFocus();
    await waitFor(() => {
      expect(
        calls.some(({ method, path: url }) => method === 'DELETE' && url === `${path}/promo-1`),
      ).toBe(true);
      expect(screen.getByText('Aún no tienes promociones publicadas.')).toBeInTheDocument();
    });
  });

  it('el aviso de publicar sale bajo el botón, dentro del formulario, y es el único status (H21)', async () => {
    await open({ [`POST ${path}`]: { status: 201, body: promotion } });
    await screen.findByRole('option', { name: /Arroz/ });
    fill('Presentación', 'p1');
    fill('Descuento (%)', '10');
    fill('Desde', '2026-11-22');
    fill('Hasta', '2026-11-25');
    const publish = screen.getByRole('button', { name: 'Publicar promoción' });
    // La región viva ya está antes de publicar: así el lector de pantalla anuncia el resultado.
    const region = publish.nextElementSibling;
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(publish);

    const notice = await screen.findByText('Promoción publicada.');
    expect(notice).toBe(region);
    expect(screen.getAllByRole('status')).toEqual([notice]);
    expect(publish.closest('form')).toContainElement(notice);
    expect(notice).toBe(region);
  });

  it('el aviso de retirar sale bajo la lista, antes del formulario, y reemplaza al anterior (H21, H27)', async () => {
    await open({
      [`GET ${path}`]: [
        { status: 200, body: { items: [promotion] } },
        { status: 200, body: { items: [] } },
      ],
      [`DELETE ${path}/promo-1`]: { status: 204 },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Retirar promoción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));

    const notice = await screen.findByText('Promoción retirada.');
    expect(screen.getAllByRole('status')).toEqual([notice]);
    const form = screen.getByRole('button', { name: 'Publicar promoción' }).closest('form');
    expect(form).not.toContainElement(notice);
    expect(
      notice.compareDocumentPosition(form as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('el rechazo de un retiro sale en la promoción, con role="alert"', async () => {
    await open({
      [`GET ${path}`]: { status: 200, body: { items: [promotion] } },
      [`DELETE ${path}/promo-1`]: {
        status: 409,
        body: { code: 'CONFLICT', message: 'No se pudo retirar la promoción.' },
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Retirar promoción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No se pudo retirar la promoción.');
    expect(alert.closest('li')).toContainElement(
      screen.getByRole('button', { name: 'Confirmar retiro' }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('al cancelar el retiro, el foco vuelve a «Retirar promoción»', async () => {
    await open({
      [`GET ${path}`]: { status: 200, body: { items: [promotion] } },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Retirar promoción' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Retirar promoción' })).toHaveFocus();
  });

  it('guía a publicar o reconfirmar si no tiene precios vigentes', async () => {
    await open({
      'GET /v1/commerce/prices': {
        status: 200,
        body: { items: [{ ...price, freshness: 'desactualizado' }], inReview: [] },
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Ir a Precios' }));
    expect(await screen.findByRole('heading', { name: 'Mis precios' })).toBeInTheDocument();
  });
});
