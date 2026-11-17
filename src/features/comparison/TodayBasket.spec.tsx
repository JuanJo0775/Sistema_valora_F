import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FakeReply, stubApi, stubPendingApi } from '../../test/fakeApi';
import { TodayBasket } from './TodayBasket';

const RICE_ID = '7f4e3d2c-1b0a-4c9d-8e7f-6a5b4c3d2e1f';

const featured = (name: string, extra: Record<string, unknown> = {}) => ({
  productId: crypto.randomUUID(),
  name,
  category: { code: 'granos', name: 'Granos y cereales' },
  storeCount: 4,
  cheapest: {
    presentationId: crypto.randomUUID(),
    label: `${name} · 500 g`,
    priceCop: 2000,
    unitPrice: { valueCop: 400, per: '100g' },
    establishment: { id: crypto.randomUUID(), name: 'Ara' },
  },
  ...extra,
});

const basket = (...items: unknown[]): FakeReply => ({
  status: 200,
  body: { criteria: { municipality: 'armenia', sort: 'store_count' }, items },
});

const renderBasket = (routes: Record<string, FakeReply | FakeReply[]>) => {
  const api = stubApi(routes);
  render(
    <MemoryRouter>
      <TodayBasket />
    </MemoryRouter>,
  );
  return api;
};

const asked = (api: ReturnType<typeof stubApi>) =>
  api.requested.filter(({ pathname }) => pathname === '/v1/featured-products').at(-1)?.searchParams;

describe('canasta básica de hoy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('muestra cada producto desde su precio más bajo, dónde y en cuántas tiendas hay precio', async () => {
    const api = renderBasket({
      'GET /v1/featured-products': basket(
        featured('Arroz Diana', { productId: RICE_ID, brand: 'Diana' }),
        featured('Leche', { storeCount: 1 }),
      ),
    });

    const rice = within(
      (await screen.findByRole('heading', { name: 'Arroz Diana' })).closest('li') as HTMLElement,
    );
    expect(rice.getByText('Desde $2.000')).toBeInTheDocument();
    expect(rice.getByText('Arroz Diana · 500 g en Ara · $400 por 100 g')).toBeInTheDocument();
    expect(rice.getByText('Con precio en 4 tiendas')).toBeInTheDocument();
    expect(rice.getByRole('link', { name: /Arroz Diana/ })).toHaveAttribute(
      'href',
      `/productos/${RICE_ID}`,
    );
    const milk = within(
      screen.getByRole('heading', { name: 'Leche' }).closest('li') as HTMLElement,
    );
    expect(milk.getByText('Con precio en 1 tienda')).toBeInTheDocument();
    expect(
      screen.getByText('Los productos con precio en más tiendas de Armenia.'),
    ).toBeInTheDocument();
    expect(asked(api)?.get('municipality')).toBe('armenia');
    expect(asked(api)?.get('limit')).toBe('5');
  });

  it('usa el municipio que se eligió la última vez y se puede cambiar', async () => {
    localStorage.setItem('valora:municipio', 'calarca');
    const api = renderBasket({ 'GET /v1/featured-products': basket(featured('Arroz Diana')) });
    await screen.findByRole('heading', { name: 'Arroz Diana' });
    expect(asked(api)?.get('municipality')).toBe('calarca');

    fireEvent.change(screen.getByRole('combobox', { name: 'Municipio' }), {
      target: { value: 'montenegro' },
    });

    await vi.waitFor(() => {
      expect(asked(api)?.get('municipality')).toBe('montenegro');
    });
    expect(localStorage.getItem('valora:municipio')).toBe('montenegro');
  });

  it('«Ver más» trae más productos', async () => {
    const five = ['Arroz', 'Leche', 'Huevos', 'Azúcar', 'Aceite'].map((name) => featured(name));
    const api = renderBasket({
      'GET /v1/featured-products': [basket(...five), basket(...five, featured('Panela'))],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Ver más' }));

    expect(await screen.findByRole('heading', { name: 'Panela' })).toBeInTheDocument();
    expect(asked(api)?.get('limit')).toBe('20');
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('con menos de 5 productos no ofrece «Ver más»', async () => {
    renderBasket({ 'GET /v1/featured-products': basket(featured('Arroz Diana')) });

    await screen.findByRole('heading', { name: 'Arroz Diana' });

    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('sin precios en el municipio lo dice', async () => {
    renderBasket({ 'GET /v1/featured-products': basket() });

    expect(
      await screen.findByText('Todavía no hay precios en Armenia. Registra el primero.'),
    ).toBeInTheDocument();
  });

  it('mientras carga dice «Cargando…»', () => {
    stubPendingApi();
    render(
      <MemoryRouter>
        <TodayBasket />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('si falla muestra el error y permite reintentar', async () => {
    renderBasket({
      'GET /v1/featured-products': [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        basket(featured('Arroz Diana')),
      ],
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Arroz Diana' })).toBeInTheDocument();
  });
});
