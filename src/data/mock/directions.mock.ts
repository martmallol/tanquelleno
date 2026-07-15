/**
 * Adapter mock del servicio de rutas.
 *
 * Implementa DirectionsService aproximando distancia (Haversine × factor) y
 * geometría (interpolación entre waypoints) desde places.data.ts. La firma es
 * idéntica a la que cumpliría un wrapper de Google/Mapbox Directions.
 */

import type { Place, Route } from '../../domain/types';
import { buildGeometry, routeDistanceKm } from '../../domain/geo';
import type { DirectionsService } from '../ports';
import { PLACES } from './places.data';

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export const mockDirections: DirectionsService = {
  async searchPlaces(query) {
    const q = norm(query);
    if (!q) return delay<Place[]>([]);
    const matches = PLACES.filter(
      (p) => norm(p.name).includes(q) || norm(p.province).includes(q),
    ).slice(0, 8);
    return delay(matches.map((p) => ({ ...p })));
  },

  async getPlaceById(id) {
    const place = PLACES.find((p) => p.id === id);
    return delay<Place | null>(place ? { ...place } : null);
  },

  async route(origin, stops, destination, roundTrip) {
    const waypoints: Place[] = [origin, ...stops, destination];
    let distanceKm = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      distanceKm += routeDistanceKm(waypoints[i]!.coord, waypoints[i + 1]!.coord);
    }
    const geometry = buildGeometry(waypoints.map((w) => w.coord));
    const route: Route = {
      waypoints: waypoints.map((w) => ({ ...w })),
      distanceKm: Math.round(distanceKm),
      geometry,
      roundTrip,
    };
    return delay(route);
  },
};
