/**
 * Estado del viaje compartido entre páginas, persistido en localStorage.
 *
 * El selector guarda el auto elegido; el inicio guarda origen/destino/paradas;
 * el resultado lee todo y planifica. Es la única pieza de estado global y es
 * serializable (sólo ids + flags), no objetos de dominio.
 */

import type { CarSelection, TripInput } from './tripPlanner';

const KEY = 'kmxkm.trip.v1';
const SAVED_KEY = 'kmxkm.saved.v1';

/** Un viaje guardado por el usuario ("Mis viajes"). */
export interface SavedTrip {
  id: string;
  savedAt: number;
  /** Resumen para la lista (evita recalcular al pintar). */
  title: string;
  subtitle: string;
  trip: TripInput;
}

/** Viaje por defecto (el ejemplo de la maqueta) para primer arranque / demo. */
export const DEFAULT_TRIP: TripInput = {
  originId: 'buenos-aires',
  destinationId: 'mar-del-plata',
  stops: [{ placeId: 'necochea', onReturn: true }],
  roundTrip: true,
  car: { kind: 'catalog', carId: 'fiat-cronos-1-3-2022' },
  advanced: {},
};

/** Migra el formato viejo (stopIds: string[]) al nuevo (stops con onReturn). */
function readStops(parsed: Record<string, unknown>): TripInput['stops'] {
  if (Array.isArray(parsed.stops)) return parsed.stops as TripInput['stops'];
  if (Array.isArray(parsed.stopIds)) {
    return (parsed.stopIds as string[]).map((placeId) => ({ placeId, onReturn: true }));
  }
  return DEFAULT_TRIP.stops.map((s) => ({ ...s }));
}

function read(): TripInput {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_TRIP };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      originId: (parsed.originId as string) ?? DEFAULT_TRIP.originId,
      destinationId: (parsed.destinationId as string) ?? DEFAULT_TRIP.destinationId,
      stops: readStops(parsed),
      roundTrip: (parsed.roundTrip as boolean) ?? DEFAULT_TRIP.roundTrip,
      car: (parsed.car as TripInput['car']) ?? { ...DEFAULT_TRIP.car },
      advanced: (parsed.advanced as TripInput['advanced']) ?? {},
    };
  } catch {
    return { ...DEFAULT_TRIP };
  }
}

function write(trip: TripInput): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(trip));
  } catch {
    // Modo privado / storage lleno: seguimos en memoria dentro de la sesión.
  }
}

export const tripStore = {
  get(): TripInput {
    return read();
  },

  set(trip: TripInput): void {
    write(trip);
  },

  update(patch: Partial<TripInput>): TripInput {
    const next = { ...read(), ...patch };
    write(next);
    return next;
  },

  setCar(car: CarSelection): TripInput {
    return this.update({ car });
  },

  reset(): void {
    write({ ...DEFAULT_TRIP });
  },

  // ---- Mis viajes (lista de guardados) ----

  listSaved(): SavedTrip[] {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw) as SavedTrip[];
      return Array.isArray(arr) ? arr.sort((a, b) => b.savedAt - a.savedAt) : [];
    } catch {
      return [];
    }
  },

  save(entry: Omit<SavedTrip, 'id' | 'savedAt'>): SavedTrip {
    const saved: SavedTrip = { ...entry, id: `t${Date.now()}`, savedAt: Date.now() };
    const list = this.listSaved().filter(
      // Deduplica por viaje idéntico (mismo origen/destino/paradas/auto).
      (s) => JSON.stringify(s.trip) !== JSON.stringify(entry.trip),
    );
    list.unshift(saved);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 50)));
    } catch {
      // sin storage: no persiste, no rompe
    }
    return saved;
  },

  removeSaved(id: string): void {
    const list = this.listSaved().filter((s) => s.id !== id);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    } catch {
      // idem
    }
  },

  /** Carga un viaje guardado como viaje activo. */
  loadSaved(id: string): TripInput | null {
    const found = this.listSaved().find((s) => s.id === id);
    if (!found) return null;
    write(found.trip);
    return found.trip;
  },
};
