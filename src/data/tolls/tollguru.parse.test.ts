import { describe, expect, it } from 'vitest';
import { parseTollguru, encodePolyline, type ParseCtx } from './tollguru.service';

const ctx: ParseCtx = { roundTrip: false, kmAt: () => 0, now: '2026-07' };

describe('parseTollguru', () => {
  const sample = {
    route: {
      costs: { tag: 15757, cash: 15800 },
      tolls: [
        // desordenadas a propósito; con distancia de llegada en metros
        { name: 'Maipú', road: 'RP2', latitude: -36.81, longitude: -57.83, tagCost: 7856.8, cashCost: 7900, arrival: { distance: 208000 } },
        { name: 'Samborombón', road: 'RP2', lat: -35.57, lng: -57.89, tagCost: 7856.8, cashCost: 7900, arrival: { distance: 99000 } },
      ],
    },
  };

  it('usa el precio TelePASE (tag) y marca la fuente', () => {
    const est = parseTollguru(sample, ctx);
    expect(est.source).toMatch(/TelePASE/);
    expect(est.booths[0]!.price).toBe(7856.8); // tag, no cash
    expect(est.updatedAt).toBe('2026-07');
  });

  it('ordena las cabinas por km (de la distancia de llegada)', () => {
    const est = parseTollguru(sample, ctx);
    expect(est.booths.map((b) => b.name)).toEqual(['Samborombón', 'Maipú']);
    expect(est.booths[0]!.kmFromStart).toBe(99);
    expect(est.booths[1]!.kmFromStart).toBe(208);
  });

  it('toma el total con tag y lo duplica en ida y vuelta', () => {
    expect(parseTollguru(sample, ctx).total).toBe(15757);
    expect(parseTollguru(sample, { ...ctx, roundTrip: true }).total).toBe(31514);
  });

  it('cae a efectivo cuando no hay tag (por cabina y total)', () => {
    const noTag = { route: { costs: { cash: 3700 }, tolls: [{ name: 'X', cashCost: 3700, lat: -37, lng: -57 }] } };
    const est = parseTollguru(noTag, ctx);
    expect(est.booths[0]!.price).toBe(3700);
    expect(est.total).toBe(3700);
  });

  it('sin costs suma las tarifas de las cabinas', () => {
    const noCosts = { route: { tolls: [{ name: 'A', tagCost: 1000, lat: 0, lng: 0 }, { name: 'B', tagCost: 2000, lat: 0, lng: 0 }] } };
    expect(parseTollguru(noCosts, ctx).total).toBe(3000);
  });

  it('usa kmAt cuando la cabina no trae distancia', () => {
    const noDist = { route: { tolls: [{ name: 'A', tagCost: 1000, lat: -34, lng: -58 }] } };
    const est = parseTollguru(noDist, { ...ctx, kmAt: () => 42 });
    expect(est.booths[0]!.kmFromStart).toBe(42);
  });

  it('respuesta vacía / rara no rompe', () => {
    expect(parseTollguru({}, ctx).booths).toHaveLength(0);
    expect(parseTollguru({}, ctx).total).toBe(0);
  });
});

describe('encodePolyline', () => {
  it('coincide con el ejemplo canónico de Google', () => {
    const pts = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(pts, 5)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  });
});
