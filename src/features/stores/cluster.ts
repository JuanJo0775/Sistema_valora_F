// Agrupar tiendas cercanas según la distancia en pantalla (píxeles) al zoom actual. Propio y simple:
// son ~50 tiendas, no hace falta una librería. Un grupo solo existe si junta 2 o más.
export interface Point {
  lat: number;
  lng: number;
}

export interface Group<T extends Point> {
  items: T[];
  lat: number;
  lng: number;
}

// Mercator en píxeles de un mapa de 256 × 2^zoom.
function project({ lat, lng }: Point, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const sin = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

export function clusterPoints<T extends Point>(
  items: T[],
  zoom: number,
  distancePx: number,
): Group<T>[] {
  const groups: { items: T[]; x: number; y: number }[] = [];
  for (const item of items) {
    const here = project(item, zoom);
    const near = groups.find((g) => Math.hypot(g.x - here.x, g.y - here.y) <= distancePx);
    if (near) {
      near.items.push(item);
      // El centro del grupo es el promedio de sus tiendas.
      near.x += (here.x - near.x) / near.items.length;
      near.y += (here.y - near.y) / near.items.length;
    } else {
      groups.push({ items: [item], x: here.x, y: here.y });
    }
  }
  return groups.map(({ items: members }) => ({
    items: members,
    lat: members.reduce((sum, { lat }) => sum + lat, 0) / members.length,
    lng: members.reduce((sum, { lng }) => sum + lng, 0) / members.length,
  }));
}
