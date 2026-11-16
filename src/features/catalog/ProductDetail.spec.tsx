import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
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

  it('si el producto no existe lo dice y ofrece volver a buscar', async () => {
    stubApi({});

    renderDetail(rice.id);

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este producto' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buscar otro producto' })).toHaveAttribute('href', '/');
  });

  it('sin conexión muestra el error con «Reintentar», no «no existe»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    renderDetail(rice.id);

    expect(await screen.findByRole('alert')).toHaveTextContent('No hay conexión con Valora');
    expect(screen.queryByText('No encontramos este producto')).not.toBeInTheDocument();
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
  });

  it('mientras llega el producto dice «Cargando…»', () => {
    stubPendingApi();

    renderDetail(rice.id);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('desde el detalle se puede comparar precios, ver el historial y registrar un precio', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('link', { name: 'Comparar precios' })).toHaveAttribute(
      'href',
      `/productos/${rice.id}/comparar`,
    );
    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute(
      'href',
      `/productos/${rice.id}/historial`,
    );
    expect(screen.getByRole('link', { name: 'Registrar un precio' })).toHaveAttribute(
      'href',
      `/registrar?producto=${rice.id}`,
    );
  });

  it('muestra la foto del producto, o la ilustración si no tiene', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderDetail(rice.id);

    expect(await screen.findByRole('img', { name: 'Arroz blanco (sin foto)' })).toBeInTheDocument();
  });
});
