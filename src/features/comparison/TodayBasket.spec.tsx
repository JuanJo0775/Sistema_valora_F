import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi, stubPendingApi } from '../../test/fakeApi';
import { stubLocation } from '../../test/location';
import { BasketProvider } from '../basket/BasketProvider';
import { TodayBasket } from './TodayBasket';

const RICE_ID = '7f4e3d2c-1b0a-4c9d-8e7f-6a5b4c3d2e1f';

const price = (priceCop: number, store: string, extra: Record<string, unknown> = {}) => ({
  presentationId: crypto.randomUUID(),
  label: 'Arroz Diana · 500 g',
  priceCop,
  unitPrice: { valueCop: priceCop / 5, per: '100g' },
  establishment: { id: crypto.randomUUID(), name: store },
  ...extra,
});

const featured = (name: string, extra: Record<string, unknown> = {}) => ({
  productId: crypto.randomUUID(),
  name,
  category: { code: 'granos', name: 'Granos' },
  storeCount: 4,
  cheapest: price(2000, 'Ara', { label: `${name} · 500 g` }),
  ...extra,
});

const basket = (items: unknown[], extra: Record<string, unknown> = {}): FakeReply => ({
  status: 200,
  body: {
    criteria: { municipality: 'armenia', sort: 'store_count' },
    storesWithPrices: 7,
    items,
    ...extra,
  },
});

const CATEGORIES: FakeReply = {
  status: 200,
  body: {
    items: [
      { code: 'granos', name: 'Granos' },
      { code: 'aceites', name: 'Aceites' },
    ],
  },
};

const renderBasket = (routes: Record<string, FakeReply | FakeReply[]>) => {
  const api = stubApi({ 'GET /v1/categories': CATEGORIES, ...routes });
  render(
    <BasketProvider>
      <MemoryRouter>
        <TodayBasket />
      </MemoryRouter>
    </BasketProvider>,
  );
  return api;
};

const asked = (api: ReturnType<typeof stubApi>) =>
  api.requested.filter(({ pathname }) => pathname === '/v1/featured-products').at(-1)?.searchParams;

const card = async (name: string) =>
  within((await screen.findByRole('heading', { name })).closest('li') as HTMLElement);

