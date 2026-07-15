/**
 * Controlador de la pantalla "¿Qué auto tienen?" (selector.html).
 *
 * Puebla marca → modelo → año desde el catálogo, resuelve el auto, muestra en
 * vivo el consumo/nafta/tanque deducidos y guarda la selección en el store.
 * También cubre el fallback por categoría ("no encuentro mi auto").
 */

import { services } from '../data/provider';
import type { Car, CarCategory } from '../domain/types';
import { formatConsumption, fuelLabelShort } from '../domain/format';
import { rangeFor } from '../domain/trip';
import { qs, qsa, escapeHtml } from './dom';
import { tripStore } from './tripStore';
import { BRAND_COLORS } from '../data/mock/stations.data';

interface SelectorState {
  brandId: string | null;
  brandName: string | null;
  model: string | null;
  year: number | null;
  category: CarCategory | null; // fallback activo
  car: Car | null;              // auto resuelto del catálogo
  /**
   * Token de generación. Cada acción del usuario (o la hidratación inicial) lo
   * incrementa; las operaciones async capturan su valor y descartan su render
   * si otra acción lo superó. Evita que llamadas encadenadas (listModels →
   * listYears → findCar) se pisen entre sí cuando llegan fuera de orden.
   */
  gen: number;
}

const state: SelectorState = {
  brandId: null,
  brandName: null,
  model: null,
  year: null,
  category: null,
  car: null,
  gen: 0,
};

// Avatares de marca (reusa colores de las estaciones donde coinciden).
const BRAND_AVATAR: Record<string, { bg: string; fg: string; abbr: string }> = {
  fiat: { bg: '#8B1D34', fg: '#fff', abbr: 'FI' },
  volkswagen: { bg: '#1A2E52', fg: '#fff', abbr: 'VW' },
  toyota: { bg: '#B12C33', fg: '#fff', abbr: 'TO' },
  chevrolet: { bg: '#C79A2A', fg: '#fff', abbr: 'CH' },
  renault: { bg: '#3B3B3B', fg: '#F5C400', abbr: 'RE' },
  peugeot: { bg: '#20335C', fg: '#fff', abbr: 'PE' },
  ford: { bg: '#12356F', fg: '#fff', abbr: 'FO' },
  citroen: { bg: '#7B2D3F', fg: '#fff', abbr: 'CI' },
};

function avatarFor(brandId: string): { bg: string; fg: string; abbr: string } {
  return BRAND_AVATAR[brandId] ?? BRAND_COLORS[brandId] ?? { bg: '#4A5578', fg: '#fff', abbr: brandId.slice(0, 2).toUpperCase() };
}

