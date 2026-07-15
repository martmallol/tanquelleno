/**
 * Adapter mock de precios de nafta (naftas.com.ar).
 *
 * Implementa el fallback en cascada que la app necesita porque no hay API
 * pública garantizada del precio por estación:
 *
 *   estación puntual  → source 'station'  → exact: true   ("precio exacto")
 *   promedio provincia → source 'province' → exact: false  ("estimado provincial")
 *   promedio nacional  → source 'national' → exact: false  ("estimado nacional")
 */

import type { FuelPrice, FuelType } from '../../domain/types';
import type { FuelPriceService } from '../ports';
import { NATIONAL_PRICES, PROVINCE_PRICES, STATION_PRICES } from './fuelPrices.data';

const delay = <T>(value: T, ms = 90): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function national(fuel: FuelType): FuelPrice {
  return {
    fuel,
    pricePerLiter: NATIONAL_PRICES[fuel],
    source: 'national',
    exact: false,
  };
}

function province(provinceId: string, fuel: FuelType): FuelPrice {
  const p = PROVINCE_PRICES[provinceId];
  if (!p) return national(fuel);
  return {
    fuel,
    pricePerLiter: p[fuel],
    source: 'province',
    exact: false,
  };
}

export const mockFuelPrices: FuelPriceService = {
  async priceAtStation(stationId, provinceId, fuel) {
    const exact = STATION_PRICES[stationId]?.[fuel];
    if (exact != null) {
      return delay<FuelPrice>({ fuel, pricePerLiter: exact, source: 'station', exact: true });
    }
    // Sin dato puntual: cae al promedio provincial (o nacional).
    return delay(province(provinceId, fuel));
  },

  async provinceAverage(provinceId, fuel) {
    return delay(province(provinceId, fuel));
  },

  async nationalAverage(fuel) {
    return delay(national(fuel));
  },
};
