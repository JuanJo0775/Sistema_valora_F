import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';

export interface MapStore {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

// Centro de Armenia: el mapa arranca en el municipio, no en la ubicación de la persona (ADR-019).
const ARMENIA: L.LatLngExpression = [4.5339, -75.6811];

// ADR-019: Leaflet sobre teselas de OpenStreetMap, con su atribución visible. El mapa es una ayuda
// visual; la lista de tiendas de la pantalla es su equivalente accesible.
export function StoreMap({
  stores,
  label,
  onPick,
  picked = null,
}: {
  stores: MapStore[];
  label: string;
  onPick?: (point: { lat: number; lng: number }) => void;
  picked?: { lat: number; lng: number } | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const pickedLayer = useRef<L.LayerGroup | null>(null);
  // El último onPick, sin volver a crear el mapa cada vez que cambia.
  const pick = useRef(onPick);
  const navigate = useNavigate();

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!element.current) return;
    const created = L.map(element.current, { scrollWheelZoom: false }).setView(ARMENIA, 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(created);
    map.current = created;
    pins.current = L.layerGroup().addTo(created);
    pickedLayer.current = L.layerGroup().addTo(created);
    // #12: al proponer una tienda, el toque en el mapa elige su ubicación (la de la tienda, EC-08).
    created.on('click', ({ latlng }: L.LeafletMouseEvent) => {
      pick.current?.({ lat: latlng.lat, lng: latlng.lng });
    });
    return () => {
      created.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const layer = pins.current;
    if (!map.current || !layer) return;
    layer.clearLayers();
    for (const store of stores) {
      // Ventana del marcador: el nombre y un botón que navega dentro de la app (sin recargar).
      const popup = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = store.name;
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'pin-link';
      open.textContent = 'Ver precios';
      open.addEventListener('click', () => {
        void navigate(`/tiendas/${store.id}`);
      });
      popup.append(name, document.createElement('br'), open);
      L.circleMarker([store.lat, store.lng], { radius: 8, className: 'store-pin' })
        .bindPopup(popup)
        .addTo(layer);
    }
    if (stores.length > 0) {
      map.current.fitBounds(L.latLngBounds(stores.map(({ lat, lng }) => [lat, lng])), {
        padding: [24, 24],
        maxZoom: 16,
      });
    }
  }, [stores, navigate]);

  useEffect(() => {
    const layer = pickedLayer.current;
    if (!map.current || !layer) return;
    layer.clearLayers();
    if (!picked) return;
    L.circleMarker([picked.lat, picked.lng], { radius: 10, className: 'picked-pin' }).addTo(layer);
    map.current.panTo([picked.lat, picked.lng]);
  }, [picked]);

  return <div ref={element} className="store-map" role="region" aria-label={label} />;
}
