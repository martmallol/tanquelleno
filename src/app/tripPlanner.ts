/**
 * Orquestador del cálculo de viaje (capa de aplicación).
 *
 * Junta los servicios de datos (ruta, estaciones, precios, peajes) con la
 * lógica pura de domain/trip. Es lo único que conoce el TripInput de la UI y
 * lo traduce en un TripPlan. No toca el DOM.
 */

import type { CategoryProfile, FuelPrice, FuelType, Place, TripCar } from '../domain/types';
import { tripCarFromCatalog, tripCarFromCategory } from '../domain/car';
import { computeTrip } from '../domain/trip';
import type { TripPlan } from '../domain/types';
import type { Services } from '../data/ports';

/**
 * Selección del auto para el viaje: por id del catálogo o por categoría.
 * Es la forma serializable que guardamos en el estado entre páginas.
 */
export type CarSelection =
  | { kind: 'catalog'; carId: string }
  | { kind: 'category'; category: CategoryProfile['category'] };

/** Overrides opcionales de "Ajustes avanzados" en el inicio. */
export interface TripAdvanced {
  /** Consumo manual en L/100 km (pisa el del catálogo). */
  consumptionLper100?: number | null;
  /**
   * Nº de personas a bordo (incluido el conductor). El peso extra sube el
   * consumo. Base = 1 (solo el conductor); no afecta si es 1.
   */
  passengers?: number | null;
  /** Equipaje / auto muy cargado: suma consumo por peso. */
  heavyLoad?: boolean;
  /** Aire acondicionado gran parte del viaje: suma consumo. */
  airConditioning?: boolean;
}

/**
 * Factor multiplicador del consumo según carga del auto (pasajeros, equipaje,
 * A/C). Valores conservadores basados en rangos típicos: cada pasajero extra
 * ~+2.5%, equipaje pesado ~+4%, A/C ~+6%. No hay dato del surtidor acá: es
 * corrección de consumo del propio vehículo.
 */
export function loadFactor(adv: TripAdvanced | undefined): number {
  if (!adv) return 1;
  let f = 1;
  const extraPax = Math.max(0, (adv.passengers ?? 1) - 1);
  f += extraPax * 0.025;
  if (adv.heavyLoad) f += 0.04;
  if (adv.airConditioning) f += 0.06;
  // Techo razonable: no más de +25% por estos factores combinados.
  return Math.min(f, 1.25);
}

/**
 * Parada intermedia. `onReturn` decide si también se visita en la vuelta
 * (solo aplica cuando el viaje es ida y vuelta): así una parada puede hacerse
 * solo a la ida, o a la ida y a la vuelta.
 */
export interface TripStop {
  placeId: string;
  onReturn: boolean;
}

export interface TripInput {
  originId: string;
  destinationId: string;
  stops: TripStop[];
  roundTrip: boolean;
  car: CarSelection;
  advanced?: TripAdvanced;
}

export class TripPlanningError extends Error {}

/** Resuelve el TripCar a partir de la selección serializada. */
async function resolveCar(services: Services, selection: CarSelection): Promise<TripCar> {
  if (selection.kind === 'catalog') {
    const car = await services.cars.getCarById(selection.carId);
    if (!car) throw new TripPlanningError('No encontramos ese auto en el catálogo.');
    return tripCarFromCatalog(car);
  }
  const profiles = await services.cars.categoryProfiles();
  const profile = profiles.find((p) => p.category === selection.category);
  if (!profile) throw new TripPlanningError('Categoría de auto desconocida.');
  return tripCarFromCategory(profile);
}

async function resolvePlace(services: Services, id: string, role: string): Promise<Place> {
  const place = await services.directions.getPlaceById(id);
  if (!place) throw new TripPlanningError(`No encontramos ${role}.`);
  return place;
}

/**
 * Precio de referencia por tipo de nafta para el costo total. Toma el promedio
 * provincial de la provincia con más peso en el recorrido (aquí: la del
 * destino), con fallback nacional incorporado en el servicio.
 */
async function referencePrices(
  services: Services,
  provinceId: string,
): Promise<Record<FuelType, FuelPrice>> {
  const [superP, premiumP] = await Promise.all([
    services.fuelPrices.provinceAverage(provinceId, 'super'),
    services.fuelPrices.provinceAverage(provinceId, 'premium'),
  ]);
  return { super: superP, premium: premiumP };
}

/** Planifica el viaje completo con datos (mock o reales, según el provider). */
export async function planTrip(services: Services, input: TripInput): Promise<TripPlan> {
  const [origin, destination] = await Promise.all([
    resolvePlace(services, input.originId, 'el origen'),
    resolvePlace(services, input.destinationId, 'el destino'),
  ]);
  const stops = await Promise.all(
    input.stops.map(async (s) => ({
      place: await resolvePlace(services, s.placeId, 'una parada'),
      onReturn: s.onReturn,
    })),
  );

  let car = await resolveCar(services, input.car);
  const adv = input.advanced;

  // Consumo base: manual de "Ajustes avanzados" si lo cargaron, o el del auto.
  const manual = adv?.consumptionLper100;
  const baseConsumption = manual != null && manual > 0 ? manual : car.consumptionLper100;

  // Corrección por carga del auto (pasajeros, equipaje, A/C).
  const factor = loadFactor(adv);
  const effectiveConsumption = baseConsumption * factor;

  car = {
    ...car,
    consumptionLper100: effectiveConsumption,
    estimatedConsumption: manual != null && manual > 0 ? false : car.estimatedConsumption,
    manualConsumption: manual != null && manual > 0,
    loadAdjusted: factor > 1,
  };

  const outboundStops = stops.map((s) => s.place);
  const returnStops = stops.filter((s) => s.onReturn).map((s) => s.place);

  // Si es ida y vuelta y alguna parada NO se repite en la vuelta, la ruta es
  // asimétrica: la armamos explícita en una sola pasada
  // (origen → paradas ida → destino → paradas de vuelta → origen).
  // Si es simétrica (todas las paradas se repiten) o es solo ida, usamos el
  // camino directo y dejamos que roundTrip duplique (más simple y eficiente).
  const asymmetric = input.roundTrip && !stops.every((s) => s.onReturn);
  const route = asymmetric
    ? await services.directions.route(
        origin,
        [...outboundStops, destination, ...returnStops],
        origin,
        false,
      )
    : await services.directions.route(origin, outboundStops, destination, input.roundTrip);

  const [stations, refPrices, tolls] = await Promise.all([
    services.stations.stationsAlongRoute(route, car.suggestedFuel),
    referencePrices(services, destination.provinceId),
    services.tolls.estimateTolls(route),
  ]);

  return computeTrip({ route, car, stations, referencePrices: refPrices, tolls });
}
