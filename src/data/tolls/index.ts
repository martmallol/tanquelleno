/**
 * Selección de la fuente de peajes, con degradación elegante.
 *
 * Con `VITE_TOLLS_SOURCE=tollguru` intenta TollGuru (precios en vivo con
 * TelePASE) y, ante cualquier problema (falta la API key en el proxy, red
 * caída, respuesta inesperada), cae al dataset curado. Sin el flag usa el
 * curado directo, sin hacer llamadas de red (útil offline / sin key).
 *
 * Para activarlo:
 *   1. Poné la key de TollGuru en la variable de entorno del server `TOLLGURU_API_KEY`
 *      (la usa el proxy /api/tollguru en vite.config.ts; en prod, un backend).
 *   2. Corré con `VITE_TOLLS_SOURCE=tollguru` (o en .env.local).
 */

import type { Route, TollEstimate } from '../../domain/types';
import type { TollService } from '../ports';
import { curatedTolls } from './tolls.service';
import { tollguruTolls } from './tollguru.service';

export const tollService: TollService = {
  async tollsForRoute(route: Route): Promise<TollEstimate> {
    if (import.meta.env.VITE_TOLLS_SOURCE === 'tollguru') {
      try {
        return await tollguruTolls.tollsForRoute(route);
      } catch (err) {
        console.warn('[tolls] TollGuru falló, uso la base curada:', err);
        return curatedTolls.tollsForRoute(route);
      }
    }
    return curatedTolls.tollsForRoute(route);
  },
};
