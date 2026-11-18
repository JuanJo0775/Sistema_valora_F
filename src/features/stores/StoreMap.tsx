import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { directionsTo } from '../../shared/directions';

export interface MapStore {
  id: string;
  name: string;
  // #73: el tipo da el color del marcador (barrio, minimercado, supermercado, descuento).
  type?: string;
  lat: number;
  lng: number;
}

// Dónde está la persona y hasta dónde se busca (solo en pantalla: no se guarda, EC-08).
export interface Around {
  lat: number;
  lng: number;
  radiusKm: number;
}

// Centro de Armenia: el mapa arranca en el municipio, no en la ubicación de la persona (ADR-019).
const ARMENIA: L.LatLngExpression = [4.5339, -75.6811];

// ADR-019: Leaflet sobre teselas de OpenStreetMap, con su atribución visible. El mapa es una ayuda
// visual; la lista de tiendas de la pantalla es su equivalente accesible.
// H-33: con «reducir movimiento» el mapa no anima el zoom, los marcadores ni los fundidos.
function motionOptions() {
  const reduce =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animated = !reduce;
  return { zoomAnimation: animated, fadeAnimation: animated, markerZoomAnimation: animated };
}

export function StoreMap({
  stores,
  label,
  onPick,
  picked = null,
  around = null,
}: {
  stores: MapStore[];
  label: string;
  onPick?: (point: { lat: number; lng: number }) => void;
  picked?: { lat: number; lng: number } | null;
  around?: Around | null;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const pickedLayer = useRef<L.LayerGroup | null>(null);
  const aroundLayer = useRef<L.LayerGroup | null>(null);
  // El último onPick, sin volver a crear el mapa cada vez que cambia.
  const pick = useRef(onPick);
  const navigate = useNavigate();

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!element.current) return;
    // La rueda del ratón hace zoom. En el celular no hay rueda: un dedo sigue desplazando la página y
    // dos dedos hacen zoom en el mapa.
    const created = L.map(element.current, { scrollWheelZoom: true, ...motionOptions() }).setView(
      ARMENIA,
      14,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(created);
    map.current = created;
    pins.current = L.layerGroup().addTo(created);
    pickedLayer.current = L.layerGroup().addTo(created);
    aroundLayer.current = L.layerGroup().addTo(created);
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
      // «Cómo llegar» va primero: quien solo quiere ir a la tienda no tiene que pasar por los precios.
      const route = document.createElement('a');
      route.href = directionsTo(store);
      route.target = '_blank';
      route.rel = 'noopener noreferrer';
      route.className = 'pin-link pin-route';
      route.textContent = 'Cómo llegar';
      route.setAttribute('aria-label', `Cómo llegar a ${store.name}`);
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'pin-link';
      open.textContent = 'Ver precios';
      open.addEventListener('click', () => {
        void navigate(`/tiendas/${store.id}`);
      });
      popup.append(name, document.createElement('br'), route, open);
      const kind = store.type ? ` type-${store.type}` : '';
      const marker = L.circleMarker([store.lat, store.lng], {
        radius: 9,
        className: `store-pin${kind}`,
      }).bindPopup(popup);
      // H-32: el pin es un trazo SVG; para el teclado se vuelve un botón con el nombre de la tienda.
      // Enter o Espacio abren el globo y llevan el foco a su primer enlace; Escape lo cierra y
      // devuelve el foco al pin. La lista de tiendas sigue siendo la alternativa completa.
      marker.on('add', () => {
        const pin = marker.getElement();
        if (!pin) return;
        pin.setAttribute('tabindex', '0');
        pin.setAttribute('role', 'button');
        pin.setAttribute('aria-label', store.name);
        pin.addEventListener('keydown', (event: Event) => {
          const { key } = event as KeyboardEvent;
          if (key !== 'Enter' && key !== ' ') return;
          event.preventDefault();
          marker.openPopup();
          route.focus();
        });
      });
      popup.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        marker.closePopup();
        (marker.getElement() as SVGElement | undefined)?.focus();
      });
      marker.addTo(layer);
    }
    // Con el radio, el mapa encuadra el círculo (abajo); sin él, las tiendas.
    if (stores.length > 0 && !around) {
      map.current.fitBounds(L.latLngBounds(stores.map(({ lat, lng }) => [lat, lng])), {
        padding: [24, 24],
        maxZoom: 16,
      });
    }
  }, [stores, navigate, around]);

  useEffect(() => {
    const layer = aroundLayer.current;
    if (!map.current || !layer) return;
    layer.clearLayers();
    if (!around) return;
    const circle = L.circle([around.lat, around.lng], {
      radius: around.radiusKm * 1000,
      className: 'radius-circle',
    }).addTo(layer);
    L.circleMarker([around.lat, around.lng], { radius: 7, className: 'user-pin' }).addTo(layer);
    map.current.fitBounds(circle.getBounds(), { padding: [16, 16] });
  }, [around]);

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
