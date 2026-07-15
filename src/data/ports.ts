/**
 * Puertos (interfaces) de los servicios de datos.
 *
 * La app depende SOLO de estas interfaces. Hoy las cumple `src/data/mock`;
 * mañana se agrega `src/data/live` con implementaciones contra:
 *   - CarCatalog      → base propia de autos que andan en Argentina
 *   - DirectionsService → Google Directions / Mapbox Directions
 *   - StationsService → Places/POI del mismo provider de mapas
 *   - FuelPriceService → dataset de naftas.com.ar (por provincia/marca/tipo)
 *
 * Todos los métodos son async: los mocks resuelven de inmediato, pero la firma
 * ya contempla la latencia y los estados de carga/error de una llamada de red.
 */

import type {
  Car,
  CarCategory,
  CategoryProfile,
  FuelPrice,
  FuelType,
  Place,
  Route,
  Station,
} from '../domain/types';

/** Catálogo de autos argentinos + fallback por categoría. */
export interface CarCatalog {
  listBrands(): Promise<{ id: string; name: string }[]>;
  listModels(brandId: string): Promise<string[]>;
  listYears(brandId: string, model: string): Promise<number[]>;
  /** Auto puntual por marca/modelo/año, o null si no está en la base. */
  findCar(brandId: string, model: string, year: number): Promise<Car | null>;
  getCarById(id: string): Promise<Car | null>;
  /** Búsqueda libre por texto ("Cronos", "Hilux", "208"). */
  search(query: string): Promise<Car[]>;
  /** Perfiles de consumo por categoría, para el fallback. */
  categoryProfiles(): Promise<CategoryProfile[]>;
}

/** Búsqueda de lugares y cálculo de ruta/distancia/geometría. */
export interface DirectionsService {
  searchPlaces(query: string): Promise<Place[]>;
  getPlaceById(id: string): Promise<Place | null>;
  /**
   * Ruta entre origen, paradas intermedias y destino.
   * @param roundTrip si true, el consumidor duplica distancia y litros.
   */
  route(origin: Place, stops: Place[], destination: Place, roundTrip: boolean): Promise<Route>;
}

/** Estaciones de servicio sobre o cerca de la ruta. */
export interface StationsService {
  /**
   * Estaciones a lo largo de `route`, con el precio de `fuel` resuelto
   * (exacto si existe para la estación, estimado provincial/nacional si no).
   */
  stationsAlongRoute(route: Route, fuel: FuelType): Promise<Station[]>;
}

/** Precios de nafta (naftas.com.ar). Tolera que el precio puntual no exista. */
export interface FuelPriceService {
  /**
   * Precio en una estación puntual. Si no hay dato de esa estación, cae al
   * promedio provincial y, si tampoco, al nacional. El estado queda en
   * `FuelPrice.exact` / `FuelPrice.source`.
   */
  priceAtStation(stationId: string, provinceId: string, fuel: FuelType): Promise<FuelPrice>;
  /** Promedio provincial de un tipo de nafta. */
  provinceAverage(provinceId: string, fuel: FuelType): Promise<FuelPrice>;
  /** Promedio nacional (último recurso). */
  nationalAverage(fuel: FuelType): Promise<FuelPrice>;
}

/** Peajes del recorrido. Mock por ahora; puede venir del provider de rutas. */
export interface TollService {
  estimateTolls(route: Route): Promise<number>;
}

/** Contenedor de todos los servicios: se inyecta una sola vez en el arranque. */
export interface Services {
  cars: CarCatalog;
  directions: DirectionsService;
  stations: StationsService;
  fuelPrices: FuelPriceService;
  tolls: TollService;
}

export type { CarCategory };
