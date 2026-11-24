import { fireEvent, render, screen, within } from '@testing-library/react';
import { choose } from '../../test/choose';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi, stubPendingApi } from '../../test/fakeApi';
import { stubMatchMedia } from '../../test/matchMedia';
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

  it('la gráfica muestra el precio más bajo de cada día y no une los días sin precios', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [
          point('2026-11-10', 2600, 2600, 1),
          point('2026-11-11', 2500, 2500, 1),
          point('2026-11-15', 2300, 2400, 2),
        ],
      }),
    );

    renderHistory();

    const chart = await screen.findByRole('img', {
      name: 'Precio más bajo por día · 500 g: de $2.600 el 10 nov a $2.300 el 15 nov',
    });
    // Dos tramos: 10 y 11 de noviembre seguidos; el 15 va solo (no se inventan los días del medio).
    expect(chart.querySelectorAll('polyline')).toHaveLength(2);
    expect(chart.querySelectorAll('circle.dot')).toHaveLength(3);
  });

  it('con un solo precio no dibuja la gráfica: lo dice en una tarjeta compacta', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [point('2026-11-16', 2300, 2300, 1)],
      }),
    );

    renderHistory();

    expect(
      await screen.findByText('Hasta ahora hay un solo precio registrado: $2.300 el 16 nov.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('dice de qué producto es y qué días abarca', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [point('2026-11-16', 2300, 2300, 1)],
      }),
    );

    renderHistory();

    // Título corto; el producto va debajo, como subtítulo.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Historial de precios' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Arroz blanco')).toHaveClass('history-product');
    expect(screen.getByText('Últimos 30 días: del 18 oct al 16 nov.')).toBeInTheDocument();
  });

  it('arriba, tarjetas con el más bajo, el más alto, el precio de hoy y la variación', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [
          point('2026-11-10', 2000, 2100, 1),
          point('2026-11-12', 2400, 2400, 2),
          point('2026-11-16', 2200, 2300, 1),
        ],
      }),
    );

    renderHistory();

    const cards = await screen.findByRole('list', { name: 'Resumen del periodo' });
    expect(
      within(cards)
        .getAllByRole('listitem')
        .map((card) => card.textContent),
    ).toEqual(['Más bajo$2.000', 'Más alto$2.400', 'Hoy$2.200', 'VariaciónSube 10 %']);
  });

  it('si el último precio no es de hoy, lo dice con su fecha', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [point('2026-11-10', 2000, 2100, 1), point('2026-11-14', 1900, 1900, 1)],
      }),
    );

    renderHistory();

    const cards = await screen.findByRole('list', { name: 'Resumen del periodo' });
    expect(within(cards).getByText('Último (14 nov)')).toBeInTheDocument();
    expect(within(cards).getByText('Baja 5 %')).toBeInTheDocument();
  });

  it('con un solo precio no hay variación que mostrar', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [point('2026-11-16', 2300, 2300, 1)],
      }),
    );

    renderHistory();

    const cards = await screen.findByRole('list', { name: 'Resumen del periodo' });
    expect(within(cards).getByText('Sin variación')).toBeInTheDocument();
  });

  it('la tabla queda plegada, con su número de filas, y sigue siendo la alternativa de la gráfica', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [point('2026-11-14', 2400, 2550, 3), point('2026-11-16', 2300, 2300, 1)],
      }),
    );

    renderHistory();

    const summary = await screen.findByText('Ver la tabla de precios (2)');
    const details = summary.closest('details');
    expect(summary.tagName).toBe('SUMMARY');
    expect(details).not.toHaveAttribute('open');
    expect(details).toContainElement(screen.getByRole('table', { name: 'Precio por día · 500 g' }));
    // La gráfica conserva su descripción accesible y no está dentro de lo plegado.
    const chart = screen.getByRole('img', { name: /^Precio más bajo por día · 500 g/ });
    expect(details).not.toContainElement(chart);
  });

  it('la gráfica usa el ancho disponible en pantallas anchas y la compacta en celular', async () => {
    stubHistory(
      history({
        presentationId: 'p500',
        label: '500 g',
        points: [point('2026-11-14', 2400, 2550, 3), point('2026-11-16', 2300, 2300, 1)],
      }),
    );
    stubMatchMedia(true);
    const { unmount } = renderHistory();
    expect((await screen.findByRole('img')).getAttribute('viewBox')).toBe('0 0 640 170');
    unmount();

    stubMatchMedia(false);
    renderHistory();
    expect((await screen.findByRole('img')).getAttribute('viewBox')).toBe('0 0 320 140');
  });

  it('con varias presentaciones se elige cuál ver', async () => {
    stubHistory(
      history(
        { presentationId: 'p500', label: '500 g', points: [point('2026-11-16', 2300, 2300, 1)] },
        { presentationId: 'p1kg', label: '1 kg', points: [point('2026-11-15', 4400, 4500, 2)] },
      ),
    );
    renderHistory();
    await screen.findByRole('table', { name: 'Precio por día · 500 g' });

    await choose('Presentación', '1 kg');

    expect(screen.getByRole('table', { name: 'Precio por día · 1 kg' })).toHaveTextContent(
      '$4.400',
    );
  });

  it('sin precios en los últimos 30 días lo dice, sin inventar una gráfica', async () => {
    stubHistory(history());

    renderHistory();

    expect(
      await screen.findByRole('heading', {
        name: 'Todavía no hay precios de este producto en los últimos 30 días',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('mientras carga dice «Cargando…»', () => {
    stubPendingApi();

    renderHistory();

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('si el historial no carga muestra el error y «Reintentar» lo vuelve a pedir', async () => {
    stubApi({
      [`GET /v1/products/${RICE}`]: { status: 200, body: rice },
      [`GET /v1/products/${RICE}/history`]: [
        { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        history({
          presentationId: 'p500',
          label: '500 g',
          points: [point('2026-11-16', 2300, 2300, 1)],
        }),
      ],
    });
    renderHistory();

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(
      await screen.findByRole('table', { name: 'Precio por día · 500 g' }),
    ).toBeInTheDocument();
  });
});
