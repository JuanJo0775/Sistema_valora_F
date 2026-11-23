import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { BasketPage } from './BasketPage';
import { BasketProvider } from './BasketProvider';

const RICE = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
const MILK = '4a2d3b75-6d2f-4c9b-8e72-1b8c2f3d4e5f';

const item = (
  productId: string,
  productName: string,
  presentationId: string,
  label: string,
  quantity = 1,
  bought = false,
) => ({
  productId,
  productName,
  presentationId,
  presentationLabel: label,
  quantity,
  bought,
});
const rice = item(RICE, 'Arroz blanco', 'arroz-500g', '500 g', 2);
const milk = item(MILK, 'Leche entera', 'leche-1l', '1 l');

const renderBasket = (...items: ReturnType<typeof item>[]) => {
  localStorage.setItem('valora:canasta', JSON.stringify(items));
  return render(
    <BasketProvider>
      <MemoryRouter>
        <BasketPage />
      </MemoryRouter>
    </BasketProvider>,
  );
};

const shop = (id: string, name: string) => ({
  id,
  name,
  type: 'barrio',
  lat: 4.5339,
  lng: -75.6811,
  municipality: 'armenia',
});
const ara = shop('a1', 'Ara');
const exito = shop('e1', 'Éxito');
const d1 = shop('d1', 'D1');

