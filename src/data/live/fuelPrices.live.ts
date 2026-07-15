/**
 * Adapter live de FuelPriceService sobre el dataset oficial de surtidor.
 *
 * Cascada idéntica a la del mock (misma semántica de estados):
 *   estación puntual (dataset)  → source 'station'  → "precio exacto"
 *   promedio provincial (dataset) → source 'province' → "estimado provincial"
 *   promedio nacional (constante) → source 'national' → "estimado nacional"
 *
 * El promedio provincial se calcula sobre los precios vigentes reales de la
 * provincia (mismo fetch cacheado que usan las estaciones).
 */

import type { FuelPrice, FuelType } from '../../domain/types';
import type { FuelPriceService } from '../ports';
import { fetchProvincePrices } from './energia';
import { NATIONAL_PRICES } from '../mock/fuelPrices.data';

function national(fuel: FuelType): FuelPrice {
  return { fuel, pricePerLiter: NATIONAL_PRICES[fuel], source: 'national', exact: false };
}

async function provinceAvg(provinceId: string, fuel: FuelType): Promise<FuelPrice> {
  const records = await fetchProvincePrices(provinceId, fuel).catch(() => []);
  if (records.length === 0) return national(fuel);
  const avg = records.reduce((acc, r) => acc + r.precio, 0) / records.length;
  return { fuel, pricePerLiter: Math.round(avg), source: 'province', exact: false };
}

export const liveFuelPrices: FuelPriceService = {
  async priceAtStation(stationId, provinceId, fuel) {
    const records = await fetchProvincePrices(provinceId, fuel).catch(() => []);
    const rec = records.find((r) => r.stationId === stationId);
    if (rec) {
      return { fuel, pricePerLiter: rec.precio, source: 'station', exact: true };
    }
    return provinceAvg(provinceId, fuel);
  },

  async provinceAverage(provinceId, fuel) {
    return provinceAvg(provinceId, fuel);
  },

  async nationalAverage(fuel) {
    return national(fuel);
  },
};
