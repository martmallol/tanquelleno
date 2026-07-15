/**
 * Ensamblado de los servicios mock en un único contenedor `Services`.
 */

import type { Services } from '../ports';
import { mockCarCatalog } from './cars.mock';
import { mockDirections } from './directions.mock';
import { mockFuelPrices } from './fuelPrices.mock';
import { mockStations } from './stations.mock';
import { mockTolls } from './tolls.mock';

export const mockServices: Services = {
  cars: mockCarCatalog,
  directions: mockDirections,
  stations: mockStations,
  fuelPrices: mockFuelPrices,
  tolls: mockTolls,
};
