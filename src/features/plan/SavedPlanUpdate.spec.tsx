import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { stubApi } from '../../test/fakeApi';
import { stubLocation } from '../../test/location';
import { locateAt, offer, planDraft, shop } from '../../test/planFixtures';
import { readPlans, savePlan, toSavedPlan, type PlanDraft } from './savedPlan';
import { SavedPlanPage } from './SavedPlanPage';

// Plan de planDraft: arroz (p1) ×2 en s1 a $2.190 del 16 nov y aceite (p2) en s2 a $9.000 del 15 nov.
const S1 = shop('s1', 'D1 Calle 50', 4.53);
const S2 = shop('s2', 'Tienda Don Pepe', 4.54);
const S3 = shop('s3', 'Otra Tienda', 4.55);
const NOW_DAY = '2026-11-19T15:00:00Z';

type Priced = ReturnType<typeof offer>;
const priced = (store: typeof S1, presentationId: string, price: number): Priced => ({
  ...offer(store, presentationId, price),
  observedAt: NOW_DAY,
});
const reply = (productId: string, ...results: Priced[]) => ({
  status: 200,
  body: { productId, criteria: { sort: 'unit_price' }, results, promotions: [] },
});
const routes = (arroz: Priced[], aceite: Priced[]) => ({
  'GET /v1/products/p1/comparison': reply('p1', ...arroz),
  'GET /v1/products/p2/comparison': reply('p2', ...aceite),
});
const unchanged = () => routes([priced(S1, 'pr1', 2190)], [priced(S2, 'pr2', 9000)]);
const arrozUp = () => routes([priced(S1, 'pr1', 2350)], [priced(S2, 'pr2', 9000)]);

const stored = (over: Partial<PlanDraft> = {}) => {
  const plan = toSavedPlan(planDraft(over), new Date());
  savePlan(plan);
  return plan;
};
const municipio = { area: { kind: 'municipio', municipality: 'armenia' } } as const;

