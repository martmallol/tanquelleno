/**
 * Punto único donde la app elige de dónde salen los datos.
 *
 * Por defecto usa los servicios LIVE (Nominatim + OSRM + dataset oficial de
 * precios en surtidor). Para desarrollar sin red, correr con datos mock:
 *
 *   VITE_DATA_SOURCE=mock npm run dev
 *   (o crear .env.local con VITE_DATA_SOURCE=mock)
 */

import type { Services } from './ports';
import { mockServices } from './mock';
import { liveServices } from './live';

const useMock = import.meta.env.VITE_DATA_SOURCE === 'mock';

export const services: Services = useMock ? mockServices : liveServices;
