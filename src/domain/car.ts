/**
 * Construcción del TripCar usado en el cálculo, desde el catálogo o desde un
 * perfil por categoría (fallback "no encuentro mi auto").
 */

import type { Car, CategoryProfile, TripCar } from './types';

/** TripCar a partir de un auto puntual del catálogo. */
export function tripCarFromCatalog(car: Car): TripCar {
  return {
    label: `${car.brand} ${car.model} ${car.version} · ${car.year}`,
    carId: car.id,
    category: car.category,
    consumptionLper100: car.consumptionLper100,
    suggestedFuel: car.suggestedFuel,
    tankLiters: car.tankLiters,
    estimatedConsumption: false,
  };
}

/** TripCar a partir de un perfil de categoría (consumo estimado). */
export function tripCarFromCategory(profile: CategoryProfile): TripCar {
  return {
    label: `${profile.label} (promedio)`,
    carId: null,
    category: profile.category,
    consumptionLper100: profile.consumptionLper100,
    suggestedFuel: profile.suggestedFuel,
    tankLiters: profile.tankLiters,
    estimatedConsumption: true,
  };
}
