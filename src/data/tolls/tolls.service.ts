/**
 * Servicio de peajes basado en el dataset curado (tolls.data).
 *
 * Filtra las cabinas que caen cerca de la geometría de la ruta (como las
 * estaciones), calcula a qué km del viaje están y suma sus tarifas. En ida y
 * vuelta cada cabina se paga dos veces, así que el total duplica. Devuelve las
 * cabinas de una sola pasada (ordenadas por km) para el desglose y el mapa.
 */

import type { Route, TollBooth, TollEstimate } from '../../domain/types';
import { distanceToPathKm, kmAlongPath } from '../../domain/geo';
import type { TollService } from '../ports';
import { TOLLS, TOLLS_UPDATED_AT } from './tolls.data';

/** Radio máximo (km) para considerar que una cabina está "sobre la ruta". */
const CORRIDOR_KM = 12;

const delay = <T>(value: T, ms = 60): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export const curatedTolls: TollService = {
  async tollsForRoute(route: Route): Promise<TollEstimate> {
    const booths: TollBooth[] = TOLLS.map((t) => ({
      seed: t,
      corridor: distanceToPathKm({ lat: t.lat, lng: t.lng }, route.geometry),
      kmFromStart: Math.round(kmAlongPath({ lat: t.lat, lng: t.lng }, route.geometry)),
    }))
      .filter((x) => x.corridor <= CORRIDOR_KM)
      .sort((a, b) => a.kmFromStart - b.kmFromStart)
      .map(({ seed, kmFromStart }) => ({
        id: seed.id,
        name: seed.name,
        road: seed.road,
        operator: seed.operator,
        coord: { lat: seed.lat, lng: seed.lng },
        kmFromStart,
        price: seed.price,
      }));

    const legs = route.roundTrip ? 2 : 1;
    const total = booths.reduce((sum, b) => sum + b.price, 0) * legs;

    return delay({ total, booths, updatedAt: TOLLS_UPDATED_AT, source: 'Base propia (curada)' });
  },
};
