import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { StoreMap } from './StoreMap';

const stores = [
  { id: 'a1', name: 'Ara', type: 'descuento' as const, lat: 4.5339, lng: -75.6811 },
  { id: 'd1', name: 'D1', type: 'barrio' as const, lat: 4.5401, lng: -75.6702 },
];

function WhereAmI() {
  return <p>{`Estás en ${useLocation().pathname}`}</p>;
}

const renderMap = () =>
  render(
    <MemoryRouter initialEntries={['/mapa']}>
      <Routes>
        <Route path="/mapa" element={<StoreMap stores={stores} label="Mapa de las tiendas" />} />
        <Route path="/tiendas/:id" element={<WhereAmI />} />
      </Routes>
    </MemoryRouter>,
  );

// Leaflet de verdad sobre jsdom: no descarga teselas, pero dibuja los marcadores y sus ventanas.
describe('mapa de Leaflet', () => {
  it('dibuja un marcador por tienda, con la atribución de OpenStreetMap', () => {
    const { container } = renderMap();

    expect(screen.getByRole('region', { name: 'Mapa de las tiendas' })).toBeInTheDocument();
    expect(container.querySelectorAll('path.store-pin')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
  });

  it('al tocar un marcador, «Ver precios» lleva a la página de la tienda', async () => {
    const { container } = renderMap();
    const [first] = container.querySelectorAll('path.store-pin');

    fireEvent.click(first as Element);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver precios' }));

    expect(await screen.findByText('Estás en /tiendas/a1')).toBeInTheDocument();
  });

  // #12: al proponer una tienda, se toca el mapa para poner su ubicación.
  it('al tocar el mapa elige ese punto y lo marca', () => {
    const onPick = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <StoreMap stores={[]} label="Ubicación de la tienda" onPick={onPick} picked={null} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('region', { name: 'Ubicación de la tienda' }), {
      clientX: 10,
      clientY: 10,
    });

    expect(onPick).toHaveBeenCalledTimes(1);
    const [[point]] = onPick.mock.calls as [[{ lat: number; lng: number }]];
    expect(Number.isFinite(point.lat) && Number.isFinite(point.lng)).toBe(true);
    expect(container.querySelectorAll('path.picked-pin')).toHaveLength(0);
  });

  it('marca el punto elegido', () => {
    const { container } = render(
      <MemoryRouter>
        <StoreMap
          stores={[]}
          label="Ubicación de la tienda"
          onPick={vi.fn()}
          picked={{ lat: 4.5339, lng: -75.6811 }}
        />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('path.picked-pin')).toHaveLength(1);
  });

  // #73 (prototipo): cada tienda con el color de su tipo, como en la leyenda.
  it('cada tienda lleva el color de su tipo', () => {
    const { container } = renderMap();

    expect(container.querySelectorAll('path.store-pin.type-descuento')).toHaveLength(1);
    expect(container.querySelectorAll('path.store-pin.type-barrio')).toHaveLength(1);
  });

  it('con la ubicación dibuja el punto de la persona y el círculo del radio', () => {
    const { container } = render(
      <MemoryRouter>
        <StoreMap
          stores={stores}
          label="Mapa de las tiendas"
          around={{ lat: 4.53, lng: -75.68, radiusKm: 2 }}
        />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('path.user-pin')).toHaveLength(1);
    expect(container.querySelectorAll('path.radius-circle')).toHaveLength(1);
  });

  it('sin la ubicación no dibuja ni el punto ni el radio', () => {
    const { container } = renderMap();

    expect(container.querySelectorAll('path.user-pin, path.radius-circle')).toHaveLength(0);
  });
});
