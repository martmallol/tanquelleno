/**
 * Adapter mock del catálogo de autos.
 *
 * Implementa el puerto CarCatalog contra los datos de cars.data.ts.
 * Toda respuesta es async para reflejar la latencia de una API real.
 */

import type { Car, CategoryProfile } from '../../domain/types';
import type { CarCatalog } from '../ports';
import { BRANDS, CARS, CATEGORY_PROFILES } from './cars.data';

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Simula la latencia de red para probar estados de carga. */
const delay = <T>(value: T, ms = 120): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

export const mockCarCatalog: CarCatalog = {
  async listBrands() {
    return delay(BRANDS.map((b) => ({ ...b })));
  },

  async listModels(brandId) {
    const models = [...new Set(CARS.filter((c) => c.brandId === brandId).map((c) => c.model))];
    return delay(models);
  },

  async listYears(brandId, model) {
    const years = [
      ...new Set(
        CARS.filter((c) => c.brandId === brandId && c.model === model).map((c) => c.year),
      ),
    ].sort((a, b) => b - a);
    return delay(years);
  },

  async findCar(brandId, model, year) {
    // Puede haber varias versiones por año; devolvemos la primera.
    const car = CARS.find((c) => c.brandId === brandId && c.model === model && c.year === year);
    return delay<Car | null>(car ? { ...car } : null);
  },

  async getCarById(id) {
    const car = CARS.find((c) => c.id === id);
    return delay<Car | null>(car ? { ...car } : null);
  },

  async search(query) {
    const q = norm(query);
    if (!q) return delay<Car[]>([]);
    // Match por marca, modelo o "marca modelo"; una fila por modelo (año más nuevo).
    const seen = new Set<string>();
    const results: Car[] = [];
    for (const car of CARS) {
      const hay = norm(`${car.brand} ${car.model} ${car.version}`);
      if (!hay.includes(q)) continue;
      const key = `${car.brandId}-${car.model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // El más nuevo de ese modelo.
      const newest = CARS.filter((c) => c.brandId === car.brandId && c.model === car.model).sort(
        (a, b) => b.year - a.year,
      )[0]!;
      results.push({ ...newest });
    }
    return delay(results.slice(0, 12));
  },

  async categoryProfiles(): Promise<CategoryProfile[]> {
    return delay(CATEGORY_PROFILES.map((p) => ({ ...p })));
  },
};
