/**
 * Mapa real del recorrido: Leaflet + tiles de OpenStreetMap (sin API key).
 *
 * Dibuja la geometría real de la ruta (coral punteado, estilo crepúsculo),
 * los waypoints (origen azulado, paradas/destino coral) con su nombre, y las
 * estaciones con un pin NUMERADO que coincide con el número de su card en el
 * plan de cargas. El popup muestra precio y estado (exacto / estimado).
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Station, TripPlan } from '../domain/types';
import { formatARSCompact, priceStateLabel } from '../domain/format';
import { escapeHtml } from './dom';
import { BRAND_COLORS } from '../data/mock/stations.data';

const ROUTE_STYLE: L.PolylineOptions = {
  color: '#F87F6D',
  weight: 4,
  dashArray: '10 9',
  lineCap: 'round',
  lineJoin: 'round',
};

export interface RouteMapHandles {
  map: L.Map;
  /** Marcador por id de estación, para enfocar desde las cards. */
  stationMarkers: Map<string, L.Marker>;
}

function stationColor(brandId: string): string {
  return BRAND_COLORS[brandId]?.bg ?? '#4A5578';
}

function stationPopup(s: Station): string {
  const estado = s.price.exact
    ? `<span class="map-popup-badge exact">${priceStateLabel(s.price.source)}</span>`
    : `<span class="map-popup-badge">${priceStateLabel(s.price.source)}</span>`;
  const approx = s.price.exact ? '' : '≈ ';
  const num = s.seq != null ? `<span class="map-popup-num">${s.seq}</span> ` : '';
  return `
    <div class="map-popup">
      <div class="map-popup-brand">${num}${escapeHtml(s.brand)}</div>
      <div class="map-popup-place">${escapeHtml(s.place)} · km ${s.kmFromStart}</div>
      <div class="map-popup-price">${approx}${formatARSCompact(s.price.pricePerLiter)}/L ${estado}</div>
    </div>`;
}

/** Pin numerado con el color de la bandera de la estación. */
function stationIcon(s: Station): L.DivIcon {
  const color = stationColor(s.brandId);
  return L.divIcon({
    className: 'station-pin-wrap',
    html: `<span class="station-pin" style="background:${color}">${s.seq ?? '⛽'}</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  });
}

/** Monta el mapa del plan en `container` y devuelve mapa + marcadores. */
export function renderRouteMap(container: HTMLElement, plan: TripPlan): RouteMapHandles {
  const map = L.map(container, {
    zoomControl: true,
    scrollWheelZoom: false, // no robar el scroll de la página
    attributionControl: true,
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  const line = L.polyline(
    plan.route.geometry.map((p) => [p.lat, p.lng] as [number, number]),
    ROUTE_STYLE,
  ).addTo(map);

  // Waypoints con etiqueta permanente (origen azulado, resto coral).
  plan.route.waypoints.forEach((w, i) => {
    const isOrigin = i === 0;
    L.circleMarker([w.coord.lat, w.coord.lng], {
      radius: 8,
      color: '#FFFDFA',
      weight: 2,
      fillColor: isOrigin ? '#4A5578' : '#E4674F',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(escapeHtml(w.name), {
        permanent: true,
        direction: 'top',
        offset: [0, -8],
        className: 'map-waypoint-label',
      });
  });

  // Estaciones con pin numerado según el plan de cargas.
  const stationMarkers = new Map<string, L.Marker>();
  const allStations = [...plan.refuelLegs.flatMap((l) => l.stations), ...plan.extraStations];
  for (const s of allStations) {
    const marker = L.marker([s.coord.lat, s.coord.lng], { icon: stationIcon(s) })
      .addTo(map)
      .bindPopup(stationPopup(s), { closeButton: false });
    stationMarkers.set(s.id, marker);
  }

  map.fitBounds(line.getBounds(), { padding: [34, 34] });

  // Al imprimir, el panel cambia de tamaño: Leaflet necesita recalcular.
  const onPrint = (): void => {
    map.invalidateSize();
    map.fitBounds(line.getBounds(), { padding: [24, 24] });
  };
  window.addEventListener('beforeprint', onPrint);
  map.on('unload', () => window.removeEventListener('beforeprint', onPrint));

  return { map, stationMarkers };
}
