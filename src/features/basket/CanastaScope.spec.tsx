import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import {
  comparisonOf,
  far,
  locateAt,
  milk,
  MILK,
  offer,
  rice,
  RICE,
} from '../../test/planFixtures';
import { renderCanasta } from '../../test/renderCanasta';

// «Mi canasta» y «Dónde comprar» comparten estado: dónde se busca, los supuestos y las ofertas.
const routes = () => ({
  ...comparisonOf(RICE, offer(far.a, 'arroz-500g', 2000), offer(far.b, 'arroz-500g', 2500)),
  ...comparisonOf(MILK, offer(far.a, 'leche-1l', 5000), offer(far.b, 'leche-1l', 3000)),
});

const open = () => {
  localStorage.setItem('valora:canasta', JSON.stringify([rice, milk]));
  return renderCanasta('/canasta');
};

describe('de «Mi canasta» a «Dónde comprar»', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'geolocation');
    localStorage.clear();
  });

  it('el resumen lleva a la pantalla y la pantalla vuelve a la canasta, sin solicitudes nuevas', async () => {
    const api = stubApi(routes());
    open();
    const summary = within(await screen.findByRole('complementary', { name: 'Dónde comprar' }));
    await summary.findByText('$7.000');
    expect(api.requested).toHaveLength(2);

    fireEvent.click(summary.getByRole('link', { name: 'Ver dónde comprar' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Dónde comprar' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: 'La más barata' })).toBeChecked();
    fireEvent.click(screen.getByRole('link', { name: 'Volver' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Mi canasta' }),
    ).toBeInTheDocument();
    await within(screen.getByRole('complementary', { name: 'Dónde comprar' })).findByText('$7.000');

    expect(api.requested).toHaveLength(2);
    expect(new Set(api.requested.map((url) => url.search)).size).toBe(1);
    expect(api.requested.some((u) => u.searchParams.has('lat') || u.searchParams.has('lng'))).toBe(
      false,
    );
  });

  it('los supuestos del traslado se conservan al ir y volver', async () => {
    stubApi(routes());
    open();
    fireEvent.click(await screen.findByRole('link', { name: 'Ver dónde comprar' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'Pago pasaje' }));
    fireEvent.click(screen.getByRole('link', { name: 'Volver' }));
    fireEvent.click(await screen.findByRole('link', { name: 'Ver dónde comprar' }));

    expect(await screen.findByRole('radio', { name: 'Pago pasaje' })).toBeChecked();
  });

  it('la ubicación en memoria sigue ahí al cambiar de pantalla y nunca viaja en la consulta', async () => {
    locateAt(4.53, -75.6811);
    const api = stubApi(routes());
    open();
    fireEvent.click(await screen.findByRole('link', { name: 'Ver dónde comprar' }));

    expect(
      await screen.findByRole('button', { name: /Dónde buscar: Cerca de mí/ }),
    ).toBeInTheDocument();
    expect(api.requested).toHaveLength(2);
    expect(api.requested.some((u) => u.searchParams.has('lat'))).toBe(false);
  });
});
