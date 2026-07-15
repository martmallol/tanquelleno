/**
 * Adapter live de StationsService sobre el dataset oficial de surtidor.
 *
 * Un solo fetch por provincia trae estaciones + precio exacto vigente. De ahí:
 *   1. filtra las que caen a ≤ CORRIDOR_KM de la ruta real,
 *   2. calcula a qué km del viaje están,
 *   3. poda: en corredores urbanos densos habría cientos — se agrupa por tramos
 *      de ~BUCKET_KM y se conservan las más baratas de cada tramo.
 *
 * El precio de cada estación es EXACTO (source 'station'): viene del dataset.
 * El fallback provincial/nacional vive en fuelPrices.live para los promedios.
 */

import type { FuelType, Route, Station } from '../../domain/types';
import { distanceToPathKm, kmAlongPath } from '../../domain/geo';
import type { StationsService } from '../ports';
import { brandIdFromBandera, fetchProvincePrices, type EnergiaRecord } from './energia';

const CORRIDOR_KM = 15;
const BUCKET_KM = 80;
const PER_BUCKET = 2;
const MAX_STATIONS = 12;

/** Nombre corto y prolijo para mostrar ("YPF", "Shell", o la razón social). */
function displayBrand(bandera: string): string {
  const b = bandera.trim();
  if (/ypf/i.test(b)) return 'YPF';
  if (/shell/i.test(b)) return 'Shell';
  if (/axion/i.test(b)) return 'Axion Energy';
  if (/puma/i.test(b)) return 'Puma Energy';
  if (/gulf/i.test(b)) return 'Gulf';
  if (/refinor/i.test(b)) return 'Refinor';
  if (/blanca/i.test(b)) return 'Bandera blanca';
  return b.charAt(0) + b.slice(1).toLowerCase();
}

/** Convierte un registro del dataset en Station si cae dentro del corredor. */
export function stationFromRecord(
  rec: EnergiaRecord,
  provinceId: string,
  fuel: FuelType,
  route: Route,
): Station | null {
  const coord = { lat: rec.lat, lng: rec.lng };
  if (distanceToPathKm(coord, route.geometry) > CORRIDOR_KM) return null;
  return {
    id: rec.stationId,
    brand: displayBrand(rec.bandera),
    brandId: brandIdFromBandera(rec.bandera),
    place: rec.localidad
      ? `${titleCase(rec.localidad)} · ${rec.direccion}`
      : rec.direccion,
    provinceId,
    kmFromStart: Math.round(kmAlongPath(coord, route.geometry)),
    coord,
    price: { fuel, pricePerLiter: rec.precio, source: 'station', exact: true },
  };
}

/**
 * Poda por tramos: agrupa por bloques de BUCKET_KM a lo largo de la ruta y se
 * queda con las PER_BUCKET más baratas de cada uno, hasta MAX_STATIONS.
 * Mantiene cobertura a lo largo de todo el recorrido en vez de amontonar
 * estaciones del área metropolitana.
 */
export function pruneAlongRoute(stations: Station[], maxStations = MAX_STATIONS): Station[] {
  const buckets = new Map<number, Station[]>();
  for (const s of stations) {
    const b = Math.floor(s.kmFromStart / BUCKET_KM);
    const list = buckets.get(b) ?? [];
    list.push(s);
    buckets.set(b, list);
  }
  const kept: Station[] = [];
  for (const [, list] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.price.pricePerLiter - b.price.pricePerLiter);
    kept.push(...list.slice(0, PER_BUCKET));
  }
  // Si superamos el máximo, priorizamos las más baratas globalmente.
  if (kept.length > maxStations) {
    kept.sort((a, b) => a.price.pricePerLiter - b.price.pricePerLiter);
    kept.length = maxStations;
  }
  return kept.sort((a, b) => a.kmFromStart - b.kmFromStart);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export const liveStations: StationsService = {
  async stationsAlongRoute(route: Route, fuel: FuelType) {
    // Provincias que toca el viaje ≈ provincias de los waypoints (dedup).
    const provinceIds = [...new Set(route.waypoints.map((w) => w.provinceId))];

    const perProvince = await Promise.all(
      provinceIds.map(async (provinceId) => {
        const records = await fetchProvincePrices(provinceId, fuel).catch(() => []);
        return records
          .map((rec) => stationFromRecord(rec, provinceId, fuel, route))
          .filter((s): s is Station => s !== null);
      }),
    );

    return pruneAlongRoute(perProvince.flat());
  },
};