export async function initSelector(): Promise<void> {
  const brandGrid = qs('[data-brands]');
  const modelList = qs('[data-models]');
  const yearChips = qs('[data-years]');
  const deduced = qs('[data-deduced]');
  const useBtn = qs<HTMLAnchorElement>('[data-use-car]');
  const searchInput = qs<HTMLInputElement>('.selector-search');
  const categoryChips = qsa('[data-category] .category-chip');

  // ---- Marcas ----
  const brands = await services.cars.listBrands();
  brandGrid.innerHTML = brands
    .map((b) => {
      const a = avatarFor(b.id);
      return `<div class="brand-tile" data-brand="${b.id}" role="button" tabindex="0">
        <div class="brand-avatar" style="background:${a.bg};color:${a.fg}">${a.abbr}</div>
        <div class="brand-name">${escapeHtml(b.name)}</div>
      </div>`;
    })
    .join('');

  brandGrid.addEventListener('click', (e) => {
    const tile = (e.target as HTMLElement).closest<HTMLElement>('[data-brand]');
    if (!tile) return;
    const id = tile.dataset.brand!;
    const name = brands.find((b) => b.id === id)?.name ?? null;
    void selectBrand(id, name);
  });

  // ---- Búsqueda libre ----
  let searchTimer: number | undefined;
  searchInput.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    const q = searchInput.value;
    searchTimer = window.setTimeout(() => void runSearch(q), 200);
  });

  // ---- Fallback por categoría ----
  const categoryContainer = qs('[data-category]');
  categoryContainer.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.category-chip');
    if (!chip) return;
    void selectCategory(chip.dataset.categoryValue as CarCategory, categoryChips);
  });

  // ---- Confirmar ----
  useBtn.addEventListener('click', (e) => {
    if (useBtn.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      return;
    }
    if (state.car) {
      tripStore.setCar({ kind: 'catalog', carId: state.car.id });
    } else if (state.category) {
      tripStore.setCar({ kind: 'category', category: state.category });
    }
    // el href de la maqueta ("index.html") completa la navegación
  });

  // Estado inicial: intentar reflejar el auto que ya está en el store.
  await hydrateFromStore();

  // ---------------------------------------------------------------
  // Handlers internos
  // ---------------------------------------------------------------

  // Un solo listener por lista; distingue modelo vs. auto-de-búsqueda por el
  // atributo presente. Registrarlos una vez evita handlers duplicados.
  modelList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const carItem = target.closest<HTMLElement>('[data-car]');
    if (carItem) {
      void selectCarById(carItem.dataset.car!);
      return;
    }
    const modelItem = target.closest<HTMLElement>('[data-model]');
    if (modelItem) void selectModel(modelItem.dataset.model!);
  });

  yearChips.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-year]');
    if (!chip) return;
    void selectYear(Number(chip.dataset.year));
  });

  /** Inicia una nueva "generación" de interacción y devuelve su token. */
  function beginGen(): number {
    return ++state.gen;
  }
  /** true si la generación `g` sigue siendo la vigente (no fue superada). */
  function isCurrent(g: number): boolean {
    return state.gen === g;
  }

  async function selectBrand(brandId: string, brandName: string | null, g = beginGen()): Promise<void> {
    state.brandId = brandId;
    state.brandName = brandName;
    state.model = null;
    state.year = null;
    state.category = null;
    state.car = null;
    markSelected(brandGrid, `[data-brand="${brandId}"]`);
    clearSelected(categoryChips);

    const models = await services.cars.listModels(brandId);
    if (!isCurrent(g)) return;
    modelList.innerHTML = models
      .map((m) => `<div class="model-item" data-model="${escapeHtml(m)}" role="button" tabindex="0">${escapeHtml(m)}</div>`)
      .join('');
    yearChips.innerHTML = '';
    renderDeduced();
    updateUseBtn();
  }

  async function selectModel(model: string, g = beginGen()): Promise<void> {
    if (!state.brandId) return;
    state.model = model;
    state.year = null;
    state.car = null;
    markSelected(modelList, `[data-model="${cssEscape(model)}"]`);

    const years = await services.cars.listYears(state.brandId, model);
    if (!isCurrent(g)) return;
    yearChips.innerHTML = years
      .map((y) => `<span class="year-chip" data-year="${y}" role="button" tabindex="0">${y}</span>`)
      .join('');
    renderDeduced();
    updateUseBtn();
  }

  async function selectYear(year: number, g = beginGen()): Promise<void> {
    if (!state.brandId || !state.model) return;
    state.year = year;
    markSelected(yearChips, `[data-year="${year}"]`);
    const car = await services.cars.findCar(state.brandId, state.model, year);
    if (!isCurrent(g)) return;
    state.car = car;
    renderDeduced();
    updateUseBtn();
  }

  async function selectCategory(category: CarCategory, chips: HTMLElement[]): Promise<void> {
    const g = beginGen();
    state.category = category;
    state.car = null;
    state.brandId = state.model = null;
    state.year = null;
    clearSelected(chips);
    const active = chips.find((c) => c.dataset.categoryValue === category);
    active?.classList.add('selected');
    clearSelected(qsa('[data-brand]', brandGrid));
    clearSelected(qsa('[data-model]', modelList));
    clearSelected(qsa('[data-year]', yearChips));

    const profiles = await services.cars.categoryProfiles();
    if (!isCurrent(g)) return;
    const profile = profiles.find((p) => p.category === category);
    if (profile) {
      const range = Math.round(rangeFor(profile.tankLiters, profile.consumptionLper100));
      renderDeducedRows(
        `${formatConsumption(profile.consumptionLper100)}`,
        fuelLabelShort(profile.suggestedFuel),
        `${profile.tankLiters} L → autonomía ~${range} km`,
        true,
      );
    }
    updateUseBtn();
  }

  async function runSearch(query: string): Promise<void> {
    const g = beginGen();
    const results = await services.cars.search(query);
    if (!isCurrent(g) || query.trim() === '') return;
    if (results.length === 0) {
      modelList.innerHTML = `<div class="model-item" style="cursor:default;color:var(--text-muted)">Sin resultados — probá con otra marca o modelo.</div>`;
      return;
    }
    // Mostramos los modelos encontrados como lista clickeable de autos concretos.
    modelList.innerHTML = results
      .map(
        (c) =>
          `<div class="model-item" data-car="${c.id}" role="button" tabindex="0">${escapeHtml(`${c.brand} ${c.model} ${c.version} · ${c.year}`)}</div>`,
      )
      .join('');
  }

  async function selectCarById(id: string): Promise<void> {
    const g = beginGen();
    const car = await services.cars.getCarById(id);
    if (!isCurrent(g) || !car) return;
    // Sincronizamos las tres columnas con la cascada normal (marca → modelo →
    // año) para que no quede seleccionada una marca vieja de antes de buscar.
    await selectBrand(car.brandId, car.brand, g);
    if (!isCurrent(g)) return;
    await selectModel(car.model, g);
    if (!isCurrent(g)) return;
    await selectYear(car.year, g);
  }

  function renderDeduced(): void {
    if (state.car) {
      const c = state.car;
      const range = Math.round(rangeFor(c.tankLiters, c.consumptionLper100));
      renderDeducedRows(
        formatConsumption(c.consumptionLper100),
        fuelLabelShort(c.suggestedFuel),
        `${c.tankLiters} L → autonomía ~${range} km`,
        false,
      );
    } else {
      renderDeducedPlaceholder();
    }
  }

  function renderDeducedRows(consumo: string, nafta: string, tanque: string, estimated: boolean): void {
    deduced.innerHTML = `
      <div class="deduced-title">✓ ESTO LO DEDUCIMOS NOSOTROS${estimated ? ' (promedio por tipo)' : ''}</div>
      <div class="deduced-rows">
        <div>Consumo en ruta: <b>${escapeHtml(consumo)}</b></div>
        <div>Nafta sugerida: <b>${escapeHtml(nafta)}</b></div>
        <div>Tanque: <b>${escapeHtml(tanque)}</b></div>
      </div>`;
  }

  function renderDeducedPlaceholder(): void {
    deduced.innerHTML = `
      <div class="deduced-title">✓ ESTO LO DEDUCIMOS NOSOTROS</div>
      <div class="deduced-rows">
        <div style="color:var(--text-muted)">Elegí marca, modelo y año y te mostramos consumo, nafta y autonomía.</div>
      </div>`;
  }

  function updateUseBtn(): void {
    const ready = state.car != null || state.category != null;
    useBtn.setAttribute('aria-disabled', ready ? 'false' : 'true');
    useBtn.style.opacity = ready ? '1' : '0.5';
    useBtn.style.pointerEvents = ready ? 'auto' : 'none';
    useBtn.textContent = state.category && !state.car ? 'Usar promedio de esta categoría' : 'Usar este auto';
  }

  async function hydrateFromStore(): Promise<void> {
    // La hidratación completa comparte una sola generación: si el usuario
    // interactúa mientras corre, su click incrementa `gen` y la aborta entera.
    const g = beginGen();
    const trip = tripStore.get();
    if (trip.car.kind === 'catalog') {
      const car = await services.cars.getCarById(trip.car.carId);
      if (!isCurrent(g)) return;
      if (car) {
        await selectBrand(car.brandId, car.brand, g);
        if (!isCurrent(g)) return;
        await selectModel(car.model, g);
        if (!isCurrent(g)) return;
        await selectYear(car.year, g);
        return;
      }
    } else {
      await selectCategory(trip.car.category, categoryChips);
      return;
    }
    renderDeducedPlaceholder();
    updateUseBtn();
  }
}

// ---- utils de selección visual ----

function markSelected(container: Element, selector: string): void {
  qsa('.selected', container).forEach((n) => n.classList.remove('selected'));
  const target = container.querySelector(selector);
  target?.classList.add('selected');
}

function clearSelected(nodes: Element[]): void {
  nodes.forEach((n) => n.classList.remove('selected'));
}

/** Escapa comillas para usar un valor arbitrario dentro de un selector CSS. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}
