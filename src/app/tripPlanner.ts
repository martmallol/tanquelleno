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

export interface TripInput {
  originId: string;
  destinationId: string;
  stopIds: string[];
  roundTrip: boolean;
  car: CarSelection;
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
    input.stopIds.map((id) => resolvePlace(services, id, 'una parada')),
  );

  const car = await resolveCar(services, input.car);
  const route = await services.directions.route(origin, stops, destination, input.roundTrip);

  const [stations, refPrices, tolls] = await Promise.all([
    services.stations.stationsAlongRoute(route, car.suggestedFuel),
    referencePrices(services, destination.provinceId),
    services.tolls.estimateTolls(route),
  ]);

  return computeTrip({ route, car, stations, referencePrices: refPrices, tolls });
}
