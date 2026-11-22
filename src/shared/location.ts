export interface Point {
  lat: number;
  lng: number;
}

// La ubicación del momento, solo para calcular cercanía: quien la pide no la guarda (EC-08).
// Falla si el navegador no tiene geolocation (algunos, o páginas sin HTTPS, aunque los tipos digan
// que sí) o si la persona no da permiso.
export function askLocation(options: PositionOptions = {}): Promise<Point> {
  const { geolocation } = navigator as Partial<Navigator>;
  if (!geolocation) return Promise.reject(new Error('Sin geolocalización en este navegador'));
  return new Promise((resolve, reject) => {
    // Si el aviso del navegador se ignora, a los 15 s falla en vez de quedarse esperando.
    geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ lat: coords.latitude, lng: coords.longitude });
      },
      reject,
      { ...options, timeout: 15_000 },
    );
  });
}

const KM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

// «350 m» o «1,2 km», como se lee en Colombia.
export const formatDistance = (meters: number) =>
  meters < 1000 ? `${String(meters)} m` : `${KM.format(meters / 1000)} km`;
