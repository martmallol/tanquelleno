/**
 * Controlador de la pantalla de resultado (resultado.html).
 *
 * Planifica el viaje con el TripInput del store y renderiza: header con la
 * ruta y la navegación del sitio, tarjeta de resumen (total, mejor/peor caso,
 * comparativa de nafta, stats, peajes con desglose), el mapa (ruta real,
 * estaciones y cabinas de peaje) y la lista de estaciones por carga. El usuario
 * elige en qué estación carga en cada tramo y el total se recalcula al instante.
 */

import { services } from '../data/provider';
import { planTrip } from './tripPlanner';
import type { Station, TripPlan } from '../domain/types';
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
import { renderRouteMap, refreshStationMarker, type RouteMapHandles } from './mapView';
import { googleMapsUrl, mapsQrDataUrl } from './navLink';
import { BRAND_COLORS } from '../data/mock/stations.data';
import {
  legsWithStations,
  chosenStation,
  currentBasis,
  bestBasis,
  worstBasis,
  relabelLeg,
} from '../domain/stationChoice';

/** Estado mutable de la pantalla: el plan y la estación elegida por carga. */
let currentPlan: TripPlan | null = null;
const selectedByLeg = new Map<number, string>();

export async function initResultado(): Promise<void> {
  const root = qs('[data-resultado]');
  setLoading(root);

  try {
    const plan = await planTrip(services, tripStore.get());
    currentPlan = plan;
    selectedByLeg.clear();
    render(root, plan);
    wireSaveButtons(plan);
    wirePdfButtons();
  } catch (err) {
    setError(root, err instanceof Error ? err.message : 'No pudimos calcular el viaje.');
  }
}

/** Conecta los botones "Guardar" (desktop y mobile) con Mis viajes. */
function wireSaveButtons(plan: TripPlan): void {
  const title = routeTitle(plan);
  const subtitle = `${plan.car.label} · ${formatARS(suggestedTotal())} de nafta`;
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

/** "Guardar PDF" e "Imprimir" abren el diálogo de impresión (destino → PDF). */
function wirePdfButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-print], [data-save-pdf]').forEach((btn) => {
    btn.addEventListener('click', () => window.print());
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

// ---- Precios según la estación elegida en cada carga (ver domain/stationChoice) ----

/** Total de nafta con la selección actual (usado para el subtítulo al guardar). */
function suggestedTotal(): number {
  return currentPlan ? currentPlan.liters * currentBasis(currentPlan, selectedByLeg) : 0;
}

/** Diferencia premium − sugerida por litro, para la comparativa de nafta. */
function premiumSpread(plan: TripPlan): number {
  return Math.max(0, plan.costs[1]!.pricePerLiter - plan.costs[0]!.pricePerLiter);
}

// ------------------------------------------------------------------

