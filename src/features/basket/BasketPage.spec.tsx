import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { renderCanasta } from '../../test/renderCanasta';
import { planDraft } from '../../test/planFixtures';
import { savePlan, toSavedPlan } from '../plan/savedPlan';

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
  return renderCanasta();
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

  it('la lista es ligera: no repite la frase de dónde sale más barata, el resumen lo dice', () => {
    stubApi({});
    renderBasket(rice);

    expect(screen.queryByText('Te decimos dónde te sale más barata.')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Dónde comprar' })).toBeInTheDocument();
  });

  it('quien llega de usar una lista ve el aviso que trae', () => {
    stubApi({});
    localStorage.setItem('valora:canasta', JSON.stringify([rice]));
    renderCanasta({ pathname: '/canasta', state: { notice: 'Listo: cargamos «Mercado»' } });

    expect(screen.getByText('Listo: cargamos «Mercado»')).toBeInTheDocument();
  });

  it('vacía invita a buscar productos', () => {
    stubApi({});
    renderBasket();

    expect(screen.getByRole('heading', { name: 'Tu canasta está vacía' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar productos' })).toHaveAttribute('href', '/');
  });

  it('vacía y con listas guardadas, invita primero a abrir una lista y deja buscar productos', () => {
    stubApi({});
    savePlan(toSavedPlan(planDraft(), new Date('2026-11-20T12:00:00Z')));
    renderBasket();

    const panel = within(screen.getByRole('tabpanel'));
    expect(panel.getByRole('link', { name: 'Abre una lista guardada' })).toHaveAttribute(
      'href',
      '/canasta?tab=guardadas',
    );
    expect(panel.getByRole('link', { name: 'Buscar productos' })).toHaveAttribute('href', '/');
    expect(panel.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Abre una lista guardada',
      'Buscar productos',
    ]);
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

  it('el resumen dice la mejor recomendación, su total y cuántas tiendas, con un enlace a la pantalla', async () => {
    stubApi({
      ...comparisonOf(RICE, offer(ara, 'arroz-500g', 2600), offer(exito, 'arroz-500g', 2400)),
      ...comparisonOf(MILK, offer(ara, 'leche-1l', 4000), offer(exito, 'leche-1l', 3900)),
    });
    renderBasket(rice, milk);

    const panel = within(await where());
    expect(await panel.findByText('$8.700')).toBeInTheDocument();
    expect(panel.getByText(/1 tienda/)).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Ver dónde comprar' })).toHaveAttribute(
      'href',
      '/canasta/donde-comprar',
    );
    // Sin guardar ni detalle por tienda: eso vive en su pantalla.
    expect(panel.queryByRole('button')).toBeNull();
    expect(panel.queryByRole('heading', { name: 'Compra todo en' })).toBeNull();
    // Cada producto dice en qué tienda sale más barato.
    expect(await screen.findByText('500 g · Éxito')).toBeInTheDocument();
  });

  it('el resumen cuenta tiendas cuando la mejor recomendación reparte y dice cuánto ahorras', async () => {
    stubApi({
      ...comparisonOf(RICE, offer(ara, 'arroz-500g', 2000), offer(exito, 'arroz-500g', 2500)),
      ...comparisonOf(MILK, offer(ara, 'leche-1l', 5000), offer(exito, 'leche-1l', 3000)),
    });
    renderBasket(rice, milk);

    const panel = within(await where());
    expect(await panel.findByText(/2 tiendas/)).toBeInTheDocument();
    expect(panel.getByText(/^Ahorras \$/)).toBeInTheDocument();
  });

  it('si ninguna tienda tiene todo, la pantalla avisa qué producto no tiene precio', async () => {
    stubApi({
      ...comparisonOf(RICE, offer(ara, 'arroz-500g', 2600), offer(d1, 'arroz-500g', 2300)),
      ...comparisonOf(MILK, offer(ara, 'leche-1l-otra', 4000)),
    });
    localStorage.setItem('valora:canasta', JSON.stringify([rice, milk]));
    renderCanasta('/canasta/donde-comprar');

    expect(await screen.findByText(/Sin precio vigente cerca: Leche entera/)).toBeInTheDocument();
    expect(screen.queryByText('Ninguna tienda tiene todos tus productos.')).toBeNull();
    expect(screen.queryByRole('heading', { name: /Dónde te sale más barata/ })).toBeNull();
  });

  it('lo comprado no entra al cálculo', async () => {
    const api = stubApi({
      ...comparisonOf(MILK, offer(ara, 'leche-1l', 4000)),
    });
    renderBasket({ ...rice, bought: true }, milk);

    expect(await within(await where()).findByText('$4.000')).toBeInTheDocument();
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

  it('en su pantalla, «Compra todo en» dice cuál tienda es y cuántos productos tiene', async () => {
    const withAddress = { ...exito, address: 'Carrera 14 # 5-20' };
    stubApi({
      ...comparisonOf(RICE, offer(withAddress, 'arroz-500g', 2400)),
      ...comparisonOf(MILK, offer(withAddress, 'leche-1l', 3900)),
    });
    localStorage.setItem('valora:canasta', JSON.stringify([rice, milk]));
    renderCanasta('/canasta/donde-comprar');

    expect((await screen.findAllByText('Carrera 14 # 5-20')).length).toBeGreaterThan(0);
    expect(screen.getByText('Tiene 2 de 2 productos.')).toBeInTheDocument();
  });
});
