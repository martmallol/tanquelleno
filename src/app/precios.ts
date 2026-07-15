/**
 * Controlador de la página "Precios de nafta por provincia".
 *
 * Lista las provincias y, al elegir una, muestra el promedio de Súper y
 * Premium usando el mismo FuelPriceService (live o mock) que el cálculo.
 */

import { services } from '../data/provider';
import { formatARSCompact } from '../domain/format';
import { PROVINCE_TO_DATASET } from '../data/live/provinces';
import { qs, escapeHtml } from './dom';

const PROVINCE_LABELS: Record<string, string> = {
  'buenos-aires': 'Buenos Aires',
  'capital-federal': 'Ciudad de Buenos Aires',
  catamarca: 'Catamarca',
  chaco: 'Chaco',
  chubut: 'Chubut',
  cordoba: 'Córdoba',
  corrientes: 'Corrientes',
  'entre-rios': 'Entre Ríos',
  formosa: 'Formosa',
  jujuy: 'Jujuy',
  'la-pampa': 'La Pampa',
  'la-rioja': 'La Rioja',
  mendoza: 'Mendoza',
  misiones: 'Misiones',
  neuquen: 'Neuquén',
  'rio-negro': 'Río Negro',
  salta: 'Salta',
  'san-juan': 'San Juan',
  'san-luis': 'San Luis',
  'santa-cruz': 'Santa Cruz',
  'santa-fe': 'Santa Fe',
  'santiago-del-estero': 'Santiago del Estero',
  'tierra-del-fuego': 'Tierra del Fuego',
  tucuman: 'Tucumán',
};

export async function initPrecios(): Promise<void> {
  const select = qs<HTMLSelectElement>('[data-province]');
  const cards = qs('[data-precios]');
  const status = qs('[data-status]');

  const provinces = Object.keys(PROVINCE_TO_DATASET).sort((a, b) =>
    (PROVINCE_LABELS[a] ?? a).localeCompare(PROVINCE_LABELS[b] ?? b, 'es'),
  );

  select.innerHTML =
    `<option value="">Elegí…</option>` +
    provinces
      .map((id) => `<option value="${id}">${escapeHtml(PROVINCE_LABELS[id] ?? id)}</option>`)
      .join('');

  // Arranca con Buenos Aires para no dejar la página vacía.
  select.value = 'buenos-aires';
  await load('buenos-aires');

  select.addEventListener('change', () => {
    if (select.value) void load(select.value);
  });

  async function load(provinceId: string): Promise<void> {
    status.textContent = 'Cargando…';
    cards.innerHTML = `<div class="precios-empty">Buscando precios…</div>`;
    try {
      const [sup, prem] = await Promise.all([
        services.fuelPrices.provinceAverage(provinceId, 'super'),
        services.fuelPrices.provinceAverage(provinceId, 'premium'),
      ]);
      const estimated = !sup.exact || sup.source !== 'province';
      status.textContent = estimated ? 'promedio provincial' : '';
      cards.innerHTML = `
        <div class="precio-card">
          <div class="precio-fuel">Nafta Súper</div>
          <div class="precio-value">${formatARSCompact(sup.pricePerLiter)}<span class="precio-unit">/L</span></div>
          <div class="precio-src">${sourceLabel(sup.source)}</div>
        </div>
        <div class="precio-card">
          <div class="precio-fuel">Nafta Premium</div>
          <div class="precio-value">${formatARSCompact(prem.pricePerLiter)}<span class="precio-unit">/L</span></div>
          <div class="precio-src">${sourceLabel(prem.source)}</div>
        </div>`;
    } catch {
      status.textContent = '';
      cards.innerHTML = `<div class="precios-empty">No pudimos traer los precios ahora. Probá de nuevo en un rato.</div>`;
    }
  }

  function sourceLabel(source: string): string {
    return source === 'province' ? 'promedio de la provincia' : 'promedio nacional (sin dato provincial)';
  }
}
