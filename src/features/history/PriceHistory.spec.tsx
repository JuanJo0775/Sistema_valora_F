import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { PriceHistory } from './PriceHistory';

const RICE = '3f1c2a64-5c1e-4b8a-9d61-0a7b1f2e3c4d';
const rice = {
  id: RICE,
  name: 'Arroz blanco',
  category: { code: 'grains-groceries', name: 'Granos y abarrotes' },
  presentations: [{ id: 'p500', quantity: 500, unit: 'g', packCount: 1 }],
};

const point = (date: string, minPriceCop: number, avgPriceCop: number, reports: number) => ({
  date,
  minPriceCop,
  avgPriceCop,
  reports,
  source: 'reportado',
});

const history = (...presentations: unknown[]) => ({
  status: 200,
  body: { from: '2026-10-18', to: '2026-11-16', presentations },
});

const stubHistory = (reply: ReturnType<typeof history>) =>
  stubApi({
    [`GET /v1/products/${RICE}`]: { status: 200, body: rice },
    [`GET /v1/products/${RICE}/history`]: reply,
  });

const renderHistory = () =>
  render(
    <MemoryRouter initialEntries={[`/productos/${RICE}/historial`]}>
      <Routes>
        <Route path="/productos/:productId/historial" element={<PriceHistory />} />
      </Routes>
    </MemoryRouter>,
  );

describe('historial de precios', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('una tabla dice, por cada día con precios, el más bajo, el promedio y cuántos reportes hubo', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [point('2026-11-14', 2400, 2550, 3), point('2026-11-16', 2300, 2300, 1)],
      }),
    );

    renderHistory();

    const table = await screen.findByRole('table', { name: 'Precio por día · 500 g' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      '14 nov$2.400$2.5503',
      '16 nov$2.300$2.3001',
    ]);
  });
});
