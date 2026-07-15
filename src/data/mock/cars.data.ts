/**
 * Catálogo de autos que se venden/andan en Argentina — BASE PROPIA.
 *
 * Los datos viven en `src/data/cars.ar.json` (versionado, con metadata de
 * fuentes). No existe una API pública argentina de consumos homologados:
 * la guía de ACARA es la nómina de precios (sin consumo) y los portales de
 * fichas técnicas no exponen API. Por eso la base es un JSON curado que se
 * actualiza a mano (o con un script futuro) cuando aparecen modelos nuevos,
 * y el fallback por categoría cubre cualquier auto que no esté acá.
 *
 * Este módulo solo expande el JSON al modelo de dominio (un Car por
 * semilla × año) y expone las marcas ordenadas por popularidad.
 */

import type { Car, CarCategory, CategoryProfile, FuelType } from '../../domain/types';
import catalog from '../cars.ar.json';

interface CarSeed {
  brand: string;
  model: string;
  version: string;
  years: number[];
  category: string;
  consumptionLper100: number;
  suggestedFuel: string;
  tankLiters: number;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Catálogo expandido: un Car por (semilla × año). */
export const CARS: Car[] = (catalog.cars as CarSeed[]).flatMap((seed) =>
  seed.years.map((year) => {
    const brandId = slug(seed.brand);
    return {
      id: `${brandId}-${slug(seed.model)}-${slug(seed.version)}-${year}`,
      brand: seed.brand,
      brandId,
      model: seed.model,
      version: seed.version,
      year,
      category: seed.category as CarCategory,
      consumptionLper100: seed.consumptionLper100,
      suggestedFuel: seed.suggestedFuel as FuelType,
      tankLiters: seed.tankLiters,
    };
  }),
);

/** Marcas ordenadas por popularidad en Argentina (para el orden de la grilla). */
const BRAND_ORDER = ['fiat', 'volkswagen', 'toyota', 'chevrolet', 'renault', 'peugeot', 'ford', 'citroen'];

export const BRANDS: { id: string; name: string }[] = [
  ...new Map(CARS.map((c) => [c.brandId, c.brand])).entries(),
]
  .map(([id, name]) => ({ id, name }))
  .sort((a, b) => {
    const ia = BRAND_ORDER.indexOf(a.id);
    const ib = BRAND_ORDER.indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

/** Perfiles de consumo por categoría (fallback "no encuentro mi auto"). */
export const CATEGORY_PROFILES: CategoryProfile[] = (
  catalog.categoryProfiles as {
    category: string;
    label: string;
    consumptionLper100: number;
    suggestedFuel: string;
    tankLiters: number;
  }[]
).map((p) => ({
  category: p.category as CarCategory,
  label: p.label,
  consumptionLper100: p.consumptionLper100,
  suggestedFuel: p.suggestedFuel as FuelType,
  tankLiters: p.tankLiters,
}));
