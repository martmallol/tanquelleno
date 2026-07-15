/**
 * Adapter mock de estaciones sobre la ruta.
 *
 * Implementa StationsService: filtra las estaciones que caen cerca de la
 * polilínea (como haría Places/POI a lo largo de la ruta), calcula a qué km
 * del viaje están y les resuelve el precio con el FuelPriceService (heredando
 * el estado exacto/estimado). Depende de mockFuelPrices para el precio.
 */

import type { FuelType, Route, Station } from '../../domain/types';
import { distanceToPathKm, kmAlongPath } from '../../domain/geo';
import type { StationsService } from '../ports';
import { mockFuelPrices } from './fuelPrices.mock';
import { STATIONS } from './stations.data';

/** Radio máximo (km) para considerar que una estación está "sobre la ruta". */
const CORRIDOR_KM = 25;

const delay = <T>(value: T, ms = 160): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export const mockStations: StationsService = {
  async stationsAlongRoute(route: Route, fuel: FuelType) {
    const near = STATIONS.map((s) => ({
      seed: s,
      corridor: distanceToPathKm(s.coord, route.geometry),
      kmFromStart: Math.round(kmAlongPath(s.coord, route.geometry)),
    }))
      .filter((x) => x.corridor <= CORRIDOR_KM)
      .sort((a, b) => a.kmFromStart - b.kmFromStart);

    const stations: Station[] = await Promise.all(
      near.map(async ({ seed, kmFromStart }) => {
        const price = await mockFuelPrices.priceAtStation(seed.id, seed.provinceId, fuel);
        return {
          id: seed.id,
          brand: seed.brand,
          brandId: seed.brandId,
          place: seed.place,
          provinceId: seed.provinceId,
          kmFromStart,
          coord: { ...seed.coord },
          price,
        };
      }),
    );

    return delay(stations);
  },
};