const renderAt = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/canasta/plan/${id}`]}>
      <Routes>
        <Route path="/canasta/plan/:id" element={<SavedPlanPage />} />
      </Routes>
    </MemoryRouter>,
  );
const update = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar precios' }));
};
const saveButton = () => screen.findByRole('button', { name: 'Guardar con precios nuevos' });
const noSaveButton = () =>
  expect(
    screen.queryByRole('button', { name: 'Guardar con precios nuevos' }),
  ).not.toBeInTheDocument();

describe('actualizar precios del plan guardado', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'geolocation');
    localStorage.clear();
  });

  it('consulta cada producto con tienda y precio por el municipio guardado', async () => {
    const { requested } = stubApi(unchanged());
    renderAt(stored(municipio).id);
    update();

    await screen.findByText(/Los precios siguen igual/);
    const paths = requested.map((u) => u.pathname).sort();
    expect(paths).toEqual(['/v1/products/p1/comparison', '/v1/products/p2/comparison']);
    const query = requested[0]?.searchParams;
    expect(query?.get('municipality')).toBe('armenia');
    expect(query?.get('onlyCurrent')).toBe('true');
    expect(query?.get('sort')).toBe('unit_price');
    expect(query?.has('lat')).toBe(false);
  });

  it('sin cambios: lo dice con texto y no ofrece guardar', async () => {
    stubApi(unchanged());
    renderAt(stored(municipio).id);
    update();

    expect(await screen.findByText(/Arroz blanco · D1 Calle 50: sin cambios/)).toBeInTheDocument();
    noSaveButton();
  });

  it('precio que subió: antes y ahora con fecha, sin modificar nada todavía', async () => {
    stubApi(arrozUp());
    const plan = stored(municipio);
    renderAt(plan.id);
    update();

    const line = await screen.findByText(
      'Arroz blanco · D1 Calle 50: antes $2.190 (16 nov) → ahora $2.350 (19 nov), subió',
    );
    expect(line.closest('[role="status"]')).not.toBeNull();
    expect(readPlans()[0]).toEqual(plan);
  });

  it('precio que bajó', async () => {
    stubApi(routes([priced(S1, 'pr1', 2000)], [priced(S2, 'pr2', 9000)]));
    renderAt(stored(municipio).id);
    update();

    expect(
      await screen.findByText(/antes \$2\.190 \(16 nov\) → ahora \$2\.000 \(19 nov\), bajó/),
    ).toBeInTheDocument();
  });

  it('ya sin precio vigente en la tienda; avisa de otra más barata sin cambiar el reparto', async () => {
    stubApi(routes([priced(S3, 'pr1', 2000)], [priced(S2, 'pr2', 9000)]));
    const plan = stored(municipio);
    renderAt(plan.id);
    update();

    expect(
      await screen.findByText(
        'Arroz blanco · D1 Calle 50: ya no tiene precio vigente en esta tienda',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Otra Tienda la tiene más barata: $2.000')).toBeInTheDocument();
    noSaveButton();
    expect(readPlans()[0]).toEqual(plan);
  });

  it('otra tienda más barata que el precio de ahora también se dice', async () => {
    stubApi(routes([priced(S1, 'pr1', 2350), priced(S3, 'pr1', 2100)], [priced(S2, 'pr2', 9000)]));
    renderAt(stored(municipio).id);
    update();

    expect(await screen.findByText('Otra Tienda la tiene más barata: $2.100')).toBeInTheDocument();
  });

  it('guardar con precios nuevos actualiza solo lo que cambió y pide recalcular el ahorro', async () => {
    locateAt(4.51234, -75.61234);
    const { requested } = stubApi(arrozUp());
    const plan = stored();
    renderAt(plan.id);
    expect(screen.getByText(/Ahorro neto/)).toBeInTheDocument();
    update();

    fireEvent.click(await saveButton());

    const [saved] = readPlans();
    expect(saved?.lines[0]).toMatchObject({ priceCop: 2350, observedAt: NOW_DAY });
    expect(saved?.lines[1]).toEqual(plan.lines[1]);
    expect(saved?.stores).toEqual(plan.stores);
    expect(saved?.summary.productsCop).toBe(2350 * 2 + 9000);
    expect(saved?.summary).toMatchObject({ baselineCop: null, netCop: null });
    // La ubicación solo viajó en la consulta (EC-08).
    expect(requested[0]?.searchParams.get('lat')).toBe('4.51234');
    expect(requested[0]?.searchParams.get('radiusKm')).toBe('1.5');
    const raw = localStorage.getItem('valora:planes') ?? '';
    for (const secret of ['distanceM', '4.51234', '-75.61234']) expect(raw).not.toContain(secret);

    expect(await screen.findByText('Precios actualizados')).toBeInTheDocument();
    expect(screen.getByText('Recalcula el plan para ver el ahorro')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recalcular en el plan de compra' })).toHaveAttribute(
      'href',
      '/canasta/plan',
    );
    expect(screen.queryByText(/Ahorro neto/)).not.toBeInTheDocument();
    expect(screen.getByText('$13.700')).toBeInTheDocument();
    expect(screen.queryByText('Puede estar desactualizado')).not.toBeInTheDocument();
  });

  it('si no se puede guardar en el navegador, lo dice y el plan queda como estaba', async () => {
    stubApi(arrozUp());
    const plan = stored(municipio);
    renderAt(plan.id);
    update();
    const button = await saveButton();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota');
    });
    fireEvent.click(button);

    expect(
      await screen.findByText(/No se pudieron guardar los precios nuevos/),
    ).toBeInTheDocument();
    expect(readPlans()[0]).toEqual(plan);
  });

  it('descartar no cambia nada', async () => {
    stubApi(arrozUp());
    const plan = stored(municipio);
    renderAt(plan.id);
    update();

    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));

    expect(screen.queryByText(/antes \$2\.190/)).not.toBeInTheDocument();
    noSaveButton();
    expect(readPlans()[0]).toEqual(plan);
  });

  it('con ubicación negada lo dice y no consulta ni rompe nada', async () => {
    stubLocation('deny');
    const { requested } = stubApi(unchanged());
    renderAt(stored().id);
    update();

    expect(
      await screen.findByText('No pudimos obtener tu ubicación; arma el plan de nuevo'),
    ).toBeInTheDocument();
    expect(requested).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Actualizar precios' })).toBeEnabled();
  });

  it('si la consulta falla, avisa con Reintentar y no cambia el plan', async () => {
    const failure = { status: 500, body: { code: 'INTERNAL', message: 'Error.' } };
    stubApi({
      'GET /v1/products/p1/comparison': [failure, reply('p1', priced(S1, 'pr1', 2350))],
      'GET /v1/products/p2/comparison': [failure, reply('p2', priced(S2, 'pr2', 9000))],
    });
    const plan = stored(municipio);
    renderAt(plan.id);
    update();

    expect(await screen.findByText(/No pudimos consultar los precios/)).toBeInTheDocument();
    expect(readPlans()[0]).toEqual(plan);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText(/ahora \$2\.350/)).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos consultar/)).not.toBeInTheDocument();
  });

  it('sin conexión, los dos botones quedan deshabilitados y ligados a un solo texto', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderAt(stored(municipio).id);

    const text = screen.getByText('Necesitas conexión para actualizar');
    for (const name of ['Actualizar precios', 'Armar de nuevo con precios de hoy']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription('Necesitas conexión para actualizar');
      expect(button).toHaveAttribute('aria-describedby', text.id);
    }
  });

  it('un plan sin productos con precio no tiene nada que actualizar', async () => {
    const { requested } = stubApi({});
    const unpriced = planDraft().lines.map((l) => ({
      ...l,
      storeId: null,
      priceCop: null,
      observedAt: null,
    }));
    renderAt(stored({ ...municipio, lines: unpriced }).id);
    update();

    expect(await screen.findByText(/no tiene productos con precio/)).toBeInTheDocument();
    expect(requested).toHaveLength(0);
  });

  it('no tiene fallas graves de accesibilidad con las diferencias a la vista', async () => {
    stubApi(arrozUp());
    renderAt(stored(municipio).id);
    update();
    await saveButton();
    // Axe es lento (más con la cobertura): se ejecuta una sola vez, no dentro de un waitFor de 1 s.
    expect(await seriousViolations()).toEqual([]);
  }, 20_000);
});