function render(root: HTMLElement, plan: TripPlan): void {
  root.setAttribute('data-state', 'ready');

  // ---- Header (ruta + chips) ----
  const title = routeTitle(plan);
  setText(root, '[data-route-title]', title);
  const chips = qso('[data-route-chips]', root);
  if (chips) {
    chips.innerHTML = `
      <span class="chip-on-dark">${plan.route.roundTrip ? 'ida y vuelta' : 'solo ida'}</span>
      <span class="chip-on-dark">${escapeHtml(plan.car.label)}</span>`;
  }

  setText(root, '[data-total-sub]', costSubText(plan));

  // ---- Stats (distancia, litros, precio elegido, cargas) ----
  const legsText = plan.route.roundTrip ? 'ida y vuelta' : 'solo ida';
  const statsGrid = qso('[data-stats]', root);
  if (statsGrid) {
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
      <div><div class="stat-value" data-stat-price>—</div><div class="stat-label" data-stat-price-label>—</div></div>
      <div><div class="stat-value">${formatStops(plan.refuelStops)}</div><div class="stat-label">saliendo con tanque lleno</div></div>`;
  }

  // ---- Header mobile: stats fijos (litros/km/cargas/peajes) ----
  const mStats = qso('[data-m-stats]', root);
  if (mStats) {
    mStats.innerHTML = `
      <span><b>${formatKm(plan.totalDistanceKm).replace(' km', '')}</b> km</span>
      <span><b>${plan.liters}</b> L</span>
      <span><b>${plan.refuelStops}</b> cargas</span>
      <span>peajes <b>${formatARSCompact(plan.tolls)}</b></span>`;
  }

  // ---- Totales (dependen de la estación elegida) ----
  updateCosts(root, plan);

  // ---- Peajes (desglose real) ----
  renderTolls(root, plan);

  // ---- Mapa ----
  renderMapPanels(root, plan);

  // ---- Estaciones (con selección) ----
  renderStations(root, plan);

  // ---- Navegación al celular (QR desktop + links mobile) ----
  wireNavLinks(root, plan);
  void renderNavQr(root, plan);
}

/** Subtítulo del total: aclara sobre qué precio se calcula. */
function costSubText(plan: TripPlan): string {
  const base = `con ${fuelLabel(plan.car.suggestedFuel)}${plan.car.estimatedConsumption ? ' · consumo estimado' : ', la que usa tu auto'}`;
  return legsWithStations(plan).length > 0 ? `${base} · en las estaciones que elijas` : base;
}

/** Escribe todos los importes que dependen de la estación elegida. */
function updateCosts(root: HTMLElement, plan: TripPlan): void {
  const basis = currentBasis(plan, selectedByLeg);
  const suggested = plan.liters * basis;
  const premium = plan.liters * (basis + premiumSpread(plan));

  qsaText(root, '[data-total]', formatARS(suggested));
  setText(root, '[data-grand-total]', formatARS(suggested + plan.tolls));

  // Comparativa súper (sugerida) vs premium.
  const fuelRows = qso('[data-fuel-rows]', root);
  if (fuelRows) {
    const delta = premium - suggested;
    fuelRows.innerHTML = `
      <div class="fuel-row suggested">
        <div class="fuel-row-name">${escapeHtml(fuelLabel(plan.car.suggestedFuel))} <span class="badge-green">sugerida</span></div>
        <div class="fuel-row-price">${formatARS(suggested)}</div>
      </div>
      <div class="fuel-row alt">
        <div class="fuel-row-name">${escapeHtml(fuelLabel(plan.costs[1]!.fuel))}</div>
        <div class="fuel-row-price">${formatARS(premium)} <span class="fuel-row-delta">+${formatARSCompact(delta)}</span></div>
      </div>`;
  }

  // Stat del precio elegido.
  const legs = legsWithStations(plan);
  setText(root, '[data-stat-price]', `${formatARSCompact(basis)}/L`);
  setText(
    root,
    '[data-stat-price-label]',
    legs.length > 0
      ? 'en tus estaciones elegidas'
      : plan.avgPriceEstimated
        ? 'promedio estimado del recorrido'
        : 'promedio en tu recorrido',
  );

  // Mejor / peor caso (según dónde cargues).
  const best = plan.liters * bestBasis(plan);
  const worst = plan.liters * worstBasis(plan);
  const rangeText =
    Math.round(worst) > Math.round(best)
      ? `Según dónde cargues: entre <b>${formatARS(best)}</b> y <b>${formatARS(worst)}</b>`
      : '';
  document.querySelectorAll<HTMLElement>('[data-range]').forEach((el) => {
    el.innerHTML = rangeText;
    el.hidden = rangeText === '';
  });

  // Subtítulo mobile.
  setText(root, '[data-m-sub]', `${fuelLabel(plan.car.suggestedFuel)} · con ${fuelLabel(plan.costs[1]!.fuel)} ${formatARS(premium)}`);
}

// ---- Peajes ----

function renderTolls(root: HTMLElement, plan: TripPlan): void {
  setText(root, '[data-tolls]', formatARS(plan.tolls));

  const box = qso('[data-tolls-breakdown]', root);
  if (!box) return;
  if (plan.tollBooths.length === 0) {
    box.hidden = false;
    box.innerHTML = `<div class="toll-note">No encontramos cabinas de peaje sobre esta ruta en nuestra base — la traza puede ir por un corredor sin peaje.</div>`;
    return;
  }
  box.hidden = false;
  const legs = plan.route.roundTrip ? 2 : 1;
  const rows = plan.tollBooths
    .map(
      (b) => `
        <div class="toll-row">
          <div class="toll-row-name">${escapeHtml(b.name)} <span class="toll-row-road">${escapeHtml(b.road)} · km ${b.kmFromStart}</span></div>
          <div class="toll-row-price">${formatARSCompact(b.price)}${legs > 1 ? ' <span class="toll-row-x">×2</span>' : ''}</div>
        </div>`,
    )
    .join('');
  const pay = /telepase/i.test(plan.tollsSource) ? 'TelePASE' : 'pago manual';
  const vig = plan.tollsUpdatedAt ? ` · vigencia ${plan.tollsUpdatedAt}` : '';
  const src = plan.tollsSource ? ` · ${escapeHtml(plan.tollsSource)}` : '';
  box.innerHTML = `
    <details class="tolls-details">
      <summary>Ver los ${plan.tollBooths.length} peajes del recorrido</summary>
      <div class="toll-list">${rows}</div>
      <div class="toll-note">Auto categoría 1 · ${pay}${vig}${src}. ${plan.route.roundTrip ? 'Ida y vuelta: cada cabina se paga dos veces.' : ''}</div>
    </details>`;
}

// ---- Mapa ----

/** Handles del mapa montado, para enfocar/actualizar estaciones desde las cards. */
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

// ---- Estaciones ----

function stationCard(s: Station, opts: { cheapest: boolean; legN?: number; chosen?: boolean }): string {
  const color = BRAND_COLORS[s.brandId] ?? { bg: '#4A5578', fg: '#fff', abbr: s.brandId.slice(0, 2).toUpperCase() };
  const badge = s.price.exact
    ? `<span class="badge-green">${priceStateLabel(s.price.source)}</span>`
    : `<span class="badge-muted">${priceStateLabel(s.price.source)}</span>`;
  const priceText = s.price.exact
    ? `${formatARSCompact(s.price.pricePerLiter)}/L`
    : `≈ ${formatARSCompact(s.price.pricePerLiter)}/L`;
  const flag = opts.cheapest ? `<div class="station-flag">★ MÁS BARATA DEL TRAYECTO</div>` : '';
  const seq = s.seq != null ? `<span class="station-seq">${escapeHtml(s.seq)}</span>` : '';
  const selectable = opts.legN != null;
  const radio = selectable
    ? `<span class="station-pick" aria-hidden="true">${opts.chosen ? '◉' : '○'}</span>`
    : '';
  const chosenTag = opts.chosen ? `<div class="station-chosen">✓ elegida para esta carga</div>` : '';
  const cls = [
    'station-card',
    opts.cheapest ? 'cheapest' : '',
    opts.chosen ? 'chosen' : '',
    selectable ? 'selectable' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const legAttr = selectable ? ` data-leg="${opts.legN}"` : '';
  const title = selectable ? 'Elegir esta estación para la carga' : 'Ver en el mapa';
  return `
    <div class="${cls}" data-station-id="${s.id}"${legAttr} role="button" tabindex="0" title="${title}">
      ${flag}
      <div class="station-brand">${seq}${radio}<span class="brand-logo" style="background:${color.bg};color:${color.fg}">${color.abbr}</span><span class="station-name">${escapeHtml(s.brand)}</span></div>
      <div class="station-body">
        <div class="station-place">${escapeHtml(s.place)} · km ${s.kmFromStart}</div>
        <div class="station-price">${priceText} ${badge}</div>
      </div>
      ${chosenTag}
    </div>`;
}

/** Título de sección de una carga: "1ª carga · cerca del km 616 del viaje". */
function legTitle(n: number, targetTripKm: number): string {
  return `${n}ª carga <span class="stations-group-hint">· cerca del km ${targetTripKm} del viaje · tocá para elegir</span>`;
}


function renderStations(root: HTMLElement, plan: TripPlan): void {
  const container = qso('[data-stations]', root);
  if (!container) return;

  renderStationGroups(container, plan);

  // Click en una card: si es de una carga, la elige; siempre la enfoca en el mapa.
  container.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-station-id]');
    if (!card) return;
    const id = card.dataset.stationId!;
    const legN = card.dataset.leg ? Number(card.dataset.leg) : null;
    if (legN != null) {
      selectStation(container, plan, legN, id);
    } else {
      container.querySelectorAll('.station-card.active').forEach((c) => c.classList.remove('active'));
      card.classList.add('active');
    }
    focusStationOnMap(id);
  });
}

/** (Re)pinta los grupos de estaciones con la selección actual. */
function renderStationGroups(container: HTMLElement, plan: TripPlan): void {
  if (plan.stations.length === 0) {
    container.innerHTML = `<div class="stations-empty">No encontramos estaciones sobre esta ruta en nuestros datos. Cargá con el tanque lleno antes de salir.</div>`;
    return;
  }

  // La más barata de todo el trayecto conserva su estrella, esté donde esté.
  const cheapestId = plan.stations[0]!.id;
  const groups: string[] = [];

  for (const leg of plan.refuelLegs) {
    let cards: string;
    if (leg.stations.length > 0) {
      const chosen = chosenStation(leg, selectedByLeg);
      cards = `<div class="stations-grid">${leg.stations
        .map((s) => stationCard(s, { cheapest: s.id === cheapestId, legN: leg.n, chosen: s.id === chosen?.id }))
        .join('')}</div>`;
    } else {
      cards = `<div class="stations-empty">Sin estaciones en la ventana de esta carga — conviene cargar en la anterior o apenas después.</div>`;
    }
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
        .map((s) => stationCard(s, { cheapest: s.id === cheapestId }))
        .join('')}</div></div>`,
    );
  }

  container.innerHTML = groups.join('');
}

