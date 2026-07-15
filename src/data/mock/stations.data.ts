/**
 * Estaciones de servicio mock, distribuidas por la geografía argentina.
 *
 * Simulan los POI que devolvería Places/POI del provider de mapas. Cada una
 * tiene coordenadas reales aproximadas; el adapter de estaciones elige las
 * que caen cerca de la ruta y les resuelve el precio (exacto o estimado).
 *
 * `id` matchea con STATION_PRICES en fuelPrices.data.ts: algunas tienen
 * precio puntual y otras no (para ejercitar "exacto" vs "estimado").
 */

import type { LatLng } from '../../domain/types';

export interface StationSeed {
  id: string;
  brand: string;
  brandId: string;
  place: string;
  provinceId: string;
  coord: LatLng;
}

export const STATIONS: StationSeed[] = [
  // Corredor Buenos Aires → costa atlántica
  { id: 'ypf-la-plata', brand: 'YPF', brandId: 'ypf', place: 'La Plata, Buenos Aires', provinceId: 'buenos-aires', coord: { lat: -34.9215, lng: -57.9545 } },
  { id: 'ypf-chascomus', brand: 'YPF', brandId: 'ypf', place: 'Chascomús, Buenos Aires', provinceId: 'buenos-aires', coord: { lat: -35.5772, lng: -58.0094 } },
  { id: 'axion-ayacucho', brand: 'Axion Energy', brandId: 'axion', place: 'Ayacucho, Buenos Aires', provinceId: 'buenos-aires', coord: { lat: -37.1503, lng: -58.4894 } },
  { id: 'shell-necochea', brand: 'Shell', brandId: 'shell', place: 'Necochea centro', provinceId: 'buenos-aires', coord: { lat: -38.5545, lng: -58.7396 } },
  { id: 'puma-vivorata', brand: 'Puma Energy', brandId: 'puma', place: 'Vivoratá, RN226', provinceId: 'buenos-aires', coord: { lat: -37.6667, lng: -57.6833 } },
  { id: 'shell-tandil', brand: 'Shell', brandId: 'shell', place: 'Tandil, Buenos Aires', provinceId: 'buenos-aires', coord: { lat: -37.3217, lng: -59.1332 } },

  // Corredor Buenos Aires → Córdoba / Rosario (RN9 / RN8)
  { id: 'axion-junin', brand: 'Axion Energy', brandId: 'axion', place: 'Junín, Buenos Aires', provinceId: 'buenos-aires', coord: { lat: -34.5847, lng: -60.9445 } },
  { id: 'ypf-rosario', brand: 'YPF', brandId: 'ypf', place: 'Rosario, Santa Fe', provinceId: 'santa-fe', coord: { lat: -32.9442, lng: -60.6505 } },
  { id: 'axion-villa-maria', brand: 'Axion Energy', brandId: 'axion', place: 'Villa María, Córdoba', provinceId: 'cordoba', coord: { lat: -32.4103, lng: -63.2401 } },
  { id: 'shell-cordoba', brand: 'Shell', brandId: 'shell', place: 'Córdoba Capital', provinceId: 'cordoba', coord: { lat: -31.4201, lng: -64.1888 } },
  { id: 'ypf-rio-cuarto', brand: 'YPF', brandId: 'ypf', place: 'Río Cuarto, Córdoba', provinceId: 'cordoba', coord: { lat: -33.1301, lng: -64.3499 } },

  // Corredor a Cuyo (RN7)
  { id: 'ypf-san-luis', brand: 'YPF', brandId: 'ypf', place: 'San Luis Capital', provinceId: 'san-luis', coord: { lat: -33.3017, lng: -66.3378 } },
  { id: 'puma-mendoza', brand: 'Puma Energy', brandId: 'puma', place: 'Mendoza Capital', provinceId: 'mendoza', coord: { lat: -32.8895, lng: -68.8458 } },

  // Corredor a la Patagonia (RN3 / RN22)
  { id: 'shell-santa-rosa', brand: 'Shell', brandId: 'shell', place: 'Santa Rosa, La Pampa', provinceId: 'la-pampa', coord: { lat: -36.6167, lng: -64.2833 } },
  { id: 'ypf-neuquen', brand: 'YPF', brandId: 'ypf', place: 'Neuquén Capital', provinceId: 'neuquen', coord: { lat: -38.9516, lng: -68.0591 } },
  { id: 'axion-bariloche', brand: 'Axion Energy', brandId: 'axion', place: 'Bariloche, Río Negro', provinceId: 'rio-negro', coord: { lat: -41.1335, lng: -71.3103 } },
  { id: 'puma-madryn', brand: 'Puma Energy', brandId: 'puma', place: 'Puerto Madryn, Chubut', provinceId: 'chubut', coord: { lat: -42.7692, lng: -65.0385 } },

  // Litoral / NEA (RN14 / RN12)
  { id: 'ypf-gualeguaychu', brand: 'YPF', brandId: 'ypf', place: 'Gualeguaychú, Entre Ríos', provinceId: 'entre-rios', coord: { lat: -33.0095, lng: -58.5172 } },
  { id: 'shell-concordia', brand: 'Shell', brandId: 'shell', place: 'Concordia, Entre Ríos', provinceId: 'entre-rios', coord: { lat: -31.3929, lng: -58.0209 } },
  { id: 'axion-posadas', brand: 'Axion Energy', brandId: 'axion', place: 'Posadas, Misiones', provinceId: 'misiones', coord: { lat: -27.3671, lng: -55.8961 } },

  // NOA (RN9 norte)
  { id: 'ypf-tucuman', brand: 'YPF', brandId: 'ypf', place: 'San Miguel de Tucumán', provinceId: 'tucuman', coord: { lat: -26.8083, lng: -65.2176 } },
  { id: 'shell-salta', brand: 'Shell', brandId: 'shell', place: 'Salta Capital', provinceId: 'salta', coord: { lat: -24.7859, lng: -65.4117 } },
];

/** Colores de marca para los logos (coinciden con la maqueta Crepúsculo). */
export const BRAND_COLORS: Record<string, { bg: string; fg: string; abbr: string }> = {
  ypf: { bg: '#0B54A5', fg: '#ffffff', abbr: 'YPF' },
  axion: { bg: '#5C2D91', fg: '#ffffff', abbr: 'AX' },
  shell: { bg: '#D9291C', fg: '#FFD200', abbr: 'SH' },
  puma: { bg: '#C8102E', fg: '#ffffff', abbr: 'PU' },
  gulf: { bg: '#E8722D', fg: '#1B2240', abbr: 'GU' },
  refinor: { bg: '#1D7A6E', fg: '#ffffff', abbr: 'RF' },
  otra: { bg: '#4A5578', fg: '#ffffff', abbr: '⛽' },
};
