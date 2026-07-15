/**
 * Controlador de la pantalla de resultado (resultado.html).
 *
 * Planifica el viaje con el TripInput del store y renderiza: header con la
 * ruta, tarjeta de resumen (total, comparativa de nafta, stats, peajes), el
 * mapa desde la geometría real y la lista de estaciones con sus estados de
 * precio (exacto vs estimado). Maneja estados de carga y error de red.
 */

import { services } from '../data/provider';
import { planTrip } from './tripPlanner';
import type { TripPlan, Station } from '../domain/types';
import {
  formatARS,
  formatARSCompact,
  formatKm,
  formatLiters,
  formatStops,
  fuelLabel,
  priceStateLabel,
} from '../domain/format';
import { qs, qso, escapeHtml } from './dom';
import { tripStore } from './tripStore';
import { renderRouteMap, type RouteMapHandles } from './mapView';
import { navQrDataUrl } from './navLink';
import { BRAND_COLORS } from '../data/mock/stations.data';

export async function initResultado(): Promise<void> {
  const root = qs('[data-resultado]');
  setLoading(root);

  try {
    const plan = await planTrip(services, tripStore.get());
    render(root, plan);
    wireSaveButtons(plan);
  } catch (err) {
    setError(root, err instanceof Error ? err.message : 'No pudimos calcular el viaje.');
  }
}

/** Conecta los botones "Guardar" (desktop y mobile) con Mis viajes. */
function wireSaveButtons(plan: TripPlan): void {
  const title = routeTitle(plan);
  const subtitle = `${plan.car.label} · ${formatARS(plan.costs[0]!.totalCost)} de nafta`;
  document.querySelectorAll<HTMLButtonElement>('[data-save-trip], .btn-save').forEach((btn) => {
    btn.addEventListener('click', () => {
      tripStore.save({ title, subtitle, trip: tripStore.get() });
      const original = btn.textContent;
      btn.textContent = '✓ Guardado';
      btn.setAttribute('disabled', 'true');
      setTimeout(() => {
        btn.textContent = original;
        btn.removeAttribute('disabled');
      }, 1800);
    });
  });
}

// ------------------------------------------------------------------

function setLoading(root: HTMLElement): void {
  const total = qso('[data-total]', root);
  if (total) total.textContent = 'Calculando…';
  root.setAttribute('data-state', 'loading');
}

function setError(root: HTMLElement, message: string): void {
  root.setAttribute('data-state', 'error');
  const banner = qso('[data-error]', root);
  if (banner) {
    banner.textContent = `${message} Probá de nuevo o revisá el viaje.`;
    banner.removeAttribute('hidden');
  }
}

function routeTitle(plan: TripPlan): string {
  return plan.route.waypoints.map((w) => w.name).join(' → ');
}

