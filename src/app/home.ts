/**
 * Controlador de la pantalla de inicio (index.html).
 *
 * Deja editar origen / destino / paradas (con autocomplete de ciudades),
 * refleja el auto elegido en el store, controla el toggle "ida y vuelta" y,
 * al calcular, persiste el TripInput y navega al resultado.
 */

import { services } from '../data/provider';
import type { Place } from '../domain/types';
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
  let stopIds = [...trip.stopIds];
  let roundTrip = trip.roundTrip;

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

  // ---- Agregar / quitar paradas ----
  stopsWrap.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const removeBtn = target.closest<HTMLElement>('[data-remove-stop]');
    if (removeBtn) {
      const id = removeBtn.dataset.removeStop!;
      stopIds = stopIds.filter((s) => s !== id);
      void renderStops();
      persist();
      return;
    }
    const addBtn = target.closest<HTMLElement>('[data-add-stop]');
    if (addBtn) {
      openStopPicker(addBtn);
    }
  });

  // ---- Calcular ----
  calcButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Persistimos antes de navegar (href="resultado.html" completa el salto).
      persist();
    });
  });

  // ---------------------------------------------------------------

  function persist(): void {
    tripStore.set({ originId, destinationId, stopIds, roundTrip, car: tripStore.get().car });
  }

  function renderRoundTrip(): void {
    toggle.classList.toggle('on', roundTrip);
    toggle.setAttribute('aria-checked', String(roundTrip));
  }

  async function renderStops(): Promise<void> {
    const places = (await Promise.all(stopIds.map((id) => services.directions.getPlaceById(id)))).filter(
      (p): p is Place => p !== null,
    );
    const chips = places
      .map(
        (p) =>
          `<span class="chip-soft">parada: ${escapeHtml(p.name)} <span data-remove-stop="${p.id}" style="cursor:pointer" role="button" aria-label="Quitar parada">✕</span></span>`,
      )
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
      if (!stopIds.includes(place.id) && place.id !== originId && place.id !== destinationId) {
        stopIds.push(place.id);
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
