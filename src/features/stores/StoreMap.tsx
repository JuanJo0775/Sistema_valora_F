import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { directionsTo } from '../../shared/directions';
import { MUNICIPALITY_CENTERS, type Municipality } from '../comparison/criteria';
import { clusterPoints } from './cluster';
import { pinHtml } from './pinShapes';
import { usePinShapes } from './pinShapePref';

export interface MapStore {
  id: string;
  name: string;
  // El tipo da el color (y, si se pidió, la forma) del marcador (barrio, minimercado, supermercado, descuento).
  type?: string;
  lat: number;
  lng: number;
}

// Dónde está la persona y hasta dónde se busca (solo en pantalla: no se guarda, EC-08).
export interface Around {
  lat: number;
  lng: number;
  radiusKm: number;
  // Mientras se arrastra la barra del radio el círculo se redimensiona, pero la vista no se mueve.
  dragging?: boolean;
}

// Tamaño táctil del pin y distancia en pantalla a la que dos tiendas se juntan en un grupo.
const PIN = 36;
const CLUSTER_PX = 44;

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
  municipality,
  pinsFocusable = true,
}: {
  stores: MapStore[];
  label: string;
  onPick?: (point: { lat: number; lng: number }) => void;
  picked?: { lat: number; lng: number } | null;
  around?: Around | null;
  municipality?: Municipality;
  // Los pines se alcanzan con Tab y abren su globo con Enter (H-32). Si al lado hay una lista de las
  // mismas tiendas con los mismos botones (el mapa de tiendas), la lista es el camino del teclado: los
  // pines pasan a ser imágenes con nombre, sin parada de Tab, para no sumar 50 paradas ni saltar el orden.
  pinsFocusable?: boolean;
}) {
  // Solo importa si hay círculo, no cuánto mide: arrastrar la barra no vuelve a dibujar las tiendas.
  const hasAround = around !== null;
  const lat = around?.lat;
  const lng = around?.lng;
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const pickedLayer = useRef<L.LayerGroup | null>(null);
  const aroundLayer = useRef<L.LayerGroup | null>(null);
  const circle = useRef<L.Circle | null>(null);
  // El último onPick, sin volver a crear el mapa cada vez que cambia.
  const pick = useRef(onPick);
  const navigate = useNavigate();
  // Accesibilidad: con la preferencia activa, cada tipo suma su forma al color (Ajustes).
  const shaped = usePinShapes();

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!element.current) return;
    // La rueda del ratón hace zoom. En el celular no hay rueda: un dedo sigue desplazando la página y
    // dos dedos hacen zoom en el mapa.
    const created = L.map(element.current, { scrollWheelZoom: true, ...motionOptions() });
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
    const center =
      lat === undefined || lng === undefined
        ? MUNICIPALITY_CENTERS[municipality ?? 'armenia']
        : ([lat, lng] as [number, number]);
    map.current?.setView(center, 14, { animate: false });
  }, [lat, lng, municipality]);

  useEffect(() => {
    const layer = pins.current;
    const current = map.current;
    if (!current || !layer) return;
    // Ventana del marcador: el nombre y un botón que navega dentro de la app (sin recargar).
    const popupFor = (store: MapStore, marker: () => L.Marker) => {
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
      popup.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        marker().closePopup();
        marker().getElement()?.focus();
      });
      return { popup, route };
    };
    // H-32: el pin es un botón con el nombre de la tienda. Enter o Espacio abren su ventana
    // (preventDefault evita que Leaflet lo vuelva a tomar como clic y la cierre) y llevan el foco a su
    // primer enlace; Escape la cierra y devuelve el foco al pin. La lista sigue siendo la alternativa.
    const onKeys = (marker: L.Marker, run: () => void) => {
      if (!pinsFocusable) return;
      marker.on('add', () => {
        marker.getElement()?.addEventListener('keydown', (event: Event) => {
          const { key } = event as KeyboardEvent;
          if (key !== 'Enter' && key !== ' ') return;
          event.preventDefault();
          run();
        });
      });
    };
    // El nombre accesible del marcador. Sin foco no es un botón: es una imagen con nombre.
    const named = (marker: L.Marker, name: string) => {
      marker.on('add', () => {
        const element = marker.getElement();
        element?.setAttribute('aria-label', name);
        if (!pinsFocusable) element?.setAttribute('role', 'img');
      });
    };
    const draw = () => {
      layer.clearLayers();
      // Cerca se juntan en un grupo con su contador; muy cerca del suelo (zoom 17+) ya van sueltas.
      const zoom = current.getZoom();
      const groups = clusterPoints(
        stores,
        Number.isFinite(zoom) ? zoom : 14,
        zoom >= 17 ? -1 : CLUSTER_PX,
      );
      for (const group of groups) {
        const [only] = group.items;
        if (group.items.length === 1 && only) {
          const store = only;
          const kind = store.type ? ` type-${store.type}` : '';
          const marker: L.Marker = L.marker([store.lat, store.lng], {
            icon: L.divIcon({
              className: `store-pin${kind}`,
              html: pinHtml(store.type, shaped),
              iconSize: [PIN, PIN],
              iconAnchor: [PIN / 2, PIN / 2],
              popupAnchor: [0, -PIN / 2],
            }),
            title: store.name,
            alt: store.name,
            keyboard: pinsFocusable,
          });
          const { popup, route } = popupFor(store, () => marker);
          marker.bindPopup(popup);
          named(marker, store.name);
          onKeys(marker, () => {
            marker.openPopup();
            route.focus();
          });
          marker.addTo(layer);
          continue;
        }
        const count = group.items.length;
        const label = `Grupo de ${String(count)} tiendas. Toca para acercar y verlas.`;
        const zoomIn = () => {
          current.fitBounds(L.latLngBounds(group.items.map(({ lat, lng }) => [lat, lng])), {
            padding: [48, 48],
            maxZoom: 18,
          });
        };
        const marker = L.marker([group.lat, group.lng], {
          icon: L.divIcon({
            className: 'store-cluster',
            html: `<span>${String(count)}</span>`,
            iconSize: [PIN, PIN],
            iconAnchor: [PIN / 2, PIN / 2],
          }),
          title: label,
          alt: label,
          keyboard: pinsFocusable,
        });
        marker.on('click', zoomIn);
        named(marker, label);
        onKeys(marker, zoomIn);
        marker.addTo(layer);
      }
    };
    draw();
    // Al acercar o alejar los grupos se rehacen.
    current.on('zoomend', draw);
    // Los mapas sin municipio explícito encuadran sus tiendas si no hay radio.
    if (stores.length > 0 && !hasAround && !municipality) {
      current.fitBounds(L.latLngBounds(stores.map(({ lat, lng }) => [lat, lng])), {
        padding: [24, 24],
        maxZoom: 16,
      });
    }
    return () => {
      current.off('zoomend', draw);
    };
  }, [stores, navigate, hasAround, shaped, municipality, pinsFocusable]);

  // La persona y su círculo: se vuelven a dibujar solo si cambia dónde está.
  useEffect(() => {
    const layer = aroundLayer.current;
    if (!map.current || !layer) return;
    layer.clearLayers();
    circle.current = null;
    if (lat === undefined || lng === undefined) return;
    circle.current = L.circle([lat, lng], {
      // El tamaño real lo pone el efecto de abajo.
      radius: 1,
      className: 'radius-circle',
    }).addTo(layer);
    // «Tú estás aquí»: un punto con halo que late, de forma y color que ninguna tienda usa.
    const you = L.marker([lat, lng], {
      icon: L.divIcon({
        className: 'user-pin',
        html: '<span class="you-halo"></span><span class="you-dot"></span>',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
    });
    you.on('add', () => {
      const element = you.getElement();
      element?.setAttribute('role', 'img');
      element?.setAttribute('aria-label', 'Tú estás aquí');
    });
    you.addTo(layer);
  }, [lat, lng]);

  // El radio: el círculo se redimensiona en vivo; la vista se ajusta a él al soltar, no al arrastrar.
  const radiusKm = around?.radiusKm;
  const dragging = around?.dragging ?? false;
  useEffect(() => {
    if (!map.current || !circle.current || radiusKm === undefined) return;
    circle.current.setRadius(radiusKm * 1000);
    if (!dragging) map.current.fitBounds(circle.current.getBounds(), { padding: [16, 16] });
  }, [lat, lng, radiusKm, dragging]);

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
