/**
 * Cálculo del viaje — lógica de negocio pura.
 *
 * `computeTrip` no toca la red ni el DOM: recibe la ruta, el auto y los precios
 * ya resueltos, y devuelve el TripPlan (litros, costo, autonomía, nº de cargas,
 * estaciones ordenadas). Así se testea sola. El orquestado async vive en
 * services/tripPlanner.ts.
 */

import type {
  FuelCostBreakdown,
  FuelPrice,
  FuelType,
  RefuelLeg,
  Route,
  Station,
  TripCar,
  TripPlan,
} from './types';

export interface ComputeTripInput {
  route: Route;
  car: TripCar;
  /** Estaciones sobre la ruta, con su precio ya resuelto. */
  stations: Station[];
  /**
   * Precio de referencia por tipo de nafta para el costo total del viaje.
   * Debe incluir al menos la nafta sugerida del auto. Suele ser el promedio
   * de las estaciones del recorrido (con fallback provincial/nacional).
   */
  referencePrices: Record<FuelType, FuelPrice>;
  /** Peajes estimados del recorrido (ARS). */
  tolls: number;
  /** Precio por litro fijado a mano ("Ajustes avanzados"): pisa el promedio. */
  priceOverride?: number | null;
}

/** Litros necesarios para una distancia dada, según consumo L/100km. */
export function litersFor(distanceKm: number, consumptionLper100: number): number {
  return (distanceKm * consumptionLper100) / 100;
}

/** Autonomía con el tanque lleno, en km. */
export function rangeFor(tankLiters: number, consumptionLper100: number): number {
  return (tankLiters / consumptionLper100) * 100;
}

/**
 * Nº de cargas necesarias saliendo con el tanque lleno.
 *
 * Con autonomía R y distancia total D: se sale lleno (cubre el primer tramo R),
 * y hace falta una carga por cada tramo R adicional. Es el nº de paradas a
 * repostar, no cuenta el llenado inicial en casa.
 */
export function refuelStopsFor(totalDistanceKm: number, rangeKm: number): number {
  if (rangeKm <= 0) return 0;
  return Math.max(0, Math.ceil(totalDistanceKm / rangeKm) - 1);
}

