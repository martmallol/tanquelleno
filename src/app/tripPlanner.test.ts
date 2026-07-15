import { describe, expect, it } from 'vitest';
import { planTrip, loadFactor, TripPlanningError, type TripInput } from './tripPlanner';
import { mockServices } from '../data/mock';
import { CARS } from '../data/mock/cars.data';

describe('loadFactor (corrección de consumo por carga)', () => {
  it('sin ajustes es 1', () => {
    expect(loadFactor(undefined)).toBe(1);
    expect(loadFactor({})).toBe(1);
    expect(loadFactor({ passengers: 1 })).toBe(1);
  });

  it('cada pasajero extra suma ~2.5%', () => {
    expect(loadFactor({ passengers: 3 })).toBeCloseTo(1.05); // 2 extra
  });

  it('equipaje y A/C suman', () => {
    expect(loadFactor({ heavyLoad: true })).toBeCloseTo(1.04);
    expect(loadFactor({ airConditioning: true })).toBeCloseTo(1.06);
    expect(loadFactor({ passengers: 2, heavyLoad: true, airConditioning: true })).toBeCloseTo(1.125);
  });

  it('tiene un techo de +25%', () => {
    expect(loadFactor({ passengers: 9, heavyLoad: true, airConditioning: true })).toBe(1.25);
  });
});

describe('planTrip aplica ajustes avanzados', () => {
  it('sube los litros con auto cargado', async () => {
    const base = await planTrip(mockServices, exampleTrip);
    const loaded = await planTrip(mockServices, {
      ...exampleTrip,
      advanced: { passengers: 5, heavyLoad: true, airConditioning: true },
    });
    expect(loaded.liters).toBeGreaterThan(base.liters);
    expect(loaded.car.loadAdjusted).toBe(true);
  });

  it('consumo manual pisa el del catálogo', async () => {
    const plan = await planTrip(mockServices, {
      ...exampleTrip,
      advanced: { consumptionLper100: 12 },
    });
    expect(plan.car.manualConsumption).toBe(true);
    expect(plan.car.consumptionLper100).toBe(12);
  });
});

const exampleTrip: TripInput = {
  originId: 'buenos-aires',
  destinationId: 'mar-del-plata',
  stops: [{ placeId: 'necochea', onReturn: true }],
  roundTrip: true,
  car: { kind: 'catalog', carId: 'fiat-cronos-1-3-2022' },
};

describe('planTrip (integración con mocks)', () => {
  it('el auto de ejemplo existe en el catálogo', () => {
    expect(CARS.some((c) => c.id === 'fiat-cronos-1-3-2022')).toBe(true);
  });

  it('planifica el viaje de ejemplo con datos coherentes', async () => {
    const plan = await planTrip(mockServices, exampleTrip);

    expect(plan.route.waypoints.map((w) => w.name)).toEqual([
      'Buenos Aires',
      'Necochea',
      'Mar del Plata',
    ]);
    expect(plan.route.roundTrip).toBe(true);
    // ida y vuelta duplica: total > una pasada
    expect(plan.totalDistanceKm).toBeGreaterThan(plan.route.distanceKm);
    expect(plan.liters).toBeGreaterThan(0);
    expect(plan.rangeKm).toBeGreaterThan(0);
    expect(plan.refuelStops).toBeGreaterThanOrEqual(0);
    expect(plan.costs).toHaveLength(2);
    expect(plan.costs[0]!.fuel).toBe('super'); // sugerida del Cronos
    expect(plan.costs[0]!.totalCost).toBeGreaterThan(0);
    expect(plan.tolls).toBeGreaterThan(0);
  });

  it('encuentra estaciones sobre el corredor a la costa', async () => {
    const plan = await planTrip(mockServices, exampleTrip);
    expect(plan.stations.length).toBeGreaterThan(0);
    // deben estar ordenadas por precio ascendente
    for (let i = 1; i < plan.stations.length; i++) {
      expect(plan.stations[i]!.price.pricePerLiter).toBeGreaterThanOrEqual(
        plan.stations[i - 1]!.price.pricePerLiter,
      );
    }
  });

  it('mezcla estaciones con precio exacto y estimado', async () => {
    const plan = await planTrip(mockServices, exampleTrip);
    const sources = new Set(plan.stations.map((s) => s.price.source));
    // El corredor incluye Ayacucho (exacto) y Necochea (sin dato → provincial)
    expect(sources.has('station')).toBe(true);
    expect(sources.has('province')).toBe(true);
  });

  it('fallback por categoría: consumo estimado', async () => {
    const plan = await planTrip(mockServices, {
      ...exampleTrip,
      car: { kind: 'category', category: 'suv' },
    });
    expect(plan.car.carId).toBeNull();
    expect(plan.car.estimatedConsumption).toBe(true);
    expect(plan.car.label).toContain('SUV');
  });

  it('solo ida no duplica la distancia', async () => {
    const round = await planTrip(mockServices, exampleTrip);
    const oneWay = await planTrip(mockServices, { ...exampleTrip, roundTrip: false });
    expect(oneWay.totalDistanceKm).toBeLessThan(round.totalDistanceKm);
  });

  it('parada solo-ida da una ruta más corta que la misma ida y vuelta', async () => {
    // Necochea solo a la ida: la vuelta va directa Mar del Plata → Buenos Aires,
    // sin desviarse por Necochea → menos km que si volviera pasando por ahí.
    const symmetric = await planTrip(mockServices, {
      ...exampleTrip,
      stops: [{ placeId: 'necochea', onReturn: true }],
    });
    const oneWayStop = await planTrip(mockServices, {
      ...exampleTrip,
      stops: [{ placeId: 'necochea', onReturn: false }],
    });
    expect(oneWayStop.totalDistanceKm).toBeLessThan(symmetric.totalDistanceKm);
    // Igual sigue siendo ida y vuelta (vuelve al origen).
    expect(oneWayStop.route.waypoints[0]!.id).toBe(oneWayStop.route.waypoints.at(-1)!.id);
  });

  it('auto inexistente lanza TripPlanningError', async () => {
    await expect(
      planTrip(mockServices, { ...exampleTrip, car: { kind: 'catalog', carId: 'no-existe' } }),
    ).rejects.toBeInstanceOf(TripPlanningError);
  });

  it('destino inexistente lanza TripPlanningError', async () => {
    await expect(
      planTrip(mockServices, { ...exampleTrip, destinationId: 'atlantis' }),
    ).rejects.toBeInstanceOf(TripPlanningError);
  });
});