describe('canasta básica de hoy, en el Inicio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('la tarjeta con foto la muestra decorativa; sin foto, la ilustración', async () => {
    renderBasket({
      'GET /v1/featured-products': basket([
        featured('Arroz Diana', {
          image: {
            url: 'https://images.openfoodfacts.org/arroz.jpg',
            source: 'open_food_facts',
            attribution: 'Open Food Facts, licencia ODbL',
          },
        }),
        featured('Leche'),
      ]),
    });

    const rice = await card('Arroz Diana');
    const img = document.querySelector('li img');
    expect(img).toHaveAttribute('src', 'https://images.openfoodfacts.org/arroz.jpg');
    // El nombre ya está en texto: el alt vacío no lo duplica.
    expect(img).toHaveAttribute('alt', '');
    expect(rice.queryByRole('img', { name: /Arroz Diana/ })).not.toBeInTheDocument();
    const milk = (await screen.findByRole('heading', { name: 'Leche' })).closest('li');
    expect(milk?.querySelector('img')).toBeNull();
    expect(milk?.querySelector('svg')).toBeInTheDocument();
  });

  it('cada tarjeta dice desde cuánto, en qué tienda, la presentación y el ahorro', async () => {
    renderBasket({
      'GET /v1/featured-products': basket([
        featured('Arroz Diana', {
          productId: RICE_ID,
          savingsPercent: 15,
          cheapest: price(3890, 'Ahorra Más', {
            label: 'Arroz Diana · 1 kg',
            establishment: { id: crypto.randomUUID(), name: 'Ahorra Más', distanceM: 900 },
          }),
        }),
        featured('Leche'),
      ]),
    });

    const rice = await card('Arroz Diana');
    expect(rice.getByText('Hasta −15 %')).toBeInTheDocument();
    expect(rice.getByText('1 kg')).toBeInTheDocument();
    expect(rice.getByText('$3.890')).toBeInTheDocument();
    expect(rice.getByText('Ahorra Más')).toBeInTheDocument();
    expect(rice.getByText('900 m')).toBeInTheDocument();
    expect(rice.getByRole('link', { name: /Arroz Diana/ })).toHaveAttribute(
      'href',
      `/productos/${RICE_ID}`,
    );
    // Sin dos tiendas no hay ahorro que mostrar.
    expect((await card('Leche')).queryByText(/Hasta/)).not.toBeInTheDocument();
  });

  it('dice cuántas tiendas tienen precios y el criterio del orden', async () => {
    const api = renderBasket({ 'GET /v1/featured-products': basket([featured('Arroz')]) });

    expect(await screen.findByText('Precios de 7 tiendas en Armenia.')).toBeInTheDocument();
    expect(
      screen.getByText('Primero los productos con precio en más tiendas.'),
    ).toBeInTheDocument();
    expect(asked(api)?.get('municipality')).toBe('armenia');
    expect(asked(api)?.get('limit')).toBe('6');
  });

  it('con la ubicación muestra las tiendas a 1,5 km de ti, sin enviar el municipio', async () => {
    const api = renderBasket({
      'GET /v1/featured-products': [
        basket([featured('Arroz')]),
        basket([featured('Arroz')], {
          criteria: { radiusKm: 1.5, sort: 'store_count' },
          storesWithPrices: 3,
        }),
      ],
    });
    stubLocation();
    fireEvent.click(await screen.findByRole('button', { name: 'Dónde buscar: Armenia' }));

    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));

    expect(
      await screen.findByText('Precios de 3 tiendas a menos de 1,5 km de ti.'),
    ).toBeInTheDocument();
    expect(asked(api)?.get('lat')).toBe('4.53');
    expect(asked(api)?.get('radiusKm')).toBe('1.5');
    expect(asked(api)?.has('municipality')).toBe(false);
  });

  it('los chips de categoría filtran la canasta', async () => {
    const api = renderBasket({ 'GET /v1/featured-products': basket([featured('Arroz')]) });
    const all = await screen.findByRole('radio', { name: 'Todo' });
    expect(all).toBeChecked();

    fireEvent.click(await screen.findByRole('radio', { name: 'Aceites' }));

    await vi.waitFor(() => {
      expect(asked(api)?.get('category')).toBe('aceites');
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Todo' }));
    await vi.waitFor(() => {
      expect(asked(api)?.has('category')).toBe(false);
    });
  });

  it('«Agregar a la canasta» guarda la presentación más barata y la tarjeta lo dice', async () => {
    const rice = featured('Arroz Diana');
    renderBasket({ 'GET /v1/featured-products': basket([rice]) });
    const item = await card('Arroz Diana');

    fireEvent.click(item.getByRole('button', { name: 'Agregar a la canasta' }));

    expect(item.getByRole('button', { name: 'En tu canasta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const saved = JSON.parse(localStorage.getItem('valora:canasta') ?? '[]') as {
      presentationId: string;
      presentationLabel: string;
    }[];
    expect(saved[0]?.presentationId).toBe(rice.cheapest.presentationId);
    expect(saved[0]?.presentationLabel).toBe('500 g');

    fireEvent.click(item.getByRole('button', { name: 'En tu canasta' }));

    expect(item.getByRole('button', { name: 'Agregar a la canasta' })).toBeInTheDocument();
  });

  it('«Ver más» trae más productos', async () => {
    const six = ['Arroz', 'Leche', 'Huevos', 'Azúcar', 'Aceite', 'Panela'].map((name) =>
      featured(name),
    );
    const api = renderBasket({
      'GET /v1/featured-products': [basket(six), basket([...six, featured('Café')])],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    expect(await screen.findByRole('heading', { name: 'Café' })).toBeInTheDocument();
    expect(asked(api)?.get('limit')).toBe('20');
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  const SIX = ['Arroz', 'Leche', 'Huevos', 'Azúcar', 'Aceite', 'Panela'];

  // Una respuesta que el test suelta cuando quiere, para mirar la pantalla mientras «llega».
  const gate = () => {
    let release: (reply: FakeReply) => void = () => undefined;
    const reply = new Promise<FakeReply>((resolve) => {
      release = resolve;
    });
    return { reply, release };
  };

  it('«Ver más» no vacía la lista: muestra esqueletos y «Cargando…» y agrega abajo', async () => {
    const six = SIX.map((name) => featured(name));
    const next = gate();
    const real = stubApi({
      'GET /v1/categories': CATEGORIES,
      'GET /v1/featured-products': basket(six),
    });
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', (input: Request) =>
      new URL(input.url).searchParams.get('limit') === '20'
        ? next.reply.then((r) => new Response(JSON.stringify(r.body), { status: r.status }))
        : original(input),
    );
    expect(real).toBeDefined();
    render(
      <BasketProvider>
        <MemoryRouter>
          <TodayBasket />
        </MemoryRouter>
      </BasketProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    // Mientras llegan: las 6 siguen, hay 2 esqueletos y el botón no se movió.
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(2);
    const busy = screen.getByRole('button', { name: 'Cargando…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    const first = screen.getByRole('heading', { name: 'Arroz' });

    await act(async () => {
      next.release(basket([...six, featured('Café'), featured('Pan')]));
      await next.reply;
    });

    expect(await screen.findByRole('heading', { name: 'Pan' })).toBeInTheDocument();
    // Las 6 primeras no se volvieron a pintar: es el mismo nodo.
    expect(screen.getByRole('heading', { name: 'Arroz' })).toBe(first);
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(8);
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(0);
    expect(screen.getByText('Se cargaron 2 productos más')).toBeInTheDocument();
    expect(
      (await screen.findByRole('heading', { name: 'Café' })).closest('li')?.querySelector('a'),
    ).toHaveFocus();
  });

  it('cambiar de categoría sí reinicia la lista y muestra el esqueleto', async () => {
    const six = SIX.map((name) => featured(name));
    renderBasket({
      'GET /v1/featured-products': [
        basket(six),
        basket([...six, featured('Café')]),
        { status: 200, pending: true },
      ],
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));
    await screen.findByRole('heading', { name: 'Café' });

    fireEvent.click(screen.getByRole('radio', { name: 'Aceites' }));

    expect(screen.queryByRole('heading', { name: 'Arroz' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(4);
  });

  it('si falla la carga adicional conserva la lista y permite reintentar', async () => {
    const six = SIX.map((name) => featured(name));
    renderBasket({
      'GET /v1/featured-products': [
        basket(six),
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        basket([...six, featured('Café')]),
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Café' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(7);
  });

  it('sin precios lo dice', async () => {
    renderBasket({ 'GET /v1/featured-products': basket([], { storesWithPrices: 0 }) });

    expect(
      await screen.findByText('Todavía no hay precios en Armenia. Registra el primero.'),
    ).toBeInTheDocument();
  });

  it('mientras carga dice «Cargando…»', () => {
    stubPendingApi();
    render(
      <BasketProvider>
        <MemoryRouter>
          <TodayBasket />
        </MemoryRouter>
      </BasketProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(4);
  });

  it('si falla muestra el error y permite reintentar', async () => {
    renderBasket({
      'GET /v1/featured-products': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        basket([featured('Arroz Diana')]),
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Arroz Diana' })).toBeInTheDocument();
  });
});
