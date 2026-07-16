/**
 * Ensamblado de los servicios live.
 *
 * Fuentes reales sin API key:
 *   - Lugares:    Nominatim (OpenStreetMap, restringido a AR)
 *   - Ruta:       OSRM público (distancia real + geometría)
 *   - Estaciones y precios: dataset oficial "Precios en surtidor"
 *     (datos.energia.gob.ar, Res. 314/2016 — la fuente detrás de naftas.com.ar)
 *   - Autos:      base propia curada de modelos que andan en Argentina
 *                 (no existe API pública de consumos; ver cars.data.ts)
 *   - Peajes:     TollGuru (precios en vivo con TelePASE) si está configurado,
 *                 con fallback a la base curada; ver data/tolls/index.ts
 *
 * Degradación: si OSRM no responde, caemos a la ruta aproximada del mock
 * (Haversine × factor) para que el cálculo no muera; estaciones/precios ya
 * degradan por su cuenta a promedios.
 */

import type { Services } from '../ports';
import { mockCarCatalog } from '../mock/cars.mock';
import { mockDirections } from '../mock/directions.mock';
import { tollService } from '../tolls';
import { liveDirections } from './directions.live';
import { liveFuelPrices } from './fuelPrices.live';
import { liveStations } from './stations.live';

export const liveServices: Services = {
  // Base propia: el catálogo curado ES la fuente de autos argentinos.
  cars: mockCarCatalog,

  directions: {
    searchPlaces: (q) => liveDirections.searchPlaces(q),
    getPlaceById: (id) => liveDirections.getPlaceById(id),
    async route(origin, stops, destination, roundTrip) {
      try {
        return await liveDirections.route(origin, stops, destination, roundTrip);
      } catch (err) {
        console.warn('[live] OSRM falló, usando ruta aproximada:', err);
        return mockDirections.route(origin, stops, destination, roundTrip);
      }
    },
  },

  stations: liveStations,
  fuelPrices: liveFuelPrices,
  tolls: tollService,
};