const offer = (where: ReturnType<typeof shop>, presentationId: string, priceCop: number) => ({
  establishment: where,
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

const where = () => screen.findByRole('complementary', { name: 'Dónde comprar' });

const rowOf = (name: string) => within(screen.getByText(name).closest('li') as HTMLElement);

describe('mi canasta', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('dice que la canasta te dice dónde sale más barata', () => {
    stubApi({});
    renderBasket(rice);

    expect(screen.getByText('Te decimos dónde te sale más barata.')).toBeInTheDocument();
  });

  it('vacía invita a buscar productos', () => {
    stubApi({});
    renderBasket();

    expect(screen.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar productos' })).toHaveAttribute('href', '/');
  });

  it('cada producto se ve con su presentación y su cantidad, y se cambia con − y +', () => {
    stubApi({});
    renderBasket(rice);
    const row = rowOf('Arroz blanco');

    expect(row.getByText('500 g')).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: 'Agregar uno de Arroz blanco' }));
    expect(row.getByText('3')).toBeInTheDocument();
    fireEvent.click(row.getByRole('button', { name: 'Quitar uno de Arroz blanco' }));
    fireEvent.click(row.getByRole('button', { name: 'Quitar uno de Arroz blanco' }));
    fireEvent.click(row.getByRole('button', { name: 'Quitar uno de Arroz blanco' }));

    expect(screen.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeInTheDocument();
  });

  it('la papelera quita el producto de una vez', () => {
    stubApi({});
    renderBasket(rice, milk);

    fireEvent.click(screen.getByRole('button', { name: 'Quitar Arroz blanco de la canasta' }));

    expect(screen.queryByText('Arroz blanco')).not.toBeInTheDocument();
    expect(screen.getByText('Leche entera')).toBeInTheDocument();
  });

  it('el nombre del producto guardado lleva a su página, con una sola entrada para teclado y lectores', () => {
    stubApi({});
    renderBasket(rice, milk);

    expect(screen.getByRole('link', { name: /Arroz blanco/ })).toHaveAttribute(
      'href',
      `/productos/${RICE}`,
    );
    expect(screen.getByRole('link', { name: /Leche entera/ })).toHaveAttribute(
      'href',
      `/productos/${MILK}`,
    );
    // La foto también enlaza, pero es decorativa: no repite el enlace para lectores ni para el teclado.
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('lo comprado se tacha, va al final y se puede quitar', () => {
    stubApi({});
    renderBasket(rice, milk);

    fireEvent.click(rowOf('Arroz blanco').getByRole('checkbox', { name: 'Comprado' }));

    const names = screen
      .getAllByRole('listitem')
      .map((row) => row.querySelector('strong')?.textContent);
    expect(names).toEqual(['Leche entera', 'Arroz blanco']);
    expect(screen.getByText('Arroz blanco').closest('li')).toHaveClass('bought');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar lo comprado' }));
    expect(screen.queryByText('Arroz blanco')).not.toBeInTheDocument();
  });

  it('dice en qué tienda sale más barata toda la canasta y cuánto ahorras', async () => {
    stubApi({
      ...comparisonOf(RICE, offer(ara, 'arroz-500g', 2600), offer(exito, 'arroz-500g', 2400)),
      ...comparisonOf(MILK, offer(ara, 'leche-1l', 4000), offer(exito, 'leche-1l', 3900)),
    });
    renderBasket(rice, milk);

    const panel = await where();

    // Prototipo: «COMPRA TODO EN», la tienda, el total y la píldora del ahorro.
    // La tienda sale en la recomendación, en la tarjeta naranja y en el detalle: aquí, la tarjeta naranja.
    const names = await within(panel).findAllByText('Éxito');
    expect(names.some((name) => name.classList.contains('cheapest-store-name'))).toBe(true);
    expect(within(panel).getByRole('heading', { name: 'Compra todo en' })).toBeInTheDocument();
    expect(panel).toHaveTextContent('$8.700');
    expect(within(panel).getByText('Ahorras $500')).toHaveClass('pill');
    expect(panel).toHaveTextContent('Comparado con la tienda más cara: Ara, $9.200.');
    // Cada producto dice en qué tienda sale más barato.
    expect(await screen.findByText('500 g · Éxito')).toBeInTheDocument();
  });

  it('si ninguna tienda tiene todo, no muestra la tarjeta naranja: el panel avisa qué producto no tiene precio', async () => {
    stubApi({
      ...comparisonOf(RICE, offer(ara, 'arroz-500g', 2600), offer(d1, 'arroz-500g', 2300)),
      ...comparisonOf(MILK, offer(ara, 'leche-1l-otra', 4000)),
    });
    renderBasket(rice, milk);

    const panel = await where();

    expect(
      await within(panel).findByText(/Sin precio vigente cerca: Leche entera/),
    ).toBeInTheDocument();
    expect(within(panel).queryByText('Ninguna tienda tiene todos tus productos.')).toBeNull();
    expect(within(panel).queryByRole('heading', { name: /Dónde te sale más barata/ })).toBeNull();
  });

  it('lo comprado no entra al cálculo', async () => {
    const api = stubApi({
      ...comparisonOf(MILK, offer(ara, 'leche-1l', 4000)),
    });
    renderBasket({ ...rice, bought: true }, milk);

    const names = await within(await where()).findAllByText('Ara');
    expect(names.some((name) => name.classList.contains('cheapest-store-name'))).toBe(true);
    expect(api.requested.map(({ pathname }) => pathname)).toEqual([
      `/v1/products/${MILK}/comparison`,
    ]);
  });

  it('mientras busca los precios dice «Buscando precios…»', async () => {
    stubPendingApi();

    renderBasket(milk);

    expect(within(await where()).getByRole('status')).toHaveTextContent('Buscando precios…');
  });

  it('si los precios no cargan avisa que no se pudo calcular', async () => {
    stubApi({});

    renderBasket(milk);

    expect(
      await within(await where()).findByText('No pudimos calcular dónde te sale más barata.'),
    ).toBeInTheDocument();
  });
});

describe('canasta: claridad', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('la casilla dice para qué sirve, con texto visible y ayuda', () => {
    stubApi({});
    renderBasket(rice);

    const row = rowOf('Arroz blanco');
    expect(row.getByText('Comprado')).not.toHaveClass('sr-only');
    expect(row.getByRole('checkbox', { name: 'Comprado' }).closest('label')).toHaveAttribute(
      'title',
      'Marcar como comprado',
    );
  });

  it('«Compra todo en» dice cuál tienda es, cuántos productos tiene', async () => {
    const withAddress = { ...exito, address: 'Carrera 14 # 5-20' };
    stubApi({
      ...comparisonOf(RICE, offer(withAddress, 'arroz-500g', 2400)),
      ...comparisonOf(MILK, offer(withAddress, 'leche-1l', 3900)),
    });
    renderBasket(rice, milk);

    const panel = await where();

    expect((await within(panel).findAllByText('Carrera 14 # 5-20')).length).toBeGreaterThan(0);
    expect(panel).toHaveTextContent('Tiene 2 de 2 productos.');
  });
});
