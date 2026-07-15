/**
 * Precios de nafta mock, con la estructura del dataset de naftas.com.ar:
 * precio por provincia × marca × tipo de combustible.
 *
 * Puntos clave para los estados de precio de la UI:
 *   - `STATION_PRICES` simula el precio puntual de una estación (source
 *     'station' → "precio exacto"). Está incompleto A PROPÓSITO: hay
 *     estaciones sin dato para poder ejercitar el fallback.
 *   - `PROVINCE_PRICES` es el promedio provincial (source 'province' →
 *     "estimado provincial") al que cae el fallback.
 *   - `NATIONAL_PRICES` es el último recurso (source 'national').
 */

import type { FuelType } from '../../domain/types';

type PriceByFuel = Record<FuelType, number>;

/** Promedio nacional por tipo de nafta (ARS/L). Último recurso del fallback. */
export const NATIONAL_PRICES: PriceByFuel = {
  super: 1648,
  premium: 1875,
};

/**
 * Promedio provincial por marca ausente / genérico.
 * Clave: provinceId. El valor es el promedio de todas las marcas en esa
 * provincia (lo que expone naftas.com.ar cuando no hay estación puntual).
 */
export const PROVINCE_PRICES: Record<string, PriceByFuel> = {
  'buenos-aires': { super: 1655, premium: 1889 },
  'santa-fe': { super: 1662, premium: 1898 },
  cordoba: { super: 1651, premium: 1885 },
  mendoza: { super: 1628, premium: 1852 },
  'san-juan': { super: 1639, premium: 1866 },
  'san-luis': { super: 1644, premium: 1871 },
  neuquen: { super: 1590, premium: 1808 },
  'rio-negro': { super: 1602, premium: 1824 },
  chubut: { super: 1585, premium: 1802 },
  'la-pampa': { super: 1647, premium: 1880 },
  'entre-rios': { super: 1668, premium: 1902 },
  corrientes: { super: 1689, premium: 1925 },
  misiones: { super: 1712, premium: 1949 },
  chaco: { super: 1695, premium: 1931 },
  salta: { super: 1702, premium: 1938 },
  tucuman: { super: 1685, premium: 1920 },
  jujuy: { super: 1708, premium: 1944 },
  'santiago-del-estero': { super: 1693, premium: 1928 },
  'la-rioja': { super: 1676, premium: 1910 },
  catamarca: { super: 1681, premium: 1915 },
};

/**
 * Precio puntual por estación (source 'station' → "precio exacto").
 * Clave: stationId (ver stations.data.ts). Intencionalmente NO están todas:
 * las que faltan deben caer al promedio provincial.
 */
export const STATION_PRICES: Record<string, Partial<PriceByFuel>> = {
  'ypf-chascomus': { super: 1626, premium: 1858 },
  'axion-ayacucho': { super: 1598, premium: 1832 },
  // 'shell-necochea' -> sin dato puntual: cae a promedio provincial
  'puma-vivorata': { super: 1612, premium: 1844 },
  'ypf-la-plata': { super: 1631, premium: 1863 },
  'shell-tandil': { super: 1668, premium: 1901 },
  'axion-junin': { super: 1641, premium: 1873 },
  'ypf-rosario': { super: 1659, premium: 1892 },
  'shell-cordoba': { super: 1648, premium: 1881 },
  'axion-villa-maria': { super: 1655, premium: 1888 },
  'ypf-rio-cuarto': { super: 1644, premium: 1877 },
  'puma-mendoza': { super: 1621, premium: 1846 },
  'ypf-san-luis': { super: 1638, premium: 1869 },
};