function render(root: HTMLElement, plan: TripPlan): void {
  root.setAttribute('data-state', 'ready');

  const suggested = plan.costs[0]!;
  const alt = plan.costs[1]!;

  // ---- Header (ruta + chips) ----
  const title = routeTitle(plan);
  setText(root, '[data-route-title]', title);
  const chips = qso('[data-route-chips]', root);
  if (chips) {
    chips.innerHTML = `
      <span class="chip-on-dark">${plan.route.roundTrip ? 'ida y vuelta' : 'solo ida'}</span>
      <span class="chip-on-dark">${escapeHtml(plan.car.label)}</span>`;
  }

  // ---- Total + comparativa ----
  qsaText(root, '[data-total]', formatARS(suggested.totalCost));
  setText(
    root,
    '[data-total-sub]',
    `con ${fuelLabel(plan.car.suggestedFuel)}${plan.car.estimatedConsumption ? ' · consumo estimado' : ', la que usa tu auto'}`,
  );

  const fuelRows = qso('[data-fuel-rows]', root);
  if (fuelRows) {
    const deltaPct = suggested.totalCost > 0 ? alt.totalCost - suggested.totalCost : 0;
    fuelRows.innerHTML = `
      <div class="fuel-row suggested">
        <div class="fuel-row-name">${escapeHtml(fuelLabel(plan.car.suggestedFuel))} <span class="badge-green">sugerida</span></div>
        <div class="fuel-row-price">${formatARS(suggested.totalCost)}</div>
      </div>
      <div class="fuel-row alt">
        <div class="fuel-row-name">${escapeHtml(fuelLabel(alt.fuel))}</div>
        <div class="fuel-row-price">${formatARS(alt.totalCost)} <span class="fuel-row-delta">+${formatARSCompact(deltaPct)}</span></div>
      </div>`;
  }

  // ---- Stats ----
  const legsText = plan.route.roundTrip ? 'ida y vuelta' : 'solo ida';
  const statsGrid = qso('[data-stats]', root);
  if (statsGrid) {
    const priceNote = plan.avgPriceEstimated
      ? 'promedio estimado del recorrido'
      : 'promedio en tu recorrido';
    const litersNote = plan.car.loadAdjusted
      ? 'ajustado por carga del auto'
      : plan.car.manualConsumption
        ? 'con tu consumo manual'
        : plan.car.estimatedConsumption
          ? 'estimados por categoría'
          : 'estimados para tu auto';
    statsGrid.innerHTML = `
      <div><div class="stat-value">${formatKm(plan.totalDistanceKm)}</div><div class="stat-label">${legsText}, según la ruta</div></div>
      <div><div class="stat-value">${formatLiters(plan.liters)}</div><div class="stat-label">${litersNote}</div></div>
      <div><div class="stat-value">${formatARSCompact(plan.avgPricePerLiter)}/L</div><div class="stat-label">${priceNote}</div></div>
      <div><div class="stat-value">${formatStops(plan.refuelStops)}</div><div class="stat-label">saliendo con tanque lleno</div></div>`;
  }

  // ---- Peajes + total combinado ----
  setText(root, '[data-tolls]', formatARS(plan.tolls));
  setText(root, '[data-grand-total]', formatARS(suggested.totalCost + plan.tolls));

  // ---- Header mobile (resumen navy) ----
  setText(root, '[data-m-total]', formatARS(suggested.totalCost));
  setText(
    root,
    '[data-m-sub]',
    `${fuelLabel(plan.car.suggestedFuel)} · con ${fuelLabel(alt.fuel)} ${formatARS(alt.totalCost)}`,
  );
  const mStats = qso('[data-m-stats]', root);
  if (mStats) {
    mStats.innerHTML = `
      <span><b>${formatKm(plan.totalDistanceKm).replace(' km', '')}</b> km</span>
      <span><b>${plan.liters}</b> L</span>
      <span><b>${plan.refuelStops}</b> cargas</span>
      <span>peajes <b>${formatARSCompact(plan.tolls)}</b></span>`;
  }

  // ---- Mapa ----
  renderMapPanels(root, plan);

  // ---- Estaciones ----
  renderStations(root, plan);

  // ---- QR de navegación (Google Maps) ----
  void renderNavQr(root, plan);
}

async function renderNavQr(root: HTMLElement, plan: TripPlan): Promise<void> {
  const box = qso('[data-qr]', root);
  const img = qso<HTMLImageElement>('[data-qr-img]', root);
  if (!box || !img) return;
  try {
    img.src = await navQrDataUrl(plan);
    box.removeAttribute('hidden');
  } catch {
    // Si falla la generación, dejamos el bloque oculto (no es crítico).
  }
}

/** Handles del mapa montado, para enfocar estaciones desde las cards. */
let mapHandles: RouteMapHandles | null = null;
let activePanel: HTMLElement | null = null;

/**
 * Monta el mapa Leaflet en el panel visible según el breakpoint. Leaflet no
 * se inicializa bien en contenedores con display:none, así que montamos solo
 * el visible y re-montamos si cambia el ancho de pantalla.
 */
function renderMapPanels(root: HTMLElement, plan: TripPlan): void {
  const desktop = qso('[data-map]', root);
  const mobile = qso('[data-map-mobile]', root);
  const mq = window.matchMedia('(max-width: 900px)');

  const mount = (): void => {
    mapHandles?.map.remove();
    mapHandles = null;
    const panel = mq.matches ? mobile : desktop;
    if (!panel) return;
    const note = panel.querySelector('.map-note')?.outerHTML ?? '';
    panel.innerHTML = '';
    mapHandles = renderRouteMap(panel, plan);
    activePanel = panel;
    if (note) panel.insertAdjacentHTML('beforeend', note);
  };

  mount();
  mq.addEventListener('change', mount);
}

