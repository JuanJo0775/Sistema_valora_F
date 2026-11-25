import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubApi } from '../../test/fakeApi';
import { stubLocation } from '../../test/location';
import { StorePicker } from './StorePicker';

const d1 = (id: string, extra: Record<string, unknown>) => ({
  id,
  name: 'D1',
  type: 'descuento',
  lat: 4.53,
  lng: -75.68,
  municipality: 'armenia',
  ...extra,
});
const centro = d1('11111111-1111-4111-8111-111111111111', {
  address: 'Av. 19 de Enero',
  neighborhood: 'Centro',
});
const tebaida = d1('22222222-2222-4222-8222-222222222222', { municipality: 'la-tebaida' });

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderPicker = (mode: 'report' | 'claim' = 'claim') =>
  render(
    <MemoryRouter>
      <StorePicker mode={mode} value={null} onChange={() => undefined} />
    </MemoryRouter>,
  );

const search = async (text = 'D1') => {
  fireEvent.change(screen.getByLabelText('Buscar tienda por nombre'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tienda' }));
  await screen.findAllByRole('radio');
};

describe('selector de tienda: tiendas con el mismo nombre', () => {
  it('cada opción se llama con el nombre, el municipio y la dirección', async () => {
    stubApi({ 'GET /v1/establishments': { status: 200, body: { items: [centro, tebaida] } } });
    renderPicker();
    await search();
    expect(
      screen.getByRole('radio', { name: 'D1 · Armenia · Centro · Av. 19 de Enero' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'D1 · La Tebaida' })).toBeInTheDocument();
  });

  it('también en el reporte de precio (no solo al reclamar) y se ve en la ficha', async () => {
    stubApi({ 'GET /v1/establishments': { status: 200, body: { items: [centro] } } });
    renderPicker('report');
    await search();
    const radio = screen.getByRole('radio', { name: /Armenia · Centro · Av\. 19 de Enero/ });
    expect(radio.closest('label')).toHaveTextContent('Armenia · Centro · Av. 19 de Enero');
  });

  it('con ubicación suma la distancia y ordena de la más cercana a la más lejana', async () => {
    stubLocation('allow');
    stubApi({
      'GET /v1/establishments/nearby': {
        status: 200,
        body: {
          items: [
            { ...tebaida, distanceM: 1800 },
            { ...centro, distanceM: 350 },
            d1('33333333-3333-4333-8333-333333333333', { distanceM: 900 }),
          ],
        },
      },
    });
    renderPicker('report');
    fireEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    await screen.findAllByRole('radio');
    const names = within(screen.getByRole('radiogroup', { name: 'Tienda' }))
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-label'));
    expect(names).toEqual([
      'D1 · Armenia · Centro · Av. 19 de Enero · a 350 m',
      'D1 · Armenia · a 900 m',
      'D1 · La Tebaida · a 1,8 km',
    ]);
  });

  it('las opciones siguen siendo un grupo de radios de una sola tienda', async () => {
    stubApi({ 'GET /v1/establishments': { status: 200, body: { items: [centro, tebaida] } } });
    renderPicker();
    await search();
    const radios = screen.getAllByRole('radio');
    expect(new Set(radios.map((radio) => radio.getAttribute('name')))).toEqual(new Set(['store']));
  });
});
