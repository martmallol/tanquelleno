/**
 * Estado del viaje compartido entre páginas, persistido en localStorage.
 *
 * El selector guarda el auto elegido; el inicio guarda origen/destino/paradas;
 * el resultado lee todo y planifica. Es la única pieza de estado global y es
 * serializable (sólo ids + flags), no objetos de dominio.
 */

import type { CarSelection, TripInput } from './tripPlanner';

const KEY = 'kmxkm.trip.v1';

/** Viaje por defecto (el ejemplo de la maqueta) para primer arranque / demo. */
export const DEFAULT_TRIP: TripInput = {
  originId: 'buenos-aires',
  destinationId: 'mar-del-plata',
  stopIds: ['necochea'],
  roundTrip: true,
  car: { kind: 'catalog', carId: 'fiat-cronos-1-3-2022' },
};

function read(): TripInput {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_TRIP };
    const parsed = JSON.parse(raw) as Partial<TripInput>;
    return {
      originId: parsed.originId ?? DEFAULT_TRIP.originId,
      destinationId: parsed.destinationId ?? DEFAULT_TRIP.destinationId,
      stopIds: Array.isArray(parsed.stopIds) ? parsed.stopIds : [...DEFAULT_TRIP.stopIds],
      roundTrip: parsed.roundTrip ?? DEFAULT_TRIP.roundTrip,
      car: parsed.car ?? { ...DEFAULT_TRIP.car },
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
};
