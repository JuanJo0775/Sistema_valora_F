// #73: cada tipo de tienda tiene su forma y su color, así no se distinguen solo por el color.
// El mismo dibujo sirve para el pin del mapa (texto SVG para Leaflet) y para la leyenda (React).
const SHAPES: Record<string, string> = {
  // Círculo.
  barrio: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
  // Cuadrado de esquinas redondeadas.
  minimercado: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
  // Hexágono.
  supermercado: 'M12 2l8.66 5v10L12 22l-8.66-5V7z',
  // Estrella.
  descuento: 'M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.3l7.1-.7z',
};
const FALLBACK = SHAPES.barrio ?? '';

export const shapeOf = (type?: string): string => (type && SHAPES[type]) || FALLBACK;

// Texto SVG del pin de una tienda (lo pone Leaflet dentro de un divIcon; solo lleva datos propios).
export const pinSvg = (type?: string): string =>
  `<svg class="pin-shape" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path d="${shapeOf(type)}"/></svg>`;

// La misma figura en la leyenda.
export function PinShape({ type }: { type?: string }) {
  return (
    <svg
      className="pin-shape"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path d={shapeOf(type)} />
    </svg>
  );
}
