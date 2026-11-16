export interface Point {
  lat: number;
  lng: number;
}

// La ubicación del momento, solo para calcular cercanía: quien la pide no la guarda (EC-08).
// Falla si el navegador no tiene geolocation (algunos, o páginas sin HTTPS, aunque los tipos digan
// que sí) o si la persona no da permiso.
export function askLocation(): Promise<Point> {
  const { geolocation } = navigator as Partial<Navigator>;
  if (!geolocation) return Promise.reject(new Error('Sin geolocalización en este navegador'));
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(({ coords }) => {
      resolve({ lat: coords.latitude, lng: coords.longitude });
    }, reject);
  });
}
