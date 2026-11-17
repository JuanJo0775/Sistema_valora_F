import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { ProductSearch } from './ProductSearch';

const rice = {
  id: '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d',
  name: 'Arroz blanco',
  brand: 'Diana',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [
    { id: '9a2e7c10-1b2d-4e3f-8a9b-0c1d2e3f4a5b', quantity: 500, unit: 'g', packCount: 1 },
  ],
};

const search = (text: string) => {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar producto' }), {
    target: { value: text },
  });
  fireEvent.submit(screen.getByRole('search'));
};

const renderSearch = () =>
  render(
    <MemoryRouter>
      <ProductSearch />
    </MemoryRouter>,
  );

describe('buscar productos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('buscar «arroz» muestra los productos y cada uno lleva a su detalle', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderSearch();

    search('arroz');

    const link = await screen.findByRole('link', { name: /Arroz blanco/ });
    expect(link).toHaveAttribute('href', `/productos/${rice.id}`);
    expect(link).toHaveTextContent('Diana · Granos y abarrotes');
    expect(link).toHaveTextContent('500 g');
  });

  it('si se escriben solo los números del código de barras, busca por código', async () => {
    const api = stubApi({ 'GET /v1/products': { status: 200, body: { items: [rice] } } });
    renderSearch();

    search('7702511000014');

    await screen.findByRole('link', { name: /Arroz blanco/ });
    expect(api.requested[0]?.searchParams.get('barcode')).toBe('7702511000014');
    expect(api.requested[0]?.searchParams.has('q')).toBe(false);
  });

  it('con menos de 2 letras pide escribir más y no consulta la API', () => {
    const api = stubApi({});
    renderSearch();

    search('a');

    expect(screen.getByText('Escribe al menos 2 letras.')).toBeInTheDocument();
    expect(api.requested).toHaveLength(0);
  });

  it('sin resultados lo dice y sugiere revisar la escritura', async () => {
    stubApi({ 'GET /v1/products': { status: 200, body: { items: [] } } });
    renderSearch();

    search('aguacate hass');

    expect(
      await screen.findByRole('heading', { name: 'Sin resultados para «aguacate hass»' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Revisa la escritura o pide que lo agreguemos al catálogo.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Propón este producto' })).toHaveAttribute(
      'href',
      '/proponer/producto?nombre=aguacate+hass',
    );
  });

  it('si la búsqueda falla muestra el error y «Reintentar» vuelve a consultar', async () => {
    const api = stubApi({
      'GET /v1/products': {
        status: 500,
        body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' },
      },
    });
    renderSearch();
    search('arroz');

    expect(await screen.findByRole('alert')).toHaveTextContent('Ocurrió un error inesperado.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await vi.waitFor(() => {
      expect(api.requested).toHaveLength(2);
    });
  });

  it('mientras busca dice «Buscando…»', () => {
    stubPendingApi();
    renderSearch();

    search('arroz');

    expect(screen.getByRole('status')).toHaveTextContent('Buscando…');
  });
});
