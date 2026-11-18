import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { BasketProvider } from '../basket/BasketProvider';
import { PlanPage } from './PlanPage';
import { readPlans, savePlan, toSavedPlan, type PlanDraft } from './savedPlan';

const RICE = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
const MILK = '4a2d3b75-6d2f-4c9b-8e72-1b8c2f3d4e5f';
const SALT = '5b3e4c86-7e30-4dac-9f83-2c9d3a4e5f60';

const item = (productId: string, productName: string, presentationId: string, quantity = 1) => ({
  productId,
  productName,
  presentationId,
  presentationLabel: '1 und',
  quantity,
  bought: false,
});
const rice = item(RICE, 'Arroz blanco', 'arroz-500g', 2);
const milk = item(MILK, 'Leche entera', 'leche-1l');
const salt = item(SALT, 'Sal', 'sal-1kg');

const shop = (id: string, name: string, lat: number, distanceM?: number) => ({
  id,
  name,
  type: 'barrio',
  address: `Calle ${name} 1`,
  lat,
  lng: -75.6811,
  municipality: 'armenia',
  ...(distanceM === undefined ? {} : { distanceM }),
});
const offer = (store: ReturnType<typeof shop>, presentationId: string, priceCop: number) => ({
  establishment: store,
  reportId: crypto.randomUUID(),
  presentationId,
  priceCop,
  unitPrice: { valueCop: priceCop, per: 'und' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 1,
  isCheapest: false,
  observedAt: new Date().toISOString(),
});
const comparisonOf = (productId: string, ...results: ReturnType<typeof offer>[]) => ({
  [`GET /v1/products/${productId}/comparison`]: {
    status: 200,
    body: {
      productId,
      criteria: { sort: 'unit_price', municipality: 'armenia' },
      results,
      promotions: [],
    },
  },
});

const a = shop('a', 'Tienda A', 4.5339, 400);
const b = shop('b', 'Tienda B', 4.5439, 1100);
const routes = () => ({
  ...comparisonOf(RICE, offer(a, 'arroz-500g', 2000), offer(b, 'arroz-500g', 2500)),
  ...comparisonOf(MILK, offer(a, 'leche-1l', 5000), offer(b, 'leche-1l', 3000)),
  ...comparisonOf(SALT),
});

const renderPlan = (...items: ReturnType<typeof item>[]) => {
  localStorage.setItem('valora:canasta', JSON.stringify(items));
  return render(
    <BasketProvider>
      <MemoryRouter>
        <PlanPage />
      </MemoryRouter>
    </BasketProvider>,
  );
};

// Ubicación de la persona, distinta de cualquier tienda para poder buscarla en lo guardado.
const locate = () => {
  localStorage.setItem('valora:donde', 'ubicacion');
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (ok: (p: unknown) => void) => {
        ok({ coords: { latitude: 4.53017, longitude: -75.68023 } });
      },
    },
  });
};

const twoStores = async () => within(await screen.findByRole('region', { name: '2 tiendas' }));

describe('guardar el plan', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'geolocation');
    localStorage.clear();
  });

  it('guarda sin distanceM ni la ubicación de la persona y enlaza al plan', async () => {
    locate();
    stubApi(routes());
    renderPlan(rice, milk, salt);

    fireEvent.click((await twoStores()).getByRole('button', { name: 'Guardar plan' }));

    const raw = localStorage.getItem('valora:planes') ?? '';
    expect(raw).not.toContain('distanceM');
    expect(raw).not.toContain('4.53017');
    expect(raw).not.toContain('-75.68023');
    const [plan] = readPlans();
    expect(plan?.stores).toHaveLength(2);
    expect(plan?.area.kind).toBe('ubicacion');
    // La sal no tiene precio: va aparte, con storeId y precio null.
    const unpriced = plan?.lines.find((l) => l.productName === 'Sal');
    expect(unpriced).toMatchObject({ storeId: null, priceCop: null, observedAt: null });
    expect(plan?.summary.missing).toBe(1);
    const priced = plan?.lines.find((l) => l.productName === 'Arroz blanco');
    expect(priced).toMatchObject({ storeId: 'a', priceCop: 2000, source: 'comunidad' });

    const section = await twoStores();
    expect(section.getByText('Plan guardado')).toBeInTheDocument();
    expect(section.getByRole('link', { name: /Ver plan guardado/ })).toHaveAttribute(
      'href',
      `/canasta/plan/${plan?.id ?? ''}`,
    );
  });

  it('solo guarda los productos pendientes de la canasta', async () => {
    stubApi(routes());
    renderPlan(rice, { ...milk, bought: true });

    const buttons = await screen.findAllByRole('button', { name: 'Guardar plan' });
    fireEvent.click(buttons[0] as HTMLElement);

    expect(readPlans()[0]?.lines.map((l) => l.productName)).toEqual(['Arroz blanco']);
  });

  it('con 5 planes ya guardados avisa y no guarda', async () => {
    const draft: PlanDraft = {
      area: { kind: 'municipio', municipality: 'armenia' },
      stores: [],
      lines: [],
      summary: {
        stores: 0,
        productsCop: 0,
        baselineCop: null,
        travel: null,
        deliveryCop: 0,
        netCop: null,
        missing: 0,
      },
    };
    for (let i = 0; i < 5; i++) savePlan(toSavedPlan(draft, new Date()));
    stubApi(routes());
    renderPlan(rice, milk);

    fireEvent.click((await twoStores()).getByRole('button', { name: 'Guardar plan' }));

    expect(
      await screen.findByText('Ya tienes 5 planes guardados. Borra uno para guardar otro.'),
    ).toBeInTheDocument();
    expect(readPlans()).toHaveLength(5);
  });

  it('si el navegador no deja guardar, lo dice y la pantalla sigue viva', async () => {
    stubApi(routes());
    renderPlan(rice, milk);
    const section = await twoStores();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });

    fireEvent.click(section.getByRole('button', { name: 'Guardar plan' }));

    expect(
      await screen.findByText(
        'No se pudo guardar en este navegador (modo privado o sin espacio). Puedes compartirlo o imprimirlo.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 tiendas' })).toBeInTheDocument();
  });
});
