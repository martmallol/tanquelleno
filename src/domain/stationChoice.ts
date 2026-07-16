/**
 * Elección de estación por carga y precio resultante — lógica pura.
 *
 * El usuario elige en qué estación carga en cada tramo del viaje; el precio/L
 * base sale del promedio de las elegidas. Sin selección, la elegida por defecto
 * es la más barata de cada carga. Estas funciones no tocan el DOM ni la red, así
 * que se testean solas; resultado.ts las usa para pintar los importes.
 */

import type { RefuelLeg, Station, TripPlan } from './types';

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Cargas que tienen al menos una estación candidata. */
export function legsWithStations(plan: TripPlan): RefuelLeg[] {
  return plan.refuelLegs.filter((l) => l.stations.length > 0);
}

/**
 * Estación elegida de una carga: la seleccionada por el usuario o, por defecto,
 * la más barata (índice 0, ya ordenadas por precio). null si la carga no tiene
 * estaciones en su ventana.
 */
export function chosenStation(leg: RefuelLeg, selected: Map<number, string>): Station | null {
  if (leg.stations.length === 0) return null;
  const id = selected.get(leg.n) ?? leg.stations[0]!.id;
  return leg.stations.find((s) => s.id === id) ?? leg.stations[0]!;
}

/** Precio/L con la selección actual (promedio de las estaciones elegidas). */
export function currentBasis(plan: TripPlan, selected: Map<number, string>): number {
  const legs = legsWithStations(plan);
  if (legs.length > 0) {
    return avg(legs.map((l) => chosenStation(l, selected)!.price.pricePerLiter));
  }
  return plan.avgPricePerLiter;
}

/** Precio/L del mejor caso: cargar en la más barata de cada carga. */
export function bestBasis(plan: TripPlan): number {
  const legs = legsWithStations(plan);
  if (legs.length > 0) {
    return avg(legs.map((l) => Math.min(...l.stations.map((s) => s.price.pricePerLiter))));
  }
  if (plan.stations.length > 0) return Math.min(...plan.stations.map((s) => s.price.pricePerLiter));
  return plan.avgPricePerLiter;
}

/** Precio/L del peor caso: cargar en la más cara de cada carga. */
export function worstBasis(plan: TripPlan): number {
  const legs = legsWithStations(plan);
  if (legs.length > 0) {
    return avg(legs.map((l) => Math.max(...l.stations.map((s) => s.price.pricePerLiter))));
  }
  if (plan.stations.length > 0) return Math.max(...plan.stations.map((s) => s.price.pricePerLiter));
  return plan.avgPricePerLiter;
}

/**
 * Reasigna los seq de una carga: la elegida lleva el entero de la carga ("1")
 * y las alternativas se sub-numeran en orden de precio ("1.1", "1.2"…).
 */
export function relabelLeg(leg: RefuelLeg, chosenId: string): void {
  let alt = 0;
  for (const s of leg.stations) {
    if (s.id === chosenId) {
      s.seq = `${leg.n}`;
    } else {
      alt += 1;
      s.seq = `${leg.n}.${alt}`;
    }
  }
}
