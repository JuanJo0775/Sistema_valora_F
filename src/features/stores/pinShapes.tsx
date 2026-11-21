import { usePinShapes } from './pinShapePref';

// Por defecto cada tipo de tienda es un círculo de su color. Quien lo pide en Ajustes › Accesibilidad
// (#73) ve además una forma por tipo, así no depende solo del color. El mismo dibujo sirve al pin del
// mapa (texto para el divIcon de Leaflet) y a la leyenda y las tarjetas (React): siempre coinciden.
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

// Texto HTML del pin de una tienda (lo pone Leaflet dentro de un divIcon; solo lleva datos propios).
export const pinHtml = (type: string | undefined, shaped: boolean): string =>
  shaped
    ? `<svg class="pin-shape" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path d="${shapeOf(type)}"/></svg>`
    : '<span class="pin-dot" aria-hidden="true"></span>';

// El mismo pin en la leyenda, el chip y las tarjetas. El color viene de la clase `type-*` de un
// ancestro (o del propio elemento) que define `--pin`.
export function PinShape({ type }: { type?: string }) {
  const shaped = usePinShapes();
  if (!shaped) return <span className="pin-dot" aria-hidden="true" />;
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
