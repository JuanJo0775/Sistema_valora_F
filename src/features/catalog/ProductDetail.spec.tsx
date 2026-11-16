import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { ProductDetail } from './ProductDetail';

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

const renderDetail = (productId: string) =>
  render(
    <MemoryRouter initialEntries={[`/productos/${productId}`]}>
      <Routes>
        <Route path="/productos/:productId" element={<ProductDetail />} />
      </Routes>
    </MemoryRouter>,
  );

describe('detalle del producto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra el nombre, la marca, la categoría y las presentaciones', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
    expect(screen.getByText('Diana · Granos y abarrotes')).toBeInTheDocument();
    const presentations = screen.getByRole('list', { name: 'Presentaciones' });
    expect(presentations).toHaveTextContent('500 g');
    expect(presentations).toHaveTextContent('1 kg');
  });
});
