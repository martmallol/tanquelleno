/**
 * Adapter live de DirectionsService:
 *   - Búsqueda de lugares: Nominatim (OpenStreetMap), restringida a Argentina.
 *   - Ruta real: OSRM público (distancia por camino + geometría GeoJSON).
 *
 * Ninguno requiere API key. Los lugares elegidos se registran en localStorage
 * para que getPlaceById(id) los resuelva entre páginas; los lugares del viaje
 * por defecto salen del dataset estático (PLACES).
 */

import type { LatLng, Place, Route } from '../../domain/types';
import type { DirectionsService } from '../ports';
import { getJson } from './http';
import { provinceIdFromName } from './provinces';
import { PLACES } from '../mock/places.data';

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = 'https://router.project-osrm.org';

interface NominatimItem {
  osm_type: string;
  osm_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  address?: { state?: string; city?: string; town?: string; village?: string };
}

interface OsrmResponse {
  code: string;
  routes: { distance: number; geometry: { coordinates: [number, number][] } }[];
}

// ---- Registro de lugares elegidos (id → Place), persistido ----

const REGISTRY_KEY = 'kmxkm.places.v1';

function readRegistry(): Record<string, Place> {
  try {
    return JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? '{}') as Record<string, Place>;
  } catch {
    return {};
  }
}

function registerPlace(place: Place): void {
  try {
    const reg = readRegistry();
    reg[place.id] = place;
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(reg));
  } catch {
    // sin storage seguimos igual: el lugar vive en memoria durante la sesión
  }
}

function placeFromNominatim(item: NominatimItem): Place {
  const name =
    item.name ??
    item.address?.city ??
    item.address?.town ??
    item.address?.village ??
    item.display_name.split(',')[0] ??
    'Lugar';
  const provinceName = item.address?.state ?? 'Buenos Aires';
  return {
    id: `osm-${item.osm_type}-${item.osm_id}`,
    name,
    province: provinceName,
    provinceId: provinceIdFromName(provinceName),
    coord: { lat: Number(item.lat), lng: Number(item.lon) },
  };
}

export const liveDirections: DirectionsService = {
  async searchPlaces(query) {
    const q = query.trim();
    if (q.length < 2) return [];
    const url =
      `${NOMINATIM}/search?q=${encodeURIComponent(q)}` +
      `&countrycodes=ar&format=jsonv2&limit=8&addressdetails=1&featureType=settlement`;
    const items = await getJson<NominatimItem[]>(url);
    const places = items.map(placeFromNominatim);
    places.forEach(registerPlace);
    return places;
  },

  async getPlaceById(id) {
    // 1) lugares elegidos antes (registro persistido)
    const registered = readRegistry()[id];
    if (registered) return registered;
    // 2) dataset estático (viaje por defecto y ciudades comunes)
    const seed = PLACES.find((p) => p.id === id);
    return seed ? { ...seed } : null;
  },

  async route(origin, stops, destination, roundTrip) {
    const waypoints: Place[] = [origin, ...stops, destination];
    const coords = waypoints.map((w) => `${w.coord.lng},${w.coord.lat}`).join(';');
    const url = `${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const res = await getJson<OsrmResponse>(url, 20000);
    if (res.code !== 'Ok' || res.routes.length === 0) {
      throw new Error('OSRM no encontró una ruta entre esos puntos.');
    }
    const best = res.routes[0]!;
    const geometry: LatLng[] = downsample(
      best.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      400,
    );
    const route: Route = {
      waypoints: waypoints.map((w) => ({ ...w })),
      distanceKm: Math.round(best.distance / 1000),
      geometry,
      roundTrip,
    };
    return route;
  },
};

/**
 * Reduce la polilínea a ~max puntos (la de OSRM puede traer miles). Suficiente
 * para dibujar y para medir distancia estación↔ruta con precisión de ~1 km.
 */
function downsample(points: LatLng[], max: number): LatLng[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: LatLng[] = [];
  for (let i = 0; i < max; i++) {
    out.push(points[Math.round(i * step)]!);
  }
  return out;
}
