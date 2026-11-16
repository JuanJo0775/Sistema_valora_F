import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
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
});
