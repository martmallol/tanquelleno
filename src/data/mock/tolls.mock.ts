/**
 * Adapter mock de peajes.
 *
 * Estima un costo proporcional a la distancia (una pasada), con un valor por
 * cabina cada ~120 km. Placeholder hasta tener datos de peaje reales.
 */

import type { Route } from '../../domain/types';
import type { TollService } from '../ports';

const AVG_TOLL_ARS = 1200;
const KM_PER_TOLL = 120;

const delay = <T>(value: T, ms = 60): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export const mockTolls: TollService = {
  async estimateTolls(route: Route) {
    const legs = route.roundTrip ? 2 : 1;
    const booths = Math.round((route.distanceKm / KM_PER_TOLL) * legs);
    return delay(booths * AVG_TOLL_ARS);
  },
};
