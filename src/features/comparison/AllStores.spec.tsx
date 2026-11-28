import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seriousViolations } from '../../test/axe';
import { type FakeReply, stubApi, stubPendingApi } from '../../test/fakeApi';
import { stubLocation, stubNoGeolocation } from '../../test/location';
import type { components } from '../../shared/api/schema';
import { type Session, type SessionState, SessionContext } from '../auth/session';
import { AllStores } from './AllStores';

const rice = {
  id: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  name: 'Arroz blanco',
  brand: 'Diana',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [
    { id: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b', quantity: 500, unit: 'g', packCount: 1 },
    { id: '0b3f8d21-2c3e-4f40-9b0c-1d2e3f4a5b6c', quantity: 1, unit: 'kg', packCount: 1 },
  ],
};

const store = (id: string, name: string) => ({
  id,
  name,
  type: 'barrio',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
});

const result = (overrides: Record<string, unknown> = {}) => ({
  establishment: store('5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d', 'Tienda Don Pepe'),
  reportId: '7e6d5c4b-3a29-4180-9f7e-6d5c4b3a2918',
  presentationId: rice.presentations[0]?.id,
  priceCop: 2000,
  unitPrice: { valueCop: 400, per: '100g' },
  source: 'comunidad',
  freshness: 'vigente',
  reliability: 'alta',
  confirmations: 2,
  isCheapest: false,
  observedAt: new Date().toISOString(),
  ...overrides,
});

const comparison = (results: unknown[], criteria: Record<string, unknown> = {}) => ({
  status: 200,
  body: {
    productId: rice.id,
    criteria: { sort: 'unit_price', municipality: 'armenia', ...criteria },
    results,
    promotions: [],
  },
});

const stubCompare = (reply: FakeReply | FakeReply[]) =>
  stubApi({
    [`GET /v1/products/${rice.id}`]: { status: 200, body: rice },
    [`GET /v1/products/${rice.id}/comparison`]: reply,
  });

// La última consulta que hizo la pantalla a la comparación.
const lastAsked = (api: ReturnType<typeof stubApi>) =>
  api.requested.filter(({ pathname }) => pathname.endsWith('/comparison')).at(-1);

const renderCompare = () =>
  render(
    <MemoryRouter>
      <AllStores product={rice as components['schemas']['Product']} />
    </MemoryRouter>,
  );

// El contexto de sesión por defecto queda «cargando»: para ver lo que ofrece a una persona sin
// sesión hay que darlo explícito.
const renderCompareAs = (session: Session) =>
  render(
    <SessionContext.Provider value={{ session } as SessionState}>
      <MemoryRouter>
        <AllStores product={rice as components['schemas']['Product']} />
      </MemoryRouter>
    </SessionContext.Provider>,
  );

// El chip «dónde buscar» abre la elección del municipio, la ubicación y el radio.
const openWhere = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /^Dónde buscar/ }));
};