/** Promedio simple de precios; devuelve null si no hay ninguno. */
function averagePrice(prices: number[]): number | null {
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

/**
 * Margen de seguridad sobre la autonomía: se planifica cargar antes de vaciar
 * el tanque (nadie llega a la estación con el último litro).
 */
const RANGE_SAFETY = 0.9;

/**
 * Plan de cargas estilo GasBuddy: para cada carga necesaria, qué estaciones
 * del corredor caen en la ventana donde conviene parar.
 *
 * La ventana de la carga i es el tramo [t_i − 45% autonomía, t_i], con
 * t_i = i × autonomía útil, medido sobre el viaje completo. En ida y vuelta
 * una estación se pasa dos veces: al km de ida y al km espejado de vuelta
 * (2 × ida − km); cualquiera de las dos posiciones puede caer en la ventana.
 */
export function groupStationsByRefuel(
  stations: Station[],
  oneWayKm: number,
  totalKm: number,
  rangeKm: number,
  roundTrip: boolean,
): { legs: RefuelLeg[]; extras: Station[] } {
  const usable = rangeKm * RANGE_SAFETY;
  const stops = refuelStopsFor(totalKm, usable);
  if (stops === 0 || usable <= 0) {
    return { legs: [], extras: [...stations].sort((a, b) => a.kmFromStart - b.kmFromStart) };
  }

  const assigned = new Set<string>();
  const legs: RefuelLeg[] = [];
  for (let i = 1; i <= stops; i++) {
    const target = Math.min(i * usable, totalKm - 1);
    const windowStart = target - usable * 0.45;
    const candidates = stations.filter((s) => {
      if (assigned.has(s.id)) return false;
      const positions = [s.kmFromStart];
      if (roundTrip) positions.push(2 * oneWayKm - s.kmFromStart);
      return positions.some((p) => p >= windowStart && p <= target);
    });
    candidates.sort((a, b) => a.price.pricePerLiter - b.price.pricePerLiter);
    candidates.forEach((s) => assigned.add(s.id));
    legs.push({ n: i, targetTripKm: Math.round(target), stations: candidates });
  }

  const extras = stations
    .filter((s) => !assigned.has(s.id))
    .sort((a, b) => a.kmFromStart - b.kmFromStart);
  return { legs, extras };
}

export function computeTrip(input: ComputeTripInput): TripPlan {
  const { route, car, stations, referencePrices, tolls, priceOverride } = input;

  const legsFactor = route.roundTrip ? 2 : 1;
  const totalDistanceKm = route.distanceKm * legsFactor;
  const liters = litersFor(totalDistanceKm, car.consumptionLper100);
  const rangeKm = rangeFor(car.tankLiters, car.consumptionLper100);
  const refuelStops = refuelStopsFor(totalDistanceKm, rangeKm * RANGE_SAFETY);

  // Precio promedio de la nafta sugerida a lo largo del recorrido: si hay
  // estaciones, promediamos sus precios; si no, usamos el de referencia.
  // Un precio manual de "Ajustes avanzados" pisa todo.
  const suggested = car.suggestedFuel;
  const stationPricesForSuggested = stations
    .filter((s) => s.price.fuel === suggested)
    .map((s) => s.price.pricePerLiter);
  const anyEstimatedStation = stations.some((s) => s.price.fuel === suggested && !s.price.exact);

  const refSuggested = referencePrices[suggested];
  const avgFromStations = averagePrice(stationPricesForSuggested);
  const priceOverridden = priceOverride != null && priceOverride > 0;
  const avgPricePerLiter = priceOverridden
    ? priceOverride
    : (avgFromStations ?? refSuggested.pricePerLiter);
  const avgPriceEstimated = priceOverridden
    ? false
    : avgFromStations != null
      ? anyEstimatedStation
      : !refSuggested.exact;

  // Costos por tipo de nafta: sugerida (con el promedio del recorrido) y la
  // alternativa premium (con su precio de referencia).
  const costs: FuelCostBreakdown[] = [];
  costs.push({
    fuel: suggested,
    pricePerLiter: avgPricePerLiter,
    exact: !avgPriceEstimated,
    totalCost: liters * avgPricePerLiter,
  });
  const alt: FuelType = suggested === 'super' ? 'premium' : 'super';
  const refAlt = referencePrices[alt];
  costs.push({
    fuel: alt,
    pricePerLiter: refAlt.pricePerLiter,
    exact: refAlt.exact,
    totalCost: liters * refAlt.pricePerLiter,
  });

  // Plan de cargas (estilo GasBuddy) + numeración de pins: primero las
  // estaciones de cada carga en orden, después las extra.
  const { legs: refuelLegs, extras: extraStations } = groupStationsByRefuel(
    stations,
    route.distanceKm,
    totalDistanceKm,
    rangeKm,
    route.roundTrip,
  );
  let seq = 1;
  for (const leg of refuelLegs) for (const s of leg.stations) s.seq = seq++;
  for (const s of extraStations) s.seq = seq++;

  // Estaciones ordenadas por precio de la nafta sugerida (más barata primero).
  const rankedStations = [...stations].sort(
    (a, b) => a.price.pricePerLiter - b.price.pricePerLiter,
  );

  return {
    route,
    car,
    totalDistanceKm: Math.round(totalDistanceKm),
    liters: Math.round(liters),
    avgPricePerLiter: Math.round(avgPricePerLiter),
    avgPriceEstimated,
    rangeKm: Math.round(rangeKm),
    refuelStops,
    costs,
    stations: rankedStations,
    refuelLegs,
    extraStations,
    tolls: Math.round(tolls),
    priceOverridden,
  };
}

/** Índice de la estación más barata en `plan.stations`, o -1 si no hay. */
export function cheapestStationIndex(plan: TripPlan): number {
  return plan.stations.length > 0 ? 0 : -1;
}
