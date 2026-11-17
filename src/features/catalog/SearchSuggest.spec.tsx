import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { SearchSuggest } from './SearchSuggest';

const product = (id: string, name: string, brand?: string) => ({
  id,
  name,
  ...(brand ? { brand } : {}),
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [{ id: `${id}-p`, quantity: 500, unit: 'g', packCount: 1 }],
});

const rice = product('3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d', 'Arroz blanco', 'Diana');
const roa = product('4a2d3b75-6d2f-4c9b-8e72-1b8c2f3d4e5f', 'Arroz Roa', 'Roa');

function WhereAmI() {
  const { pathname, search } = useLocation();
  return <p>{`Estás en ${pathname}${search}`}</p>;
}

const renderSearch = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <SearchSuggest label="Buscar producto" />
      <Routes>
        <Route path="*" element={<WhereAmI />} />
      </Routes>
    </MemoryRouter>,
  );

const type = (text: string) => {
  fireEvent.change(screen.getByRole('combobox', { name: 'Buscar producto' }), {
    target: { value: text },
  });
};

const searches = (api: ReturnType<typeof stubApi>) =>
  api.requested.filter(({ pathname }) => pathname === '/v1/products');

describe('buscador con sugerencias', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mientras se escribe sugiere productos, con su marca, y dice cuántos hay', async () => {
    const api = stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice, roa] } } });
    renderSearch();

    type('arr');

    const list = await screen.findByRole('listbox', { name: 'Sugerencias' });
    expect(
      within(list)
        .getAllByRole('option')
        .map(({ textContent }) => textContent),
    ).toEqual(['Arroz blancoDiana · 500 g', 'Arroz RoaRoa · 500 g']);
    expect(screen.getByRole('combobox', { name: 'Buscar producto' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('2 sugerencias')).toBeInTheDocument();
    expect(searches(api).at(-1)?.searchParams.get('q')).toBe('arr');
  });

  it('con una sola letra no pide nada', async () => {
    const api = stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderSearch();

    type('a');
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(searches(api)).toHaveLength(0);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('escribir rápido pide una sola vez, con lo último que se escribió', async () => {
    const api = stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderSearch();

    type('ar');
    type('arr');
    type('arroz');
    await screen.findByRole('listbox', { name: 'Sugerencias' });

    expect(searches(api).map(({ searchParams }) => searchParams.get('q'))).toEqual(['arroz']);
  });

  it('con las flechas se elige una sugerencia y Enter abre su detalle', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice, roa] } } });
    renderSearch();
    type('arr');
    await screen.findByRole('listbox', { name: 'Sugerencias' });
    const box = screen.getByRole('combobox', { name: 'Buscar producto' });

    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'ArrowDown' });

    const [, second] = screen.getAllByRole('option');
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', second?.id);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByText(`Estás en /productos/${roa.id}`)).toBeInTheDocument();
  });

  it('al tocar una sugerencia abre su detalle', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderSearch();
    type('arr');

    fireEvent.click(await screen.findByRole('option', { name: /Arroz blanco/ }));

    expect(await screen.findByText(`Estás en /productos/${rice.id}`)).toBeInTheDocument();
  });

  it('Enter sin elegir una sugerencia busca lo escrito', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderSearch();
    type('arroz');
    await screen.findByRole('listbox', { name: 'Sugerencias' });

    fireEvent.submit(screen.getByRole('search', { name: 'Buscar producto' }));

    expect(await screen.findByText('Estás en /?q=arroz')).toBeInTheDocument();
  });

  it('Escape cierra las sugerencias', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderSearch();
    type('arr');
    await screen.findByRole('listbox', { name: 'Sugerencias' });

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Buscar producto' }), {
      key: 'Escape',
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('sin resultados lo dice', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [] } } });
    renderSearch();

    type('xyz');

    expect(await screen.findByText('Sin sugerencias para «xyz»')).toBeInTheDocument();
  });
});
