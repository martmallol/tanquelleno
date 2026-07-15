/**
 * Controlador de la pantalla de inicio (index.html).
 *
 * Deja editar origen / destino / paradas (con autocomplete de ciudades),
 * refleja el auto elegido en el store, controla el toggle "ida y vuelta" y,
 * al calcular, persiste el TripInput y navega al resultado.
 */

import { services } from '../data/provider';
import type { Place } from '../domain/types';
import type { TripStop } from './tripPlanner';
import { qs, qso, escapeHtml } from './dom';
import { tripStore } from './tripStore';

export async function initHome(): Promise<void> {
  const trip = tripStore.get();

  const originValue = qs('[data-origin-value]');
  const destValue = qs('[data-dest-value]');
  const stopsWrap = qs('[data-stops]');
  const carValue = qs('[data-car-value]');
  const carHint = qso('[data-car-hint]');
  const toggle = qs('[data-roundtrip]');
  const calcButtons = document.querySelectorAll<HTMLAnchorElement>('[data-calc]');

  // Estado local editable (arranca del store).
  let originId = trip.originId;
  let destinationId = trip.destinationId;
  let stops: TripStop[] = trip.stops.map((s) => ({ ...s }));
  let roundTrip = trip.roundTrip;
  let advanced = { ...(trip.advanced ?? {}) };

  // ---- Pintar valores actuales ----
  const [origin, destination] = await Promise.all([
    services.directions.getPlaceById(originId),
    services.directions.getPlaceById(destinationId),
  ]);
  if (origin) originValue.textContent = origin.name;
  if (destination) destValue.textContent = destination.name;
  await renderStops();
  renderRoundTrip();
  await renderCar();

  // ---- Edición de origen / destino con autocomplete ----
  attachPlacePicker(originValue, async (place) => {
    originId = place.id;
    originValue.textContent = place.name;
    persist();
  });
  attachPlacePicker(destValue, async (place) => {
    destinationId = place.id;
    destValue.textContent = place.name;
    persist();
  });

  // ---- Toggle ida y vuelta ----
  const flip = (): void => {
    roundTrip = !roundTrip;
    renderRoundTrip();
    persist();
  };
  toggle.addEventListener('click', flip);
  toggle.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flip();
    }
  });

  // ---- Agregar / quitar / reordenar paradas + toggle ida/vuelta ----
  stopsWrap.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const removeBtn = target.closest<HTMLElement>('[data-remove-stop]');
    if (removeBtn) {
      const id = removeBtn.dataset.removeStop!;
      stops = stops.filter((s) => s.placeId !== id);
      void renderStops();
      persist();
      return;
    }

    const moveBtn = target.closest<HTMLElement>('[data-move-stop]');
    if (moveBtn) {
      const id = moveBtn.dataset.moveStop!;
      const dir = Number(moveBtn.dataset.dir);
      const i = stops.findIndex((s) => s.placeId === id);
      const j = i + dir;
      if (i !== -1 && j >= 0 && j < stops.length) {
        [stops[i], stops[j]] = [stops[j]!, stops[i]!];
        void renderStops();
        persist();
      }
      return;
    }

    const retBtn = target.closest<HTMLElement>('[data-toggle-return]');
    if (retBtn) {
      const id = retBtn.dataset.toggleReturn!;
      const stop = stops.find((s) => s.placeId === id);
      if (stop) {
        stop.onReturn = !stop.onReturn;
        void renderStops();
        persist();
      }
      return;
    }

    const addBtn = target.closest<HTMLElement>('[data-add-stop]');
    if (addBtn) {
      openStopPicker(addBtn);
    }
  });

  // ---- Ajustes avanzados (pasajeros, carga, A/C, consumo experto) ----
  const advToggle = qso('[data-advanced-toggle]');
  const advPanel = qso('[data-advanced-panel]');
  const advConsumo = qso<HTMLInputElement>('[data-adv-consumo]');
  const advLoad = qso<HTMLInputElement>('[data-adv-load]');
  const advAc = qso<HTMLInputElement>('[data-adv-ac]');
  const paxVal = qso('[data-adv-passengers]');
  const paxStepper = qso('[data-stepper="passengers"]');

  if (advToggle && advPanel) {
    let passengers = advanced.passengers ?? 1;

    const renderPax = (): void => {
      if (paxVal) paxVal.textContent = String(passengers);
    };
    renderPax();

    // Reflejar valores persistidos
    if (advConsumo && advanced.consumptionLper100 != null) advConsumo.value = String(advanced.consumptionLper100);
    if (advLoad) advLoad.checked = !!advanced.heavyLoad;
    if (advAc) advAc.checked = !!advanced.airConditioning;

    const hasValues =
      (advanced.passengers ?? 1) > 1 ||
      advanced.heavyLoad ||
      advanced.airConditioning ||
      advanced.consumptionLper100 != null;
    if (hasValues) openAdvanced(true);

    advToggle.addEventListener('click', () => openAdvanced(advPanel.hidden));

    paxStepper?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-step]');
      if (!btn) return;
      passengers = Math.max(1, Math.min(9, passengers + Number(btn.dataset.step)));
      renderPax();
      advanced = { ...advanced, passengers };
      persist();
    });

    advLoad?.addEventListener('change', () => {
      advanced = { ...advanced, heavyLoad: advLoad.checked };
      persist();
    });
    advAc?.addEventListener('change', () => {
      advanced = { ...advanced, airConditioning: advAc.checked };
      persist();
    });
    advConsumo?.addEventListener('input', () => {
      const n = Number.parseFloat(advConsumo.value.replace(',', '.'));
      advanced = { ...advanced, consumptionLper100: Number.isFinite(n) && n > 0 ? n : null };
      persist();
    });
  }

  function openAdvanced(open: boolean): void {
    if (!advPanel || !advToggle) return;
    advPanel.hidden = !open;
    advToggle.setAttribute('aria-expanded', String(open));
    advToggle.textContent = `Ajustes avanzados (pasajeros, carga, A/C) ${open ? '▴' : '▾'}`;
  }

  // ---- Calcular ----
  calcButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Persistimos antes de navegar (href="resultado.html" completa el salto).
      persist();
    });
  });

  // ---------------------------------------------------------------

  function persist(): void {
    tripStore.set({ originId, destinationId, stops, roundTrip, advanced, car: tripStore.get().car });
  }

  function renderRoundTrip(): void {
    toggle.classList.toggle('on', roundTrip);
    toggle.setAttribute('aria-checked', String(roundTrip));
    // Los controles "solo ida / también a la vuelta" solo aplican si el viaje
    // es ida y vuelta; re-renderizamos las paradas para reflejarlo.
    void renderStops();
  }

  async function renderStops(): Promise<void> {
    const resolved = (
      await Promise.all(
        stops.map(async (s) => {
          const place = await services.directions.getPlaceById(s.placeId);
          return place ? { place, onReturn: s.onReturn } : null;
        }),
      )
    ).filter((x): x is { place: Place; onReturn: boolean } => x !== null);

    const chips = resolved
      .map(({ place, onReturn }, i) => {
        const id = place.id;
        const left =
          i > 0
            ? `<span class="stop-move" data-move-stop="${id}" data-dir="-1" role="button" aria-label="Mover antes" title="Mover antes">‹</span>`
            : '';
        const right =
          i < resolved.length - 1
            ? `<span class="stop-move" data-move-stop="${id}" data-dir="1" role="button" aria-label="Mover después" title="Mover después">›</span>`
            : '';
        // Solo mostramos el toggle ida/vuelta cuando el viaje es ida y vuelta.
        const returnBtn = roundTrip
          ? `<span class="stop-return ${onReturn ? 'on' : ''}" data-toggle-return="${id}" role="button" tabindex="0" title="${onReturn ? 'Se pasa a la ida y a la vuelta' : 'Solo a la ida'}">${onReturn ? '↔ ida y vuelta' : '→ solo ida'}</span>`
          : '';
        return `<span class="chip-soft chip-stop">${left}parada ${i + 1}: ${escapeHtml(place.name)}${right} ${returnBtn} <span data-remove-stop="${id}" style="cursor:pointer" role="button" aria-label="Quitar parada">✕</span></span>`;
      })
      .join('');
    stopsWrap.innerHTML = `${chips}<span class="link-accent" data-add-stop role="button" tabindex="0">+ agregar parada</span>`;
  }

  async function renderCar(): Promise<void> {
    const car = tripStore.get().car;
    if (car.kind === 'catalog') {
      const c = await services.cars.getCarById(car.carId);
      if (c) {
        carValue.textContent = `${c.brand} ${c.model} ${c.version}`;
        if (carHint) carHint.textContent = `${c.year} · deducimos consumo y nafta`;
        return;
      }
    }
    const profiles = await services.cars.categoryProfiles();
    const profile = car.kind === 'category' ? profiles.find((p) => p.category === car.category) : undefined;
    carValue.textContent = profile ? `${profile.label} (promedio)` : 'Elegí tu auto';
    if (carHint) carHint.textContent = profile ? 'consumo estimado por categoría' : 'tocá para elegir';
  }

  // ---- Autocomplete de lugares ----

  function attachPlacePicker(anchor: HTMLElement, onPick: (p: Place) => void): void {
    anchor.style.cursor = 'pointer';
    anchor.addEventListener('click', () => openPlacePicker(anchor, onPick));
  }

  function openPlacePicker(anchor: HTMLElement, onPick: (p: Place) => void): void {
    closeAnyPicker();
    const box = document.createElement('div');
    box.className = 'place-picker';
    box.dataset.picker = 'true';
    box.innerHTML = `<input class="place-picker-input" type="search" placeholder="Buscá una ciudad…" autocomplete="off"><div class="place-picker-list"></div>`;
    const rect = anchor.getBoundingClientRect();
    box.style.top = `${rect.bottom + window.scrollY + 6}px`;
    box.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(box);

    const input = box.querySelector<HTMLInputElement>('.place-picker-input')!;
    const list = box.querySelector<HTMLDivElement>('.place-picker-list')!;
    input.focus();

    let timer: number | undefined;
    input.addEventListener('input', () => {
      window.clearTimeout(timer);
      // 350ms: cortesía con el rate limit de Nominatim (1 req/s) en modo live.
      timer = window.setTimeout(async () => {
        const results = await services.directions.searchPlaces(input.value).catch(() => []);
        list.innerHTML = results
          .map(
            (p) =>
              `<div class="place-picker-item" data-place="${p.id}">${escapeHtml(p.name)} <span>${escapeHtml(p.province)}</span></div>`,
          )
          .join('');
      }, 350);
    });

    list.addEventListener('click', async (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('[data-place]');
      if (!item) return;
      const place = await services.directions.getPlaceById(item.dataset.place!);
      if (place) onPick(place);
      closeAnyPicker();
    });

    setTimeout(() => document.addEventListener('click', outsideClose), 0);
    function outsideClose(e: MouseEvent): void {
      if (!box.contains(e.target as Node) && e.target !== anchor) closeAnyPicker();
    }
    (box as unknown as { _cleanup: () => void })._cleanup = () =>
      document.removeEventListener('click', outsideClose);
  }

  function openStopPicker(anchor: HTMLElement): void {
    openPlacePicker(anchor, (place) => {
      const already = stops.some((s) => s.placeId === place.id);
      if (!already && place.id !== originId && place.id !== destinationId) {
        // Nueva parada por defecto se hace también a la vuelta (lo más común).
        stops.push({ placeId: place.id, onReturn: true });
        void renderStops();
        persist();
      }
    });
  }

  function closeAnyPicker(): void {
    const existing = document.querySelector('[data-picker]');
    if (existing) {
      (existing as unknown as { _cleanup?: () => void })._cleanup?.();
      existing.remove();
    }
  }
}
