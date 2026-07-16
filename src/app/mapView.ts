/**
 * Mapa real del recorrido: Leaflet + tiles de OpenStreetMap (sin API key).
 *
 * Dibuja la geometría real de la ruta (coral punteado, estilo crepúsculo),
 * los waypoints (origen azulado, paradas/destino coral) con su nombre, las
 * estaciones (la elegida de cada carga con pin NUMERADO entero; las
 * alternativas y las de backup con pin chico sin número) y las cabinas de
 * peaje. Los popups muestran precio y estado.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Station, TollBooth, TripPlan } from '../domain/types';
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
  /** Marcador por id de estación, para enfocar/actualizar desde las cards. */
  stationMarkers: Map<string, L.Marker>;
}

function stationColor(brandId: string): string {
  return BRAND_COLORS[brandId]?.bg ?? '#4A5578';
}

/** Una estación es "la elegida" de su carga si su seq es un entero (sin punto). */
function isChosen(seq: string | undefined): boolean {
  return seq != null && !seq.includes('.');
}

function stationPopup(s: Station): string {
  const estado = s.price.exact
    ? `<span class="map-popup-badge exact">${priceStateLabel(s.price.source)}</span>`
    : `<span class="map-popup-badge">${priceStateLabel(s.price.source)}</span>`;
  const approx = s.price.exact ? '' : '≈ ';
  const num = isChosen(s.seq)
    ? `<span class="map-popup-num">${escapeHtml(s.seq!)}</span> `
    : s.seq != null
      ? `<span class="map-popup-alt">opción ${escapeHtml(s.seq)}</span> `
      : '';
  return `
    <div class="map-popup">
      <div class="map-popup-brand">${num}${escapeHtml(s.brand)}</div>
      <div class="map-popup-place">${escapeHtml(s.place)} · km ${s.kmFromStart}</div>
      <div class="map-popup-price">${approx}${formatARSCompact(s.price.pricePerLiter)}/L ${estado}</div>
    </div>`;
}

/**
 * Pin de estación. La elegida de la carga (seq entero) lleva pin grande con su
 * número; las alternativas de la carga y las de backup, pin chico sin número.
 */
export function stationIcon(s: Station): L.DivIcon {
  const color = stationColor(s.brandId);
  if (!isChosen(s.seq)) {
    return L.divIcon({
      className: 'station-pin-wrap',
      html: `<span class="station-pin station-pin-backup" style="background:${color}"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
  }
  return L.divIcon({
    className: 'station-pin-wrap',
    html: `<span class="station-pin" style="background:${color}">${s.seq}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -13],
  });
}

function tollIcon(): L.DivIcon {
  return L.divIcon({
    className: 'toll-pin-wrap',
    html: `<span class="toll-pin">$</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -11],
  });
}

function tollPopup(b: TollBooth): string {
  return `
    <div class="map-popup">
      <div class="map-popup-brand">🛣 Peaje ${escapeHtml(b.name)}</div>
      <div class="map-popup-place">${escapeHtml(b.road)} · ${escapeHtml(b.operator)} · km ${b.kmFromStart}</div>
      <div class="map-popup-price">${formatARSCompact(b.price)} <span class="map-popup-badge">auto · estimado</span></div>
    </div>`;
}

/** Reemplaza el icono y popup de una estación tras cambiar la elegida. */
export function refreshStationMarker(handles: RouteMapHandles, s: Station): void {
  const marker = handles.stationMarkers.get(s.id);
  if (!marker) return;
  marker.setIcon(stationIcon(s));
  marker.setPopupContent(stationPopup(s));
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

  // Cabinas de peaje sobre la ruta.
  for (const b of plan.tollBooths) {
    L.marker([b.coord.lat, b.coord.lng], { icon: tollIcon(), zIndexOffset: -100 })
      .addTo(map)
      .bindPopup(tollPopup(b), { closeButton: false });
  }

  // Estaciones con pin según el plan de cargas.
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
