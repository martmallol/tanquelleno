/**
 * Utilidades geográficas puras.
 *
 * Se usan para aproximar distancia y geometría de ruta mientras no esté el
 * provider real. Cuando entre Mapbox/Google, la distancia y la polilínea las
 * da el provider y estas funciones quedan solo para dibujar/medir sobre ella.
 */

import type { LatLng } from './types';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Distancia en línea recta (gran círculo) entre dos coordenadas, en km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Factor que aproxima el sobre-recorrido de una ruta real respecto de la
 * línea recta. Las rutas argentinas de larga distancia rondan 1.2–1.3×.
 */
export const ROUTE_FACTOR = 1.25;

/** Distancia de ruta estimada entre dos puntos (Haversine × factor). */
export function routeDistanceKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * ROUTE_FACTOR;
}

/** Interpola linealmente entre dos coordenadas (t ∈ [0,1]). */
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

/**
 * Genera una polilínea aproximada uniendo waypoints con puntos intermedios.
 * @param segmentsPerLeg cuántos puntos meter entre cada par de waypoints.
 */
export function buildGeometry(waypoints: LatLng[], segmentsPerLeg = 8): LatLng[] {
  if (waypoints.length < 2) return [...waypoints];
  const out: LatLng[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]!;
    const b = waypoints[i + 1]!;
    for (let s = 0; s < segmentsPerLeg; s++) {
      out.push(lerp(a, b, s / segmentsPerLeg));
    }
  }
  out.push(waypoints[waypoints.length - 1]!);
  return out;
}

/** Distancia perpendicular aproximada de un punto a un segmento, en km. */
export function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  // Proyección en el espacio lat/lng corregido por longitud (suficiente a
  // escala de decenas de km). Convertimos a un plano local en km.
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos(toRad((a.lat + b.lat) / 2));
  const ax = a.lng * kmPerDegLng;
  const ay = a.lat * kmPerDegLat;
  const bx = b.lng * kmPerDegLng;
  const by = b.lat * kmPerDegLat;
  const px = p.lng * kmPerDegLng;
  const py = p.lat * kmPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projx = ax + t * dx;
  const projy = ay + t * dy;
  return Math.hypot(px - projx, py - projy);
}

/** Distancia mínima de un punto a una polilínea, en km. */
export function distanceToPathKm(p: LatLng, path: LatLng[]): number {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distanceToSegmentKm(p, path[i]!, path[i + 1]!);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Km recorridos sobre la ruta hasta el punto de la polilínea más cercano a `p`.
 * Aproxima "a qué altura del viaje" cae una estación.
 */
export function kmAlongPath(p: LatLng, path: LatLng[]): number {
  let acc = 0;
  let best = { dist: Infinity, km: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const segLen = routeDistanceKm(a, b);
    const d = distanceToSegmentKm(p, a, b);
    if (d < best.dist) {
      // Aproxima la fracción del segmento por cercanía a los extremos.
      const da = haversineKm(p, a);
      const db = haversineKm(p, b);
      const frac = da + db === 0 ? 0 : da / (da + db);
      best = { dist: d, km: acc + segLen * frac };
    }
    acc += segLen;
  }
  return best.km;
}
