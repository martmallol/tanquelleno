import { describe, expect, it } from 'vitest';
import { planTrip, TripPlanningError, type TripInput } from './tripPlanner';
import { mockServices } from '../data/mock';
import { CARS } from '../data/mock/cars.data';

const exampleTrip: TripInput = {
  originId: 'buenos-aires',
  destinationId: 'mar-del-plata',
  stopIds: ['necochea'],
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
