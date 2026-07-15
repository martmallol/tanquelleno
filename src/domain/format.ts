/**
 * Formateo de números y textos en español de Argentina.
 * Centralizado para que toda la UI muestre "$ 126.900", "1.075 km", etc. igual.
 */

import type { FuelType, PriceSource } from './types';

const ars = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** "$ 126.900" */
export function formatARS(value: number): string {
  return `$ ${ars.format(Math.round(value))}`;
}

/** "$ 1.640" (sin espacio antes del número, para inline) */
export function formatARSCompact(value: number): string {
  return `$${ars.format(Math.round(value))}`;
}

/** "1.075 km" */
export function formatKm(value: number): string {
  return `${ars.format(Math.round(value))} km`;
}

/** "77 litros" / "1 litro" */
export function formatLiters(value: number): string {
  const n = Math.round(value);
  return `${ars.format(n)} ${n === 1 ? 'litro' : 'litros'}`;
}

/** "2 cargas" / "1 carga" / "0 cargas" */
export function formatStops(value: number): string {
  return `${value} ${value === 1 ? 'carga' : 'cargas'}`;
}

/** "6,3 L/100 km" (coma decimal AR) */
export function formatConsumption(lPer100: number): string {
  return `${lPer100.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L/100 km`;
}

export function fuelLabel(fuel: FuelType): string {
  return fuel === 'super' ? 'Súper' : 'Premium / Infinia';
}

export function fuelLabelShort(fuel: FuelType): string {
  return fuel === 'super' ? 'Súper' : 'Premium';
}

/** Texto del badge de estado de precio. */
export function priceStateLabel(source: PriceSource): string {
  switch (source) {
    case 'station':
      return 'precio exacto';
    case 'province':
      return 'estimado provincial';
    case 'national':
      return 'estimado nacional';
  }
}