/** Elige una estación para una carga: renumera, recalcula precio y refresca mapa. */
function selectStation(container: HTMLElement, plan: TripPlan, legN: number, stationId: string): void {
  const leg = plan.refuelLegs.find((l) => l.n === legN);
  if (!leg || !leg.stations.some((s) => s.id === stationId)) return;

  selectedByLeg.set(legN, stationId);
  relabelLeg(leg, stationId);

  // Actualiza los pines de esta carga en el mapa (icono + popup).
  if (mapHandles) {
    for (const s of leg.stations) refreshStationMarker(mapHandles, s);
  }

  // Recalcula importes y repinta las cards con la nueva elegida.
  const root = qs('[data-resultado]');
  updateCosts(root, plan);
  renderStationGroups(container, plan);
}

// ---- Navegación al celular (Google Maps, recorrido completo) ----

/** Setea el href del link "Abrir en Google Maps" (visible en mobile). */
function wireNavLinks(root: HTMLElement, plan: TripPlan): void {
  qso<HTMLAnchorElement>('[data-open-maps]', root)?.setAttribute('href', googleMapsUrl(plan));
}

/** Genera el QR de Google Maps para escanear desde la compu. */
async function renderNavQr(root: HTMLElement, plan: TripPlan): Promise<void> {
  const box = qso('[data-qr]', root);
  const mapsImg = qso<HTMLImageElement>('[data-qr-maps-img]', root);
  if (!box || !mapsImg) return;
  try {
    mapsImg.src = await mapsQrDataUrl(plan);
    box.removeAttribute('hidden');
  } catch {
    // Si falla la generación, dejamos el bloque oculto (no es crítico).
  }
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
