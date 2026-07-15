/**
 * Modelo de dominio de KmxKm.
 *
 * Estos tipos son independientes de la fuente de datos: los adapters mock de
 * hoy (src/data/mock) y las integraciones reales de mañana (naftas.com.ar,
 * Mapbox/Google Directions & Places) producen y consumen exactamente esto.
 */

// ------------------------------------------------------------------
// Combustible
// ------------------------------------------------------------------

/** Tipos de nafta que maneja la app. GNC/diésel quedan fuera del MVP. */
export type FuelType = 'super' | 'premium';

/** Categoría para el fallback de consumo cuando el auto no está en el catálogo. */
export type CarCategory = 'chico' | 'sedan' | 'suv' | 'pickup';

// ------------------------------------------------------------------
// Catálogo de autos (solo modelos que andan en Argentina)
// ------------------------------------------------------------------

export interface Car {
  id: string;              // "fiat-cronos-1.3-2022"
  brand: string;           // "Fiat"
  brandId: string;         // "fiat"
  model: string;           // "Cronos"
  version: string;         // "1.3"
  year: number;            // 2022
  category: CarCategory;
  /** Consumo mixto/ruta en litros cada 100 km. */
  consumptionLper100: number;
  /** Nafta que el fabricante sugiere para este motor. */
  suggestedFuel: FuelType;
  /** Tamaño del tanque en litros (para autonomía y nº de paradas). */
  tankLiters: number;
}

/** Perfil por categoría, usado cuando el usuario elige "no encuentro mi auto". */
export interface CategoryProfile {
  category: CarCategory;
  label: string;           // "Auto chico", "Sedán", ...
  consumptionLper100: number;
  suggestedFuel: FuelType;
  tankLiters: number;
}

// ------------------------------------------------------------------
// Geografía / ruta
// ------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;              // "mar-del-plata"
  name: string;            // "Mar del Plata"
  province: string;        // "Buenos Aires"
  provinceId: string;      // "buenos-aires"
  coord: LatLng;
}

/**
 * Ruta calculada entre origen, paradas y destino.
 * Con datos reales `geometry` viene del provider; en mock la aproximamos.
 */
export interface Route {
  /** Origen, waypoints intermedios y destino, en orden. */
  waypoints: Place[];
  /** Distancia de una sola pasada (origen → destino), en km. */
  distanceKm: number;
  /** Puntos [lat,lng] que dibujan la línea de la ruta. */
  geometry: LatLng[];
  /** true si el viaje es ida y vuelta (duplica distancia y litros). */
  roundTrip: boolean;
}

// ------------------------------------------------------------------
// Precios de nafta
// ------------------------------------------------------------------

/** De dónde salió un precio: define el estado "exacto" vs "estimado". */
export type PriceSource = 'station' | 'province' | 'national';

export interface FuelPrice {
  fuel: FuelType;
  /** Precio por litro en ARS. */
  pricePerLiter: number;
  source: PriceSource;
  /**
   * true solo cuando el precio es de la estación puntual (source === 'station').
   * false cuando cayó al promedio provincial o nacional.
   */
  exact: boolean;
}

// ------------------------------------------------------------------
// Estaciones de servicio sobre la ruta
// ------------------------------------------------------------------

export interface Station {
  id: string;
  brand: string;           // "YPF", "Axion Energy", "Shell", "Puma Energy"
  brandId: string;         // "ypf", "axion", ...
  place: string;           // "Chascomús, Buenos Aires"
  provinceId: string;
  /** Distancia desde el origen a lo largo de la ruta, en km. */
  kmFromStart: number;
  coord: LatLng;
  /** Precio de la nafta sugerida en esta estación (exacto o estimado). */
  price: FuelPrice;
  /**
   * Etiqueta del pin en el mapa y en las cards. Solo las estaciones que sirven
   * para una carga la tienen, en formato "carga.opción" ("1.1", "1.2", "2.1").
   * Las de backup (no caen en ninguna ventana de carga) quedan sin etiqueta.
   * Lo asigna computeTrip al armar los grupos de carga.
   */
  seq?: string;
}

/**
 * Grupo de estaciones candidatas para una carga concreta del viaje
 * (estilo GasBuddy: "para la 1ª carga, estas; para la 2ª, estas").
 */
export interface RefuelLeg {
  /** Nº de carga (1 = primera). */
  n: number;
  /** Km del viaje total (incluida la vuelta) donde conviene cargar. */
  targetTripKm: number;
  /** Candidatas para esta carga, más barata primero. */
  stations: Station[];
}

// ------------------------------------------------------------------
// Resultado del cálculo del viaje
// ------------------------------------------------------------------

/** Costo de llenar el viaje con un tipo de nafta puntual. */
export interface FuelCostBreakdown {
  fuel: FuelType;
  pricePerLiter: number;
  /** true si el precio de referencia usado fue exacto. */
  exact: boolean;
  /** Costo total de la nafta para todo el viaje. */
  totalCost: number;
}

export interface TripPlan {
  route: Route;
  car: TripCar;
  /** Distancia total del viaje (ya considera ida y vuelta). */
  totalDistanceKm: number;
  /** Litros estimados para todo el viaje. */
  liters: number;
  /** Precio promedio por litro de la nafta sugerida a lo largo del recorrido. */
  avgPricePerLiter: number;
  /** true si ese promedio se apoya al menos en un precio estimado. */
  avgPriceEstimated: boolean;
  /** Autonomía del auto con el tanque lleno, en km. */
  rangeKm: number;
  /** Nº de cargas necesarias saliendo con el tanque lleno. */
  refuelStops: number;
  /** Costo con la nafta sugerida y con la alternativa (premium). */
  costs: FuelCostBreakdown[];
  /** Estaciones recomendadas para cargar, ordenadas por conveniencia. */
  stations: Station[];
  /** Plan de cargas: qué estaciones sirven para la 1ª carga, la 2ª, etc. */
  refuelLegs: RefuelLeg[];
  /** Estaciones sobre la ruta que no caen en la ventana de ninguna carga. */
  extraStations: Station[];
  /** Peajes estimados del recorrido, en ARS. */
  tolls: number;
}

/**
 * Snapshot del auto usado en el cálculo. Puede venir del catálogo (`carId`)
 * o de un fallback por categoría (`carId` nulo).
 */
export interface TripCar {
  label: string;           // "Fiat Cronos 1.3 · 2022" o "SUV (promedio)"
  carId: string | null;
  category: CarCategory;
  consumptionLper100: number;
  suggestedFuel: FuelType;
  tankLiters: number;
  /** true si el consumo salió de un promedio por categoría, no del modelo. */
  estimatedConsumption: boolean;
  /** true si el consumo fue fijado a mano en "Ajustes avanzados". */
  manualConsumption?: boolean;
  /** true si se aplicó corrección por carga (pasajeros/equipaje/A-C). */
  loadAdjusted?: boolean;
}