describe('todas las tiendas, en el detalle del producto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('identifica el oficial y muestra la discrepancia junto a la mediana reportada', async () => {
    stubCompare(
      comparison([
        result({
          reportId: undefined,
          reliability: undefined,
          source: 'oficial',
          establishment: store('of', 'Tienda Oficial'),
        }),
        result({
          discrepancy: {
            officialPriceCop: 1800,
            reportedPriceCop: 2000,
            reports: 2,
            since: '2026-11-20T12:00:00Z',
          },
        }),
      ]),
    );
    renderCompare();
    const official = (await screen.findByRole('heading', { name: 'Tienda Oficial' })).closest('li');
    expect(official).toHaveTextContent('Precio oficial');
    expect(official).not.toHaveTextContent(/Marcar|Confiabilidad/);
    expect(await screen.findByText(/Oficial \$1.800 · Reportado \$2.000/)).toBeInTheDocument();
    expect(screen.getByText(/2 reportes desde el 20 nov/)).toBeInTheDocument();
  });

  it('solo ofrece marcar un precio de la comunidad, nunca un dato inicial', async () => {
    stubCompare(
      comparison([
        result({ establishment: store('comunidad', 'Tienda Comunidad') }),
        result({
          source: 'siembra',
          reliability: 'baja',
          confirmations: 0,
          establishment: store('inicial', 'Tienda Inicial'),
        }),
      ]),
    );
    renderCompareAs({ status: 'anonymous' });

    const community = (await screen.findByRole('heading', { name: 'Tienda Comunidad' })).closest(
      'li',
    );
    const initial = (await screen.findByRole('heading', { name: 'Tienda Inicial' })).closest('li');
    expect(
      within(community as HTMLElement).getByText('¿Este precio está mal?'),
    ).toBeInTheDocument();
    // Aunque la API todavía mande un reportId, un dato inicial no es un reporte (ADR-028): marcarlo
    // responde 404 «Recurso no encontrado».
    expect(within(initial as HTMLElement).queryByText('¿Este precio está mal?')).toBeNull();
  });

  it('muestra las promociones aparte sin cambiar el orden de las ofertas', async () => {
    const reply = comparison([
      result({ establishment: store('a', 'Tienda A') }),
      result({ reportId: 'otro', establishment: store('b', 'Tienda B') }),
    ]);
    stubCompare({
      ...reply,
      body: {
        ...reply.body,
        promotions: [
          {
            id: 'promo',
            establishment: store('b', 'Tienda B'),
            presentationId: rice.presentations[0]?.id,
            type: 'pague_x_lleve_y',
            takeY: 3,
            payX: 2,
            officialPriceCop: 2000,
            promotedPriceCop: 1333,
            conditions: { paymentMethod: 'efectivo', maxPerCustomer: 2, whileStocksLast: true },
            validFrom: '2026-11-20',
            validUntil: '2026-11-25',
          },
        ],
      },
    });
    const { container } = renderCompare();
    const region = await screen.findByRole('region', { name: 'Promociones' });
    expect(region).toHaveTextContent('Lleve 3, pague 2');
    expect(region).toHaveTextContent('Antes $2.000');
    expect(region).toHaveTextContent('$1.333 por unidad en promedio');
    expect(region).toHaveTextContent('Solo efectivo');
    expect(region).toHaveTextContent('Hasta agotar existencias');
    expect(
      [...container.querySelectorAll('ol.offer-list h3')].map((heading) => heading.textContent),
    ).toEqual(['Tienda A', 'Tienda B']);
    expect(region.closest('ol')).toBeNull();
    expect(await seriousViolations(region)).toEqual([]);
  });

  it('cada resultado dice la tienda, la presentación con su precio y el precio por unidad', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    const [row] = await screen.findAllByRole('listitem');
    const item = within(row as HTMLElement);
    expect(item.getByRole('heading', { name: 'Tienda Don Pepe' })).toBeInTheDocument();
    expect(row).toHaveTextContent('$2.000');
    expect(row).toHaveTextContent('500 g · $400 por 100 g');
  });

  it('cada precio dice su vigencia, su confiabilidad, su fuente y si es el más barato', async () => {
    stubCompare(
      comparison([
        result({ isCheapest: true }),
        result({
          reportId: '8f7e6d5c-4b3a-4291-8a0f-7e6d5c4b3a29',
          establishment: store('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'Minimercado La 14'),
          priceCop: 4400,
          unitPrice: { valueCop: 440, per: '100g' },
          presentationId: rice.presentations[1]?.id,
          reliability: 'media',
        }),
      ]),
    );

    renderCompare();

    const [cheapest, other] = await screen.findAllByRole('listitem');
    expect(cheapest).toHaveTextContent('Más barato');
    expect(cheapest).toHaveTextContent('Hoy');
    expect(cheapest).toHaveTextContent('Confiabilidad alta');
    expect(cheapest).toHaveTextContent('Comunidad');
    expect(other).not.toHaveTextContent('Más barato');
    expect(other).toHaveTextContent('Confiabilidad media');
  });

  it('si la API trae la dirección de la tienda, la fila la muestra para distinguir tiendas homónimas', async () => {
    stubCompare(
      comparison([
        result({
          establishment: {
            ...store('5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d', 'D1'),
            address: 'Cra 14 # 5-20',
          },
        }),
        result({
          reportId: '8f7e6d5c-4b3a-4291-8a0f-7e6d5c4b3a29',
          establishment: store('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'D1'),
        }),
      ]),
    );

    renderCompare();

    const [first, second] = await screen.findAllByRole('listitem');
    expect(first).toHaveTextContent('Cra 14 # 5-20');
    expect(second).not.toHaveTextContent('Cra');
  });

  it('«Dato inicial» es informativo (neutro) y «Confiabilidad baja» no es roja', async () => {
    stubCompare(comparison([result({ source: 'siembra', reliability: 'baja' })]));

    renderCompare();

    const [row] = await screen.findAllByRole('listitem');
    const item = within(row as HTMLElement);
    expect(item.getByText(/^Dato inicial · /)).toHaveClass('pill', 'mute');
    expect(item.getByText('Confiabilidad baja')).not.toHaveClass('bad');
  });

  it('un dato inicial no se ve como «Hoy» en verde: dice «Dato inicial · fecha» en neutro', async () => {
    stubCompare(comparison([result({ source: 'siembra', reliability: 'baja' })]));

    renderCompare();

    const [found] = await screen.findAllByRole('listitem');
    const row = found as HTMLElement;
    expect(row).not.toHaveTextContent('Hoy');
    expect(row.querySelector('.pill.ok')).toBeNull();
    expect(within(row).getByText(/^Dato inicial · \d{1,2} [a-z]{3}$/)).toHaveClass('mute');
  });

  it('un dato inicial por confirmar conserva su advertencia de vigencia', async () => {
    stubCompare(comparison([result({ source: 'siembra', freshness: 'por_confirmar' })]));

    renderCompare();

    const [row] = await screen.findAllByRole('listitem');
    const item = within(row as HTMLElement);
    expect(item.getByText(/^Por confirmar/)).toBeInTheDocument();
    expect(item.getByText('Dato inicial')).toBeInTheDocument();
  });

  it('explica «Dato inicial» y «Confiabilidad baja» en una ayuda que se abre con el teclado', async () => {
    stubCompare(comparison([result({ source: 'siembra', reliability: 'baja' })]));

    renderCompare();

    const help = await screen.findByText('¿Qué significan estas etiquetas?');
    expect(help.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(help);
    expect(help.closest('details')).toHaveAttribute('open');
    expect(screen.getByText(/precio de referencia que cargó Valora/)).toBeVisible();
    expect(screen.getByText(/Sube cuando otras personas lo confirman/)).toBeVisible();
  });

  it('sin datos iniciales ni confiabilidad baja no hay ayuda de etiquetas', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    await screen.findByRole('listitem');
    expect(screen.queryByText('¿Qué significan estas etiquetas?')).not.toBeInTheDocument();
  });

  it('el filtro «Solo precios vigentes» va arriba de la lista que filtra', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    const list = await screen.findByRole('list');
    const filter = screen.getByRole('checkbox', { name: 'Solo precios vigentes' });
    expect(filter.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('el orden por precio dice qué significa y que el precio grande es el total', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    expect(await screen.findByText(/el precio grande es el total/)).toBeInTheDocument();
  });

  it('un empate no se numera como posiciones distintas y las tiendas homónimas se distinguen', async () => {
    const same = {
      priceCop: 4600,
      unitPrice: { valueCop: 460, per: '100g' },
      isCheapest: true,
    };
    stubCompare(
      comparison([
        result({
          ...same,
          establishment: {
            ...store('5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d', 'Carulla'),
            address: 'Avenida Centenario',
          },
        }),
        result({
          ...same,
          reportId: '8f7e6d5c-4b3a-4291-8a0f-7e6d5c4b3a29',
          establishment: {
            ...store('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'Carulla'),
            distanceM: 1300,
          },
        }),
        result({
          ...same,
          reportId: '9a8f7e6d-5c4b-4392-8b1a-8f7e6d5c4b3a',
          establishment: store('7f4e3d2c-1b0a-4c9d-8e8f-7a6b5c4d3e2f', 'Carulla'),
        }),
        result({
          reportId: 'ab9a8f7e-6d5c-4493-8c2b-9a8f7e6d5c4b',
          establishment: store('80f5e4d3-2c1b-4d0e-9f9a-8b7c6d5e4f30', 'D1'),
          priceCop: 5000,
          unitPrice: { valueCop: 500, per: '100g' },
        }),
      ]),
    );

    renderCompare();

    const rows = await screen.findAllByRole('listitem');
    const ranks = rows.map((row) => row.querySelector('.rank')?.textContent);
    expect(ranks).toEqual(['1', '1', '1', '4']);
    expect(rows[1]).toHaveTextContent('Sin dirección registrada · a 1,3 km');
    expect(rows[2]).toHaveTextContent('Sin dirección registrada');
    expect(rows[3]).not.toHaveTextContent('Sin dirección');
  });

  it.each([
    [
      { sort: 'unit_price', municipality: 'armenia' },
      'Ordenado por precio por unidad · en Armenia',
    ],
    [{ sort: 'recent', municipality: 'calarca' }, 'Ordenado por los más recientes · en Calarcá'],
    [
      { sort: 'distance', municipality: undefined, radiusKm: 1.5 },
      'Ordenado por distancia · a menos de 1,5 km de ti',
    ],
  ])('dice el criterio que declaró la API (%o)', async (criteria, text) => {
    stubCompare(comparison([result()], criteria));

    renderCompare();

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('el chip dice dónde se busca y abre la elección del municipio o la ubicación', async () => {
    stubCompare(comparison([result()]));
    renderCompare();
    const chip = await screen.findByRole('button', { name: 'Dónde buscar: Armenia' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox', { name: 'Municipio' })).not.toBeInTheDocument();

    fireEvent.click(chip);

    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Municipio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeInTheDocument();
  });

  it('dice que ningún comercio paga por aparecer primero y numera las tiendas en orden', async () => {
    stubCompare(
      comparison([
        result({ isCheapest: true }),
        result({
          reportId: '8f7e6d5c-4b3a-4291-8a0f-7e6d5c4b3a29',
          establishment: store('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'Minimercado La 14'),
          unitPrice: { valueCop: 450, per: '100g' },
        }),
      ]),
    );

    renderCompare();

    expect(
      await screen.findByText(/Ningún comercio paga por aparecer primero\./),
    ).toBeInTheDocument();
    const [first, second] = screen.getAllByRole('listitem');
    expect(first).toHaveTextContent(/^1/);
    expect(second).toHaveTextContent(/^2/);
  });

  it('ordenar por los más recientes vuelve a pedir la comparación con ese criterio', async () => {
    const api = stubCompare([comparison([result()]), comparison([result()], { sort: 'recent' })]);
    renderCompare();
    await screen.findByText('Ordenado por precio por unidad · en Armenia');

    fireEvent.click(screen.getByRole('radio', { name: 'Más reciente' }));

    expect(
      await screen.findByText('Ordenado por los más recientes · en Armenia'),
    ).toBeInTheDocument();
    const asked = api.requested.filter(({ pathname }) => pathname.endsWith('/comparison'));
    expect(asked.at(-1)?.searchParams.get('sort')).toBe('recent');
    expect(screen.getByRole('radio', { name: 'Más cerca' })).toBeEnabled();
  });

  it('«Usar mi ubicación» compara cerca de ti, dice la distancia y permite ordenar por ella', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison(
        [
          result({
            establishment: {
              ...store('5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d', 'Tienda Don Pepe'),
              distanceM: 350,
            },
          }),
        ],
        { municipality: undefined, radiusKm: 1.5 },
      ),
    ]);
    stubLocation();
    renderCompare();

    await openWhere();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(
      await screen.findByText('Ordenado por precio por unidad · a menos de 1,5 km de ti'),
    ).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('350 m');
    expect(screen.getByRole('radio', { name: 'Más cerca' })).toBeEnabled();
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('lat')).toBe('4.53');
    expect(asked?.searchParams.has('municipality')).toBe(false);
  });

  it('si se niega la ubicación lo dice y sigue comparando en Armenia', async () => {
    stubCompare(comparison([result()]));
    stubNoGeolocation();
    renderCompare();

    await openWhere();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Activa la ubicación del navegador para ver las tiendas cercanas.',
    );
    expect(screen.getByText('Ordenado por precio por unidad · en Armenia')).toBeInTheDocument();
  });

  it('«Solo precios vigentes» vuelve a pedir la comparación sin los viejos', async () => {
    const api = stubCompare(comparison([result()]));
    renderCompare();
    await screen.findByRole('listitem');

    fireEvent.click(screen.getByRole('checkbox', { name: 'Solo precios vigentes' }));

    await vi.waitFor(() => {
      const asked = lastAsked(api);
      expect(asked?.searchParams.get('onlyCurrent')).toBe('true');
    });
  });

  it('los precios desactualizados o en revisión van aparte, porque no compiten', async () => {
    stubCompare(
      comparison([
        result(),
        result({
          reportId: '8f7e6d5c-4b3a-4291-8a0f-7e6d5c4b3a29',
          establishment: store('6e3d2c1b-0a9f-4b8c-9d7e-6f5a4b3c2d1e', 'Minimercado La 14'),
          freshness: 'desactualizado',
        }),
        result({
          reportId: '9a8f7e6d-5c4b-43a2-9b1a-8f7e6d5c4b3a',
          establishment: store('7f4e3d2c-1b0a-4c9d-8e7f-6a5b4c3d2e1f', 'Supermercado Éxito'),
          reliability: 'en_revision',
        }),
      ]),
    );

    renderCompare();

    const [current, old] = await screen.findAllByRole('list');
    expect(within(current as HTMLElement).getAllByRole('listitem')).toHaveLength(1);
    expect(
      screen.getByRole('heading', { name: 'Precios viejos o en revisión' }),
    ).toBeInTheDocument();
    expect(old).toHaveTextContent('Minimercado La 14');
    expect(old).toHaveTextContent('Supermercado Éxito');
  });

  it('«Cómo llegar» abre la app de mapas con las coordenadas de la tienda', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    const link = await screen.findByRole('link', { name: 'Cómo llegar a Tienda Don Pepe' });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/dir/?api=1&destination=4.5339%2C-75.6811',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('mientras llega la comparación dice «Cargando…»', () => {
    stubPendingApi();

    renderCompare();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
    expect(document.querySelectorAll('.skeleton-offer').length).toBeGreaterThan(0);
  });

  it('sin precios lo dice e invita a registrar el primero', async () => {
    stubCompare(comparison([]));

    renderCompare();

    expect(
      await screen.findByRole('heading', {
        name: 'Todavía nadie ha reportado este producto en Armenia',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar un precio' })).toHaveAttribute(
      'href',
      `/registrar?producto=${rice.id}`,
    );
  });

  it('si la comparación falla muestra el error y «Reintentar» la vuelve a pedir', async () => {
    stubCompare([
      { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
      comparison([result()]),
    ]);
    renderCompare();

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Tienda Don Pepe' })).toBeInTheDocument();
  });

  // H-08: sin conexión, lo último que se vio de este producto en este municipio.
  describe('sin conexión', () => {
    const goOffline = () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      act(() => {
        window.dispatchEvent(new Event('offline'));
      });
    };
    // La primera consulta responde; las siguientes no llegan (sin red).
    const dropNetwork = () => {
      let served = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((input: Request) => {
          if (!input.url.includes('/comparison')) {
            return Promise.resolve(new Response('{}', { status: 404 }));
          }
          if (served) return Promise.reject(new TypeError('Failed to fetch'));
          served = true;
          return Promise.resolve(
            new Response(JSON.stringify(comparison([result()]).body), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }),
          );
        }),
      );
    };

    afterEach(() => {
      vi.restoreAllMocks();
      localStorage.clear();
    });

    it('muestra la última comparación vista, con hace cuánto, en un solo mensaje', async () => {
      localStorage.clear();
      dropNetwork();
      const first = renderCompare();
      expect(await screen.findByRole('heading', { name: 'Tienda Don Pepe' })).toBeInTheDocument();
      first.unmount();

      goOffline();
      renderCompare();

      expect(await screen.findByRole('heading', { name: 'Tienda Don Pepe' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        /Sin conexión: te mostramos lo último que viste \(hace un momento\)/,
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });

    it('sin nada guardado dice que la pantalla necesita internet', async () => {
      localStorage.clear();
      goOffline();
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
      );
      renderCompare();

      expect(
        await screen.findByText('Sin conexión: esta pantalla necesita internet.', { exact: false }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
    });

    it('con la ubicación no se guarda nada en el teléfono (EC-08)', async () => {
      localStorage.clear();
      stubLocation();
      stubCompare([
        comparison([result()]),
        comparison([result()], { municipality: undefined, radiusKm: 1.5 }),
      ]);
      renderCompare();
      await screen.findByRole('heading', { name: 'Tienda Don Pepe' });
      localStorage.clear();
      await openWhere();
      fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
      await screen.findByText(/a menos de 1,5 km de ti/);

      expect(localStorage.getItem('valora:comparaciones')).toBeNull();
    });
  });

  // #15: comparar en cualquier municipio del Quindío, sin pedir la ubicación (EC-08).
  it('se elige el municipio y la comparación se hace allí', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([result()], { municipality: 'calarca' }),
    ]);
    renderCompare();
    await openWhere();
    const where = await screen.findByRole('listbox', { name: 'Municipio' });
    expect(within(where).getAllByRole('option')).toHaveLength(12);

    fireEvent.click(within(where).getByRole('option', { name: 'Calarcá' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(
      await screen.findByText('Ordenado por precio por unidad · en Calarcá'),
    ).toBeInTheDocument();
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('municipality')).toBe('calarca');
  });

  it('con la ubicación se elige el radio y la comparación lo usa', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([result()], { municipality: undefined, radiusKm: 1.5 }),
      comparison([result()], { municipality: undefined, radiusKm: 0.5 }),
    ]);
    stubLocation();
    renderCompare();
    await openWhere();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    expect(await screen.findByRole('radio', { name: '1,5 km' })).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: '0,5 km' }));

    expect(
      await screen.findByText('Ordenado por precio por unidad · a menos de 0,5 km de ti'),
    ).toBeInTheDocument();
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('radiusKm')).toBe('0.5');
  });

  it('con la barra del radio la comparación pide solo el valor final', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([result()], { municipality: undefined, radiusKm: 1.5 }),
      comparison([result()], { municipality: undefined, radiusKm: 2.4 }),
    ]);
    stubLocation();
    renderCompare();
    await openWhere();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    const slider = await screen.findByRole('slider', { name: 'Radio' });
    await screen.findByText('Ordenado por precio por unidad · a menos de 1,5 km de ti');
    const before = api.requested.length;

    fireEvent.change(slider, { target: { value: '2' } });
    fireEvent.change(slider, { target: { value: '2.4' } });
    expect(api.requested).toHaveLength(before);
    fireEvent.pointerUp(slider);

    expect(
      await screen.findByText('Ordenado por precio por unidad · a menos de 2,4 km de ti'),
    ).toBeInTheDocument();
    expect(api.requested).toHaveLength(before + 1);
    expect(lastAsked(api)?.searchParams.get('radiusKm')).toBe('2.4');
  });

  it('con la ubicación no se elige municipio, y se puede volver a comparar por municipio', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([result()], { municipality: undefined, radiusKm: 1.5 }),
      comparison([result()]),
    ]);
    stubLocation();
    renderCompare();
    await openWhere();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    await screen.findByRole('radiogroup', { name: 'Radio de búsqueda' });
    expect(screen.getByRole('button', { name: /^Dónde buscar: Cerca de mí/ })).toBeInTheDocument();
    for (const option of screen.getAllByRole('option')) {
      expect(option).toHaveAttribute('aria-selected', 'false');
    }

    fireEvent.click(screen.getByRole('option', { name: 'Armenia' }));

    expect(
      await screen.findByRole('button', { name: 'Dónde buscar: Armenia' }),
    ).toBeInTheDocument();
    const asked = lastAsked(api);
    expect(asked?.searchParams.has('lat')).toBe(false);
  });

  const near = (name: string, distanceM: number) =>
    result({
      reportId: crypto.randomUUID(),
      establishment: {
        ...store(crypto.randomUUID(), name),
        distanceM,
      },
    });
  const located = { municipality: undefined, radiusKm: 1.5 };

  it('sin ubicación, «Más cerca» la pide y, al recibirla, ordena por distancia', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([near('Lejana', 900), near('Cercana', 120)], { ...located, sort: 'distance' }),
    ]);
    stubLocation();
    renderCompare();
    await screen.findByText('Ordenado por precio por unidad · en Armenia');
    const closer = screen.getByRole('radio', { name: 'Más cerca' });
    expect(closer).toBeEnabled();

    fireEvent.click(closer);

    expect(
      await screen.findByText('Ordenado por distancia · a menos de 1,5 km de ti'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Más cerca' })).toBeChecked();
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('sort')).toBe('distance');
    expect(asked?.searchParams.get('lat')).toBe('4.53');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Lejana');
  });

  it('sin ubicación y con el permiso negado avisa qué hacer y conserva el orden', async () => {
    const api = stubCompare(comparison([result()]));
    stubNoGeolocation();
    renderCompare();
    await screen.findByText('Ordenado por precio por unidad · en Armenia');

    fireEvent.click(screen.getByRole('radio', { name: 'Más cerca' }));

    expect(
      (await screen.findAllByRole('alert')).map((alert) => alert.textContent).join(' '),
    ).toContain('Activa la ubicación del navegador para ordenar por distancia.');
    expect(screen.getByRole('radio', { name: 'Más barato' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Más cerca' })).not.toBeChecked();
    expect(lastAsked(api)?.searchParams.get('sort')).toBe('unit_price');
  });

  it('con la ubicación activa, «Más cerca» ordena por distancia al instante', async () => {
    const api = stubCompare([
      comparison([result()]),
      comparison([near('Cercana', 120)], { ...located, sort: 'unit_price' }),
      comparison([near('Cercana', 120)], { ...located, sort: 'distance' }),
    ]);
    stubLocation();
    renderCompare();
    await openWhere();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    await screen.findByText('Ordenado por precio por unidad · a menos de 1,5 km de ti');

    fireEvent.click(screen.getByRole('radio', { name: 'Más cerca' }));

    expect(
      await screen.findByText('Ordenado por distancia · a menos de 1,5 km de ti'),
    ).toBeInTheDocument();
    expect(lastAsked(api)?.searchParams.get('sort')).toBe('distance');
  });

  it('si el backend responde 400 al ordenar por distancia, la pantalla lo dice y no se rompe', async () => {
    stubCompare([
      comparison([result()]),
      {
        status: 400,
        body: { code: 'VALIDATION_ERROR', message: 'Para ordenar por distancia envía lat y lng.' },
      },
    ]);
    stubLocation();
    renderCompare();
    await screen.findByText('Ordenado por precio por unidad · en Armenia');

    fireEvent.click(screen.getByRole('radio', { name: 'Más cerca' }));

    expect(
      await screen.findByText('Para ordenar por distancia envía lat y lng.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Ordenar por' })).toBeInTheDocument();
  });

  it('al volver al municipio, el orden por distancia pasa a precio por unidad', async () => {
    const api = stubCompare(comparison([result()]));
    stubLocation();
    renderCompare();
    await openWhere();
    fireEvent.click(await screen.findByRole('button', { name: 'Usar mi ubicación' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Más cerca' }));

    fireEvent.click(screen.getByRole('option', { name: 'Armenia' }));

    await screen.findByRole('button', { name: 'Dónde buscar: Armenia' });
    const asked = lastAsked(api);
    expect(asked?.searchParams.get('sort')).toBe('unit_price');
  });

  it('recuerda el municipio elegido para la próxima vez', async () => {
    stubCompare(comparison([result()]));
    const first = renderCompare();
    await openWhere();
    fireEvent.click(await screen.findByRole('option', { name: 'Calarcá' }));
    first.unmount();

    renderCompare();
    await openWhere();

    expect(await screen.findByRole('option', { name: 'Calarcá' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  // #16 / RF-014: la referencia mayorista del DANE va aparte; nunca es precio de una tienda.
  const wholesale = {
    source: 'SIPSA (DANE)',
    productName: 'Arroz blanco',
    market: 'Armenia, Mercar',
    pricePerKgCop: 3800,
    periodStart: '2026-11-02',
    periodEnd: '2026-11-08',
    url: 'https://www.dane.gov.co/sipsa/boletin.pdf',
  };

  it('la referencia mayorista SIPSA va aparte, fuera de la lista de tiendas', async () => {
    stubCompare({
      status: 200,
      body: { ...comparison([result()]).body, wholesaleReference: wholesale },
    });

    renderCompare();

    const reference = await screen.findByRole('region', { name: 'Referencia mayorista' });
    expect(reference).toHaveTextContent('$3.800 por kilo');
    expect(reference).toHaveTextContent('Armenia, Mercar · del 2 al 8 de noviembre de 2026');
    expect(reference).toHaveTextContent('SIPSA (DANE). No es el precio de una tienda.');
    expect(within(reference).getByRole('link', { name: 'Ver el boletín' })).toHaveAttribute(
      'href',
      wholesale.url,
    );
    const [stores] = screen.getAllByRole('list');
    expect(stores).not.toHaveTextContent('3.800');
  });

  it('sin referencia mayorista no muestra esa sección', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    await screen.findByRole('heading', { name: 'Tienda Don Pepe' });
    expect(screen.queryByRole('region', { name: 'Referencia mayorista' })).not.toBeInTheDocument();
  });

  it('sin precios de tiendas igual muestra la referencia mayorista, con su periodo', async () => {
    stubCompare({
      status: 200,
      body: {
        ...comparison([]).body,
        wholesaleReference: { ...wholesale, periodStart: '2026-10-30', periodEnd: '2026-11-05' },
      },
    });

    renderCompare();

    expect(
      await screen.findByRole('heading', {
        name: 'Todavía nadie ha reportado este producto en Armenia',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Referencia mayorista' })).toHaveTextContent(
      'del 30 de octubre al 5 de noviembre de 2026',
    );
  });

  it('el nombre de cada tienda lleva a su página con todos sus precios', async () => {
    stubCompare(comparison([result()]));

    renderCompare();

    expect(await screen.findByRole('link', { name: 'Tienda Don Pepe' })).toHaveAttribute(
      'href',
      '/tiendas/5d2c1b0a-9e8f-4a7b-8c6d-5e4f3a2b1c0d',
    );
  });
});
