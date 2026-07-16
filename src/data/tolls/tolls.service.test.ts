import { describe, expect, it } from 'vitest';
import { curatedTolls } from './tolls.service';
import { TOLLS, TOLLS_UPDATED_AT } from './tolls.data';
import { buildGeometry } from '../../domain/geo';
import type { Route } from '../../domain/types';

/** Ruta cuya geometría pasa por las plazas de la Autovía 2 (RP2). */
function coastRoute(roundTrip: boolean): Route {
  const samborombon = TOLLS.find((t) => t.id === 'rp2-samborombon')!;
  const maipu = TOLLS.find((t) => t.id === 'rp2-maipu')!;
  const waypoints = [
    { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
    { lat: samborombon.lat, lng: samborombon.lng },
    { lat: maipu.lat, lng: maipu.lng },
    { lat: -38.0055, lng: -57.5426 }, // Mar del Plata
  ];
  return {
    waypoints: [],
    distanceKm: 400,
    geometry: buildGeometry(waypoints),
    roundTrip,
  } as unknown as Route;
}

describe('curatedTolls.tollsForRoute', () => {
  it('encuentra las cabinas de la RP2 sobre el corredor a la costa', async () => {
    const est = await curatedTolls.tollsForRoute(coastRoute(false));
    const ids = est.booths.map((b) => b.id);
    expect(ids).toContain('rp2-samborombon');
    expect(ids).toContain('rp2-maipu');
  });

  it('ordena las cabinas por km del viaje', async () => {
    const est = await curatedTolls.tollsForRoute(coastRoute(false));
    for (let i = 1; i < est.booths.length; i++) {
      expect(est.booths[i]!.kmFromStart).toBeGreaterThanOrEqual(est.booths[i - 1]!.kmFromStart);
    }
  });

  it('suma las tarifas de las cabinas (una pasada en solo ida)', async () => {
    const est = await curatedTolls.tollsForRoute(coastRoute(false));
    const sum = est.booths.reduce((a, b) => a + b.price, 0);
    expect(est.total).toBe(sum);
    expect(est.total).toBeGreaterThan(0);
  });

  it('ida y vuelta duplica el total (cada cabina se paga dos veces)', async () => {
    const oneWay = await curatedTolls.tollsForRoute(coastRoute(false));
    const round = await curatedTolls.tollsForRoute(coastRoute(true));
    expect(round.total).toBe(oneWay.total * 2);
    // el desglose sigue listando una pasada
    expect(round.booths.length).toBe(oneWay.booths.length);
  });

  it('reporta la vigencia de las tarifas', async () => {
    const est = await curatedTolls.tollsForRoute(coastRoute(false));
    expect(est.updatedAt).toBe(TOLLS_UPDATED_AT);
  });

  it('una ruta lejos de cualquier cabina no suma peajes', async () => {
    // Un tramo corto en plena Patagonia, lejos de las plazas del dataset.
    const route = {
      waypoints: [],
      distanceKm: 50,
      geometry: buildGeometry([
        { lat: -45.8641, lng: -67.4966 },
        { lat: -45.9, lng: -67.6 },
      ]),
      roundTrip: false,
    } as unknown as Route;
    const est = await curatedTolls.tollsForRoute(route);
    expect(est.booths).toHaveLength(0);
    expect(est.total).toBe(0);
  });
});
