import L from 'leaflet';
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
  // La rueda del ratón hace zoom. El gesto táctil no cambia: dos dedos hacen zoom y uno desplaza la página.
  it('la rueda del ratón hace zoom sobre el mapa', () => {
    const create = vi.spyOn(L, 'map');
    renderMap();

    const options = create.mock.calls[0]?.[1];
    expect(options?.scrollWheelZoom).not.toBe(false);
    create.mockRestore();
  });

  // H-33: con «reducir movimiento» el mapa no anima el zoom ni los fundidos.
  it.each([
    [true, false],
    [false, true],
  ])('con reducir movimiento=%s, las animaciones del mapa quedan en %s', (reduce, animated) => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' && reduce,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const create = vi.spyOn(L, 'map');
    renderMap();

    const options = create.mock.calls[0]?.[1];
    expect(options?.zoomAnimation).toBe(animated);
    expect(options?.fadeAnimation).toBe(animated);
    expect(options?.markerZoomAnimation).toBe(animated);
    create.mockRestore();
    vi.unstubAllGlobals();
  });

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

  // H-32: los pines se alcanzan con Tab, dicen la tienda y abren su globo con Enter.
  it('cada pin recibe foco con Tab y se nombra con su tienda', () => {
    const { container } = renderMap();

    const pins = container.querySelectorAll('path.store-pin');
    expect([...pins].map((pin) => pin.getAttribute('tabindex'))).toEqual(['0', '0']);
    expect([...pins].map((pin) => pin.getAttribute('aria-label'))).toEqual(['Ara', 'D1']);
    expect(screen.getByRole('button', { name: 'Ara' })).toBeInTheDocument();
  });

  it('Enter sobre un pin abre su globo, con «Cómo llegar» y «Ver precios», y el foco entra en él', async () => {
    renderMap();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Ara' }), { key: 'Enter' });

    const directions = await screen.findByRole('link', { name: 'Cómo llegar a Ara' });
    expect(directions).toHaveAttribute(
      'href',
      expect.stringContaining('destination=4.5339%2C-75.6811'),
    );
    expect(directions).toHaveTextContent('Cómo llegar');
    expect(screen.getByRole('button', { name: 'Ver precios' })).toBeInTheDocument();
    expect(directions).toHaveFocus();
  });

  it('el globo de un pin ofrece «Cómo llegar» antes que «Ver precios»', async () => {
    const { container } = renderMap();

    fireEvent.click(container.querySelector('path.store-pin') as Element);

    const directions = await screen.findByRole('link', { name: 'Cómo llegar a Ara' });
    const prices = screen.getByRole('button', { name: 'Ver precios' });
    expect(
      directions.compareDocumentPosition(prices) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

  // El círculo del radio se redimensiona en vivo, sin volver a dibujar ni mover la vista mientras se arrastra.
  it('al cambiar el radio redimensiona el círculo y solo ajusta la vista al soltar', () => {
    const resize = vi.spyOn(L.Circle.prototype, 'setRadius');
    const fit = vi.spyOn(L.Map.prototype, 'fitBounds');
    const draw = (radiusKm: number, dragging = false) => (
      <MemoryRouter>
        <StoreMap
          stores={stores}
          label="Mapa de las tiendas"
          around={{ lat: 4.53, lng: -75.68, radiusKm, dragging }}
        />
      </MemoryRouter>
    );
    const { container, rerender } = render(draw(1.5));
    expect(resize).toHaveBeenLastCalledWith(1500);
    fit.mockClear();

    rerender(draw(2, true));
    rerender(draw(2.5, true));

    expect(resize).toHaveBeenLastCalledWith(2500);
    expect(fit).not.toHaveBeenCalled();
    expect(container.querySelectorAll('path.radius-circle')).toHaveLength(1);
    expect(container.querySelectorAll('path.user-pin')).toHaveLength(1);

    rerender(draw(2.5, false));

    expect(fit).toHaveBeenCalledTimes(1);
    resize.mockRestore();
    fit.mockRestore();
  });

  it('sin la ubicación no dibuja ni el punto ni el radio', () => {
    const { container } = renderMap();

    expect(container.querySelectorAll('path.user-pin, path.radius-circle')).toHaveLength(0);
  });
});