/** Enfoca una estación en el mapa: paneo + popup (desde el click en su card). */
function focusStationOnMap(stationId: string): void {
  const marker = mapHandles?.stationMarkers.get(stationId);
  if (!marker || !mapHandles) return;
  activePanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  mapHandles.map.panTo(marker.getLatLng());
  marker.openPopup();
}

function stationCard(s: Station, cheapest: boolean): string {
  const color = BRAND_COLORS[s.brandId] ?? { bg: '#4A5578', fg: '#fff', abbr: s.brandId.slice(0, 2).toUpperCase() };
  const badge = s.price.exact
    ? `<span class="badge-green">${priceStateLabel(s.price.source)}</span>`
    : `<span class="badge-muted">${priceStateLabel(s.price.source)}</span>`;
  const priceText = s.price.exact
    ? `${formatARSCompact(s.price.pricePerLiter)}/L`
    : `≈ ${formatARSCompact(s.price.pricePerLiter)}/L`;
  const flag = cheapest ? `<div class="station-flag">★ MÁS BARATA DEL TRAYECTO</div>` : '';
  const seq = s.seq != null ? `<span class="station-seq">${s.seq}</span>` : '';
  return `
    <div class="station-card${cheapest ? ' cheapest' : ''}" data-station-id="${s.id}" role="button" tabindex="0" title="Ver en el mapa">
      ${flag}
      <div class="station-brand">${seq}<span class="brand-logo" style="background:${color.bg};color:${color.fg}">${color.abbr}</span><span class="station-name">${escapeHtml(s.brand)}</span></div>
      <div class="station-body">
        <div class="station-place">${escapeHtml(s.place)} · km ${s.kmFromStart}</div>
        <div class="station-price">${priceText} ${badge}</div>
      </div>
    </div>`;
}

/** Título de sección de una carga: "1ª carga · cerca del km 616 del viaje". */
function legTitle(n: number, targetTripKm: number): string {
  return `${n}ª carga <span class="stations-group-hint">· cerca del km ${targetTripKm} del viaje</span>`;
}

function renderStations(root: HTMLElement, plan: TripPlan): void {
  const container = qso('[data-stations]', root);
  if (!container) return;
  if (plan.stations.length === 0) {
    container.innerHTML = `<div class="stations-empty">No encontramos estaciones sobre esta ruta en nuestros datos. Cargá con el tanque lleno antes de salir.</div>`;
    return;
  }

  // La más barata de todo el trayecto conserva su estrella, esté donde esté.
  const cheapestId = plan.stations[0]!.id;
  const groups: string[] = [];

  for (const leg of plan.refuelLegs) {
    const cards =
      leg.stations.length > 0
        ? `<div class="stations-grid">${leg.stations.map((s) => stationCard(s, s.id === cheapestId)).join('')}</div>`
        : `<div class="stations-empty">Sin estaciones en la ventana de esta carga — conviene cargar en la anterior o apenas después.</div>`;
    groups.push(
      `<div class="stations-group"><div class="stations-group-title">${legTitle(leg.n, leg.targetTripKm)}</div>${cards}</div>`,
    );
  }

  if (plan.extraStations.length > 0) {
    const title =
      plan.refuelLegs.length > 0
        ? 'Estaciones de backup <span class="stations-group-hint">· sobre la ruta, por si querés cargar antes</span>'
        : 'Sobre la ruta <span class="stations-group-hint">· salís con tanque lleno y llegás sin cargar</span>';
    groups.push(
      `<div class="stations-group stations-group-backup"><div class="stations-group-title">${title}</div><div class="stations-grid">${plan.extraStations
        .map((s) => stationCard(s, s.id === cheapestId))
        .join('')}</div></div>`,
    );
  }

  container.innerHTML = groups.join('');

  // Click en una card → enfocar su pin en el mapa.
  container.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-station-id]');
    if (!card) return;
    container.querySelectorAll('.station-card.active').forEach((c) => c.classList.remove('active'));
    card.classList.add('active');
    focusStationOnMap(card.dataset.stationId!);
  });
}

// ---- helpers ----

function setText(root: HTMLElement, selector: string, text: string): void {
  const el = qso(selector, root);
  if (el) el.textContent = text;
}

function qsaText(root: HTMLElement, selector: string, text: string): void {
  root.querySelectorAll(selector).forEach((el) => {
    el.textContent = text;
  });
}
