/**
 * Mapa real del recorrido: Leaflet + tiles de OpenStreetMap (sin API key).
 *
 * Dibuja la geometría real de la ruta (coral punteado, estilo crepúsculo),
 * los waypoints (origen azulado, paradas/destino coral) con su nombre, y las
 * estaciones recomendadas con el color de su bandera y un popup con el precio
 * y su estado (exacto / estimado).
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

function stationColor(brandId: string): string {
  return BRAND_COLORS[brandId]?.bg ?? '#4A5578';
}

function stationPopup(s: Station): string {
  const estado = s.price.exact
    ? `<span class="map-popup-badge exact">${priceStateLabel(s.price.source)}</span>`
    : `<span class="map-popup-badge">${priceStateLabel(s.price.source)}</span>`;
  const approx = s.price.exact ? '' : '≈ ';
  return `
    <div class="map-popup">
      <div class="map-popup-brand">${escapeHtml(s.brand)}</div>
      <div class="map-popup-place">${escapeHtml(s.place)} · km ${s.kmFromStart}</div>
      <div class="map-popup-price">${approx}${formatARSCompact(s.price.pricePerLiter)}/L ${estado}</div>
    </div>`;
}

/** Monta el mapa del plan en `container` y devuelve la instancia. */
export function renderRouteMap(container: HTMLElement, plan: TripPlan): L.Map {
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

  // Estaciones recomendadas, coloreadas por bandera, con popup de precio.
  for (const s of plan.stations) {
    L.circleMarker([s.coord.lat, s.coord.lng], {
      radius: 7,
      color: '#FFFDFA',
      weight: 2,
      fillColor: stationColor(s.brandId),
      fillOpacity: 1,
    })
      .addTo(map)
      .bindPopup(stationPopup(s), { closeButton: false });
  }

  map.fitBounds(line.getBounds(), { padding: [34, 34] });
  return map;
}
