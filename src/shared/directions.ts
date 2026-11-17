// ADR-019: el mapa es OpenStreetMap; Google solo como enlace externo de rutas. Solo va la ubicación
// de la tienda, nunca la de la persona.
export const directionsTo = ({ lat, lng }: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?${new URLSearchParams({
    api: '1',
    destination: `${String(lat)},${String(lng)}`,
  }).toString()}`;
