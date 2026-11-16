import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { StoreMap } from './StoreMap';

const stores = [
  { id: 'a1', name: 'Ara', lat: 4.5339, lng: -75.6811 },
  { id: 'd1', name: 'D1', lat: 4.5401, lng: -75.6702 },
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
});
