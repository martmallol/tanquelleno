/**
 * Catálogo mock de autos que se venden/andan en Argentina.
 *
 * Base propia, curada a mano — NO un dataset global con modelos raros.
 * Los valores de consumo (L/100 km en ruta), nafta sugerida y tanque son
 * aproximaciones realistas de fuentes argentinas (fichas de fabricante y
 * pruebas de ruta). Cuando entre la base real, se reemplaza este archivo.
 */

import type { Car, CategoryProfile, FuelType } from '../../domain/types';

interface CarSeed {
  brand: string;
  model: string;
  version: string;
  years: number[];
  category: Car['category'];
  consumptionLper100: number;
  suggestedFuel: FuelType;
  tankLiters: number;
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Semillas por modelo/versión; se expanden a un Car por año.
const SEEDS: CarSeed[] = [
  // ---- Fiat ----
  { brand: 'Fiat', model: 'Cronos', version: '1.3', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'sedan', consumptionLper100: 6.3, suggestedFuel: 'super', tankLiters: 48 },
  { brand: 'Fiat', model: 'Argo', version: '1.3', years: [2019, 2020, 2021, 2022, 2023], category: 'chico', consumptionLper100: 6.1, suggestedFuel: 'super', tankLiters: 48 },
  { brand: 'Fiat', model: 'Pulse', version: '1.3', years: [2022, 2023, 2024], category: 'suv', consumptionLper100: 7.0, suggestedFuel: 'super', tankLiters: 47 },
  { brand: 'Fiat', model: 'Toro', version: '2.0 TDI', years: [2020, 2021, 2022, 2023, 2024], category: 'pickup', consumptionLper100: 8.5, suggestedFuel: 'super', tankLiters: 60 },
  { brand: 'Fiat', model: 'Mobi', version: '1.0', years: [2019, 2020, 2021], category: 'chico', consumptionLper100: 5.6, suggestedFuel: 'super', tankLiters: 47 },

  // ---- Volkswagen ----
  { brand: 'Volkswagen', model: 'Gol Trend', version: '1.6', years: [2019, 2020, 2021, 2022, 2023], category: 'chico', consumptionLper100: 6.5, suggestedFuel: 'super', tankLiters: 55 },
  { brand: 'Volkswagen', model: 'Polo', version: '1.6 MSI', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'chico', consumptionLper100: 6.6, suggestedFuel: 'super', tankLiters: 52 },
  { brand: 'Volkswagen', model: 'Virtus', version: '1.6 MSI', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'sedan', consumptionLper100: 6.7, suggestedFuel: 'super', tankLiters: 52 },
  { brand: 'Volkswagen', model: 'T-Cross', version: '1.6 MSI', years: [2020, 2021, 2022, 2023, 2024], category: 'suv', consumptionLper100: 7.4, suggestedFuel: 'super', tankLiters: 52 },
  { brand: 'Volkswagen', model: 'Amarok', version: '2.0 TDI', years: [2019, 2020, 2021, 2022, 2023], category: 'pickup', consumptionLper100: 8.9, suggestedFuel: 'super', tankLiters: 80 },

  // ---- Toyota ----
  { brand: 'Toyota', model: 'Etios', version: '1.5', years: [2019, 2020, 2021, 2022, 2023], category: 'chico', consumptionLper100: 6.4, suggestedFuel: 'super', tankLiters: 45 },
  { brand: 'Toyota', model: 'Yaris', version: '1.5', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'chico', consumptionLper100: 6.0, suggestedFuel: 'super', tankLiters: 42 },
  { brand: 'Toyota', model: 'Corolla', version: '2.0', years: [2020, 2021, 2022, 2023, 2024], category: 'sedan', consumptionLper100: 6.8, suggestedFuel: 'premium', tankLiters: 50 },
  { brand: 'Toyota', model: 'Corolla Cross', version: '2.0', years: [2021, 2022, 2023, 2024], category: 'suv', consumptionLper100: 7.5, suggestedFuel: 'premium', tankLiters: 47 },
  { brand: 'Toyota', model: 'Hilux', version: '2.8 TDI', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'pickup', consumptionLper100: 9.0, suggestedFuel: 'super', tankLiters: 80 },
  { brand: 'Toyota', model: 'SW4', version: '2.8 TDI', years: [2020, 2021, 2022, 2023, 2024], category: 'suv', consumptionLper100: 9.5, suggestedFuel: 'super', tankLiters: 80 },

  // ---- Chevrolet ----
  { brand: 'Chevrolet', model: 'Onix', version: '1.2', years: [2020, 2021, 2022, 2023, 2024], category: 'chico', consumptionLper100: 6.2, suggestedFuel: 'super', tankLiters: 44 },
  { brand: 'Chevrolet', model: 'Onix Plus', version: '1.2', years: [2020, 2021, 2022, 2023, 2024], category: 'sedan', consumptionLper100: 6.4, suggestedFuel: 'super', tankLiters: 44 },
  { brand: 'Chevrolet', model: 'Tracker', version: '1.2 Turbo', years: [2020, 2021, 2022, 2023, 2024], category: 'suv', consumptionLper100: 7.3, suggestedFuel: 'super', tankLiters: 44 },
  { brand: 'Chevrolet', model: 'S10', version: '2.8 TD', years: [2019, 2020, 2021, 2022, 2023], category: 'pickup', consumptionLper100: 9.2, suggestedFuel: 'super', tankLiters: 76 },

  // ---- Renault ----
  { brand: 'Renault', model: 'Kwid', version: '1.0', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'chico', consumptionLper100: 5.8, suggestedFuel: 'super', tankLiters: 38 },
  { brand: 'Renault', model: 'Sandero', version: '1.6', years: [2019, 2020, 2021, 2022], category: 'chico', consumptionLper100: 6.7, suggestedFuel: 'super', tankLiters: 50 },
  { brand: 'Renault', model: 'Logan', version: '1.6', years: [2019, 2020, 2021, 2022], category: 'sedan', consumptionLper100: 6.8, suggestedFuel: 'super', tankLiters: 50 },
  { brand: 'Renault', model: 'Duster', version: '1.6', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'suv', consumptionLper100: 7.8, suggestedFuel: 'super', tankLiters: 50 },
  { brand: 'Renault', model: 'Alaskan', version: '2.3 TDI', years: [2020, 2021, 2022, 2023], category: 'pickup', consumptionLper100: 8.8, suggestedFuel: 'super', tankLiters: 80 },

  // ---- Peugeot ----
  { brand: 'Peugeot', model: '208', version: '1.6', years: [2020, 2021, 2022, 2023, 2024], category: 'chico', consumptionLper100: 6.4, suggestedFuel: 'super', tankLiters: 44 },
  { brand: 'Peugeot', model: '2008', version: '1.6', years: [2020, 2021, 2022, 2023, 2024], category: 'suv', consumptionLper100: 7.2, suggestedFuel: 'super', tankLiters: 44 },
  { brand: 'Peugeot', model: 'Partner', version: '1.6', years: [2019, 2020, 2021, 2022], category: 'sedan', consumptionLper100: 7.5, suggestedFuel: 'super', tankLiters: 55 },

  // ---- Ford ----
  { brand: 'Ford', model: 'Ka', version: '1.5', years: [2019, 2020, 2021], category: 'chico', consumptionLper100: 6.3, suggestedFuel: 'super', tankLiters: 42 },
  { brand: 'Ford', model: 'Territory', version: '1.5 Turbo', years: [2021, 2022, 2023, 2024], category: 'suv', consumptionLper100: 8.0, suggestedFuel: 'premium', tankLiters: 55 },
  { brand: 'Ford', model: 'Ranger', version: '3.2 TDI', years: [2019, 2020, 2021, 2022], category: 'pickup', consumptionLper100: 9.4, suggestedFuel: 'super', tankLiters: 80 },
  { brand: 'Ford', model: 'Ranger', version: '2.0 Bi-Turbo', years: [2023, 2024], category: 'pickup', consumptionLper100: 8.6, suggestedFuel: 'super', tankLiters: 80 },

  // ---- Citroën ----
  { brand: 'Citroën', model: 'C3', version: '1.6', years: [2019, 2020, 2021, 2022, 2023, 2024], category: 'chico', consumptionLper100: 6.6, suggestedFuel: 'super', tankLiters: 50 },
  { brand: 'Citroën', model: 'C4 Cactus', version: '1.6', years: [2019, 2020, 2021, 2022, 2023], category: 'suv', consumptionLper100: 7.3, suggestedFuel: 'super', tankLiters: 50 },
];

/** Catálogo expandido: un Car por (semilla × año). */
export const CARS: Car[] = SEEDS.flatMap((seed) =>
  seed.years.map((year) => {
    const brandId = slug(seed.brand);
    return {
      id: `${brandId}-${slug(seed.model)}-${slug(seed.version)}-${year}`,
      brand: seed.brand,
      brandId,
      model: seed.model,
      version: seed.version,
      year,
      category: seed.category,
      consumptionLper100: seed.consumptionLper100,
      suggestedFuel: seed.suggestedFuel,
      tankLiters: seed.tankLiters,
    };
  }),
);

/** Marcas ordenadas por popularidad en Argentina (para el orden de la grilla). */
export const BRANDS: { id: string; name: string }[] = [
  { id: 'fiat', name: 'Fiat' },
  { id: 'volkswagen', name: 'Volkswagen' },
  { id: 'toyota', name: 'Toyota' },
  { id: 'chevrolet', name: 'Chevrolet' },
  { id: 'renault', name: 'Renault' },
  { id: 'peugeot', name: 'Peugeot' },
  { id: 'ford', name: 'Ford' },
  { id: 'citroen', name: 'Citroën' },
];

/** Perfiles de consumo por categoría (fallback "no encuentro mi auto"). */
export const CATEGORY_PROFILES: CategoryProfile[] = [
  { category: 'chico', label: 'Auto chico', consumptionLper100: 6.2, suggestedFuel: 'super', tankLiters: 45 },
  { category: 'sedan', label: 'Sedán', consumptionLper100: 6.8, suggestedFuel: 'super', tankLiters: 50 },
  { category: 'suv', label: 'SUV', consumptionLper100: 7.8, suggestedFuel: 'super', tankLiters: 55 },
  { category: 'pickup', label: 'Pickup', consumptionLper100: 9.0, suggestedFuel: 'super', tankLiters: 78 },
];
