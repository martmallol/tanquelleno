/**
 * Mapeo entre nuestros provinceId (slug) y los nombres de provincia tal como
 * aparecen en el dataset oficial de precios en surtidor (en MAYÚSCULAS) y en
 * Nominatim (address.state).
 */

/** slug provinceId → nombre en el dataset de energía. */
export const PROVINCE_TO_DATASET: Record<string, string> = {
  'buenos-aires': 'BUENOS AIRES',
  'capital-federal': 'CAPITAL FEDERAL',
  catamarca: 'CATAMARCA',
  chaco: 'CHACO',
  chubut: 'CHUBUT',
  cordoba: 'CORDOBA',
  corrientes: 'CORRIENTES',
  'entre-rios': 'ENTRE RIOS',
  formosa: 'FORMOSA',
  jujuy: 'JUJUY',
  'la-pampa': 'LA PAMPA',
  'la-rioja': 'LA RIOJA',
  mendoza: 'MENDOZA',
  misiones: 'MISIONES',
  neuquen: 'NEUQUEN',
  'rio-negro': 'RIO NEGRO',
  salta: 'SALTA',
  'san-juan': 'SAN JUAN',
  'san-luis': 'SAN LUIS',
  'santa-cruz': 'SANTA CRUZ',
  'santa-fe': 'SANTA FE',
  'santiago-del-estero': 'SANTIAGO DEL ESTERO',
  'tierra-del-fuego': 'TIERRA DEL FUEGO',
  tucuman: 'TUCUMAN',
};

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Alias de Nominatim / variantes → slug provinceId. */
const NOMINATIM_ALIASES: Record<string, string> = {
  'ciudad-autonoma-de-buenos-aires': 'capital-federal',
  caba: 'capital-federal',
  'provincia-de-buenos-aires': 'buenos-aires',
};

/** Normaliza un nombre de provincia (de Nominatim o del dataset) a provinceId. */
export function provinceIdFromName(name: string | undefined): string {
  if (!name) return 'buenos-aires';
  const s = slug(name);
  return NOMINATIM_ALIASES[s] ?? s;
}

export { slug as slugify };
