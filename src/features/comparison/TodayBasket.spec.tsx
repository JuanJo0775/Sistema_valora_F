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
    // El ahorro cabe en una línea; contra qué compara lo oye el lector de pantalla y sale al pasar el ratón.
    const savings = rice.getByText('Ahorra hasta 15 %');
    expect(savings.closest('.pill')).toHaveAttribute(
      'title',
      'Ahorra hasta 15 % frente a la tienda más cara',
    );
    expect(rice.getByText('frente a la tienda más cara')).toHaveClass('sr-only');
    expect(rice.getByText('1 kg')).toBeInTheDocument();
    expect(rice.getByText('$3.890')).toBeInTheDocument();
    expect(rice.getByText('En Ahorra Más')).toBeInTheDocument();
    expect(rice.getByText('900 m')).toBeInTheDocument();
    expect(rice.getByRole('link', { name: /Arroz Diana/ })).toHaveAttribute(
      'href',
      `/productos/${RICE_ID}`,
    );
    // Sin dos tiendas no hay ahorro que mostrar.
    expect((await card('Leche')).queryByText(/Ahorra hasta/)).not.toBeInTheDocument();
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

  it('cambiar de municipio actualiza la canasta sin recargar, con la misma categoría y el skeleton mientras llega', async () => {
    const api = renderBasket({
      'GET /v1/featured-products': [
        basket([featured('Arroz')]),
        basket([featured('Arroz')]),
        {
          status: 200,
          body: {
            ...(basket([featured('Lenteja')]).body as object),
            criteria: { municipality: 'calarca', sort: 'store_count' },
          },
        },
      ],
    });
    fireEvent.click(await screen.findByRole('radio', { name: 'Aceites' }));
    await vi.waitFor(() => {
      expect(asked(api)?.get('category')).toBe('aceites');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dónde buscar: Armenia' }));
    fireEvent.click(screen.getByRole('option', { name: 'Calarcá' }));

    expect(await screen.findByText('Precios de 7 tiendas en Calarcá.')).toBeInTheDocument();
    expect(asked(api)?.get('municipality')).toBe('calarca');
    expect(asked(api)?.get('category')).toBe('aceites');
    expect(screen.getByRole('radio', { name: 'Aceites' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Dónde buscar: Calarcá' })).toBeInTheDocument();
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

  const NAMES = Array.from({ length: 30 }, (_, index) => `Producto ${String(index + 1)}`);
  const CATALOG = NAMES.map((name) => featured(name));

  // Un servidor que pagina de verdad (offset y limit) sobre CATALOG; «legacy» no trae total ni hasMore.
  const paged = (
    options: { legacy?: boolean; fail?: (offset: number) => boolean; all?: unknown[] } = {},
  ) => {
    const all = options.all ?? CATALOG;
    const asks: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: Request) => {
        const url = new URL(input.url);
        const json = (status: number, body: unknown) =>
          Promise.resolve(
            new Response(JSON.stringify(body), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        if (url.pathname === '/v1/categories') return json(200, CATEGORIES.body);
        asks.push(url);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit'));
        if (options.fail?.(offset)) {
          return json(500, { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' });
        }
        return json(200, {
          ...(basket(all.slice(offset, offset + limit)).body as object),
          ...(options.legacy ? {} : { total: all.length, hasMore: offset + limit < all.length }),
        });
      }),
    );
    render(
      <BasketProvider>
        <MemoryRouter>
          <TodayBasket />
        </MemoryRouter>
      </BasketProvider>,
    );
    return asks;
  };
  const shownCards = () => screen.getAllByRole('heading', { level: 2 });

  it('la primera página trae 6 y dice cuántos hay en total', async () => {
    const asks = paged();

    expect(await screen.findByText('Mostrando 6 de 30')).toBeInTheDocument();
    expect(shownCards()).toHaveLength(6);
    expect(asks[0]?.searchParams.get('limit')).toBe('6');
    expect(asks[0]?.searchParams.has('offset')).toBe(false);
    expect(screen.getByRole('button', { name: 'Ver más · quedan 24' })).toBeInTheDocument();
  });

  it('en pantalla ancha la primera página trae 12', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('900px'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const asks = paged();

    await screen.findByText('Mostrando 12 de 30');
    expect(asks[0]?.searchParams.get('limit')).toBe('12');
  });

  it('«Ver más» pide la página siguiente con offset y acumula sin repetir hasta el final', async () => {
    const asks = paged();

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más · quedan 24' }));

    expect(await screen.findByRole('heading', { name: 'Producto 18' })).toBeInTheDocument();
    expect(asks[1]?.searchParams.get('offset')).toBe('6');
    expect(asks[1]?.searchParams.get('limit')).toBe('12');
    expect(shownCards()).toHaveLength(18);
    expect(
      await screen.findByText('Se cargaron 12 productos más. Mostrando 18 de 30'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver más · quedan 12' }));

    expect(await screen.findByRole('heading', { name: 'Producto 30' })).toBeInTheDocument();
    expect(asks[2]?.searchParams.get('offset')).toBe('18');
    const names = shownCards().map((heading) => heading.textContent);
    expect(new Set(names).size).toBe(30);
    // Al final no hay botón y un mensaje discreto lo dice.
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();
    expect(screen.getByText('Estos son todos los productos con precio')).toBeInTheDocument();
  });

  it('no repite un producto que llega en dos páginas (por productId)', async () => {
    const dup = [...CATALOG.slice(0, 8), CATALOG[5], ...CATALOG.slice(8, 14)];
    paged({ all: dup });

    fireEvent.click(await screen.findByRole('button', { name: /Ver más/ }));

    await screen.findByRole('heading', { name: 'Producto 14' });
    const names = shownCards().map((heading) => heading.textContent);
    expect(names).toHaveLength(14);
    expect(new Set(names).size).toBe(14);
  });

  it('con un servidor sin hasMore ni total deduce por la página llena', async () => {
    const asks = paged({ legacy: true, all: CATALOG.slice(0, 15) });

    // Sin total no hay progreso, pero sí «Ver más».
    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    await screen.findByRole('heading', { name: 'Producto 15' });
    expect(asks).toHaveLength(2);
    // La segunda página (9 de 12) no está llena: no hay más.
    expect(screen.queryByRole('button', { name: /Ver más/ })).not.toBeInTheDocument();
    expect(screen.getByText('Estos son todos los productos con precio')).toBeInTheDocument();
  });

  const SIX = ['Arroz', 'Leche', 'Huevos', 'Azúcar', 'Aceite', 'Panela'];

  it('un servidor que ignora offset no se queda pidiendo lo mismo', async () => {
    renderBasket({ 'GET /v1/featured-products': basket(SIX.map((name) => featured(name))) });

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    expect(await screen.findByText('Estos son todos los productos con precio')).toBeInTheDocument();
    expect(shownCards()).toHaveLength(6);
  });

  // Una respuesta que el test suelta cuando quiere, para mirar la pantalla mientras «llega».
  const gate = () => {
    let release: (reply: FakeReply) => void = () => undefined;
    const reply = new Promise<FakeReply>((resolve) => {
      release = resolve;
    });
    return { reply, release };
  };

  it('«Ver más» no vacía la lista: muestra esqueletos y «Cargando…», agrega abajo, anuncia y deja el foco', async () => {
    const six = SIX.map((name) => featured(name));
    const next = gate();
    stubApi({
      'GET /v1/categories': CATEGORIES,
      'GET /v1/featured-products': basket(six, { total: 8, hasMore: true }),
    });
    const original = globalThis.fetch;
    vi.stubGlobal('fetch', (input: Request) =>
      new URL(input.url).searchParams.get('offset') === '6'
        ? next.reply.then((r) => new Response(JSON.stringify(r.body), { status: r.status }))
        : original(input),
    );
    render(
      <BasketProvider>
        <MemoryRouter>
          <TodayBasket />
        </MemoryRouter>
      </BasketProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más · quedan 2' }));

    // Mientras llegan: las 6 siguen, hay esqueletos y el botón no se movió.
    expect(shownCards()).toHaveLength(6);
    expect(document.querySelectorAll('.skeleton-card').length).toBeGreaterThan(0);
    const busy = screen.getByRole('button', { name: 'Cargando…' });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    const first = screen.getByRole('heading', { name: 'Arroz' });

    await act(async () => {
      next.release(basket([featured('Café'), featured('Pan')], { total: 8, hasMore: false }));
      await next.reply;
    });

    expect(await screen.findByRole('heading', { name: 'Pan' })).toBeInTheDocument();
    // Las 6 primeras no se volvieron a pintar: es el mismo nodo.
    expect(screen.getByRole('heading', { name: 'Arroz' })).toBe(first);
    expect(shownCards()).toHaveLength(8);
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(0);
    expect(screen.getByText('Se cargaron 2 productos más. Mostrando 8 de 8')).toBeInTheDocument();
    expect(
      (await screen.findByRole('heading', { name: 'Café' })).closest('li')?.querySelector('a'),
    ).toHaveFocus();
  });

  it('cambiar de categoría reinicia la lista y muestra el esqueleto', async () => {
    const six = SIX.map((name) => featured(name));
    renderBasket({
      'GET /v1/featured-products': [
        basket(six, { total: 8, hasMore: true }),
        basket([featured('Café'), featured('Pan')], { total: 8, hasMore: false }),
        { status: 200, pending: true },
      ],
    });
    fireEvent.click(await screen.findByRole('button', { name: /Ver más/ }));
    await screen.findByRole('heading', { name: 'Café' });

    fireEvent.click(screen.getByRole('radio', { name: 'Aceites' }));

    expect(screen.queryByRole('heading', { name: 'Arroz' })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(4);
  });

  it('al cambiar de categoría o de municipio vuelve a pedir desde la primera página', async () => {
    const asks = paged();
    fireEvent.click(await screen.findByRole('button', { name: /Ver más/ }));
    await screen.findByRole('heading', { name: 'Producto 18' });

    fireEvent.click(screen.getByRole('radio', { name: 'Aceites' }));

    await vi.waitFor(() => {
      expect(asks.at(-1)?.searchParams.get('category')).toBe('aceites');
    });
    expect(asks.at(-1)?.searchParams.has('offset')).toBe(false);
    expect(asks.at(-1)?.searchParams.get('limit')).toBe('6');
    expect(await screen.findByText('Mostrando 6 de 30')).toBeInTheDocument();
    expect(shownCards()).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: /Ver más/ }));
    await screen.findByRole('heading', { name: 'Producto 18' });
    fireEvent.click(screen.getByRole('button', { name: 'Dónde buscar: Armenia' }));
    fireEvent.click(screen.getByRole('option', { name: 'Calarcá' }));

    await vi.waitFor(() => {
      expect(asks.at(-1)?.searchParams.get('municipality')).toBe('calarca');
    });
    expect(asks.at(-1)?.searchParams.has('offset')).toBe(false);
    expect(asks.at(-1)?.searchParams.get('category')).toBe('aceites');
    expect(await screen.findByText('Mostrando 6 de 30')).toBeInTheDocument();
  });

  it('el chip de la categoría conocida muestra su total, sin pedir más', async () => {
    const asks = paged();

    await screen.findByText('Mostrando 6 de 30');
    expect(await screen.findByRole('radio', { name: /^Todo\s+30$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Aceites' })).toBeInTheDocument();
    expect(asks).toHaveLength(1);
  });

  it('si falla una página siguiente conserva lo visto y permite reintentar', async () => {
    let failing = true;
    paged({ fail: (offset) => offset === 6 && failing });

    fireEvent.click(await screen.findByRole('button', { name: /Ver más/ }));

    expect(await screen.findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    expect(shownCards()).toHaveLength(6);
    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Producto 18' })).toBeInTheDocument();
    expect(shownCards()).toHaveLength(18);
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
