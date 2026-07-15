/**
 * Ciudades argentinas con coordenadas reales.
 *
 * Sirven para dos cosas mientras no esté Mapbox/Google Directions:
 *   1. Estimar distancia por Haversine × factor de ruta (ver directions.mock).
 *   2. Dibujar la geometría aproximada de la ruta interpolando entre puntos.
 *
 * Cuando entren las APIs reales, la distancia y la geometría vienen del
 * provider y este dataset queda solo como semilla del autocompletado.
 */

import type { Place } from '../../domain/types';

interface PlaceSeed {
  name: string;
  province: string;
  lat: number;
  lng: number;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const SEEDS: PlaceSeed[] = [
  { name: 'Buenos Aires', province: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
  { name: 'La Plata', province: 'Buenos Aires', lat: -34.9215, lng: -57.9545 },
  { name: 'Mar del Plata', province: 'Buenos Aires', lat: -38.0055, lng: -57.5426 },
  { name: 'Necochea', province: 'Buenos Aires', lat: -38.5545, lng: -58.7396 },
  { name: 'Chascomús', province: 'Buenos Aires', lat: -35.5772, lng: -58.0094 },
  { name: 'Ayacucho', province: 'Buenos Aires', lat: -37.1503, lng: -58.4894 },
  { name: 'Tandil', province: 'Buenos Aires', lat: -37.3217, lng: -59.1332 },
  { name: 'Bahía Blanca', province: 'Buenos Aires', lat: -38.7196, lng: -62.2724 },
  { name: 'Pinamar', province: 'Buenos Aires', lat: -37.1096, lng: -56.8615 },
  { name: 'Villa Gesell', province: 'Buenos Aires', lat: -37.2639, lng: -56.9731 },
  { name: 'Junín', province: 'Buenos Aires', lat: -34.5847, lng: -60.9445 },
  { name: 'Pergamino', province: 'Buenos Aires', lat: -33.8894, lng: -60.5731 },
  { name: 'Rosario', province: 'Santa Fe', lat: -32.9442, lng: -60.6505 },
  { name: 'Santa Fe', province: 'Santa Fe', lat: -31.6333, lng: -60.7 },
  { name: 'Rafaela', province: 'Santa Fe', lat: -31.2503, lng: -61.4867 },
  { name: 'Córdoba', province: 'Córdoba', lat: -31.4201, lng: -64.1888 },
  { name: 'Villa Carlos Paz', province: 'Córdoba', lat: -31.4241, lng: -64.4978 },
  { name: 'Río Cuarto', province: 'Córdoba', lat: -33.1301, lng: -64.3499 },
  { name: 'Villa María', province: 'Córdoba', lat: -32.4103, lng: -63.2401 },
  { name: 'Mendoza', province: 'Mendoza', lat: -32.8895, lng: -68.8458 },
  { name: 'San Rafael', province: 'Mendoza', lat: -34.6177, lng: -68.3301 },
  { name: 'San Juan', province: 'San Juan', lat: -31.5375, lng: -68.5364 },
  { name: 'San Luis', province: 'San Luis', lat: -33.3017, lng: -66.3378 },
  { name: 'Merlo', province: 'San Luis', lat: -32.3453, lng: -65.0192 },
  { name: 'Neuquén', province: 'Neuquén', lat: -38.9516, lng: -68.0591 },
  { name: 'San Martín de los Andes', province: 'Neuquén', lat: -40.1579, lng: -71.3534 },
  { name: 'San Carlos de Bariloche', province: 'Río Negro', lat: -41.1335, lng: -71.3103 },
  { name: 'Viedma', province: 'Río Negro', lat: -40.8135, lng: -62.9967 },
  { name: 'Las Grutas', province: 'Río Negro', lat: -40.7997, lng: -65.0876 },
  { name: 'Puerto Madryn', province: 'Chubut', lat: -42.7692, lng: -65.0385 },
  { name: 'Comodoro Rivadavia', province: 'Chubut', lat: -45.8641, lng: -67.4966 },
  { name: 'Santa Rosa', province: 'La Pampa', lat: -36.6167, lng: -64.2833 },
  { name: 'Paraná', province: 'Entre Ríos', lat: -31.7319, lng: -60.5238 },
  { name: 'Gualeguaychú', province: 'Entre Ríos', lat: -33.0095, lng: -58.5172 },
  { name: 'Concordia', province: 'Entre Ríos', lat: -31.3929, lng: -58.0209 },
  { name: 'Corrientes', province: 'Corrientes', lat: -27.4692, lng: -58.8306 },
  { name: 'Posadas', province: 'Misiones', lat: -27.3671, lng: -55.8961 },
  { name: 'Puerto Iguazú', province: 'Misiones', lat: -25.5972, lng: -54.5786 },
  { name: 'Resistencia', province: 'Chaco', lat: -27.4514, lng: -58.9867 },
  { name: 'Salta', province: 'Salta', lat: -24.7859, lng: -65.4117 },
  { name: 'San Miguel de Tucumán', province: 'Tucumán', lat: -26.8083, lng: -65.2176 },
  { name: 'San Salvador de Jujuy', province: 'Jujuy', lat: -24.1858, lng: -65.2995 },
  { name: 'Santiago del Estero', province: 'Santiago del Estero', lat: -27.7951, lng: -64.2615 },
  { name: 'La Rioja', province: 'La Rioja', lat: -29.4131, lng: -66.8558 },
  { name: 'Catamarca', province: 'Catamarca', lat: -28.4696, lng: -65.7852 },
];

export const PLACES: Place[] = SEEDS.map((s) => ({
  id: slug(s.name),
  name: s.name,
  province: s.province,
  provinceId: slug(s.province),
  coord: { lat: s.lat, lng: s.lng },
}));
