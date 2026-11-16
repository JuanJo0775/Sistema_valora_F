import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { ReportPrice } from './ReportPrice';

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

const renderReport = (path = `/registrar?producto=${rice.id}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/registrar" element={<ReportPrice />} />
      </Routes>
    </MemoryRouter>,
  );

describe('registrar un precio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('con el producto en la dirección lo muestra con sus presentaciones para elegir', async () => {
    stubApi({ [`GET /v1/products/${rice.id}`]: { status: 200, body: rice } });

    renderReport();

    expect(await screen.findByRole('heading', { name: 'Arroz blanco' })).toBeInTheDocument();
    const sizes = screen.getByRole('radiogroup', { name: 'Presentación' });
    expect(sizes).toHaveTextContent('500 g');
    expect(sizes).toHaveTextContent('1 kg');
  });
});
