import { describe, expect, it } from 'vitest';
import {
  legsWithStations,
  chosenStation,
  currentBasis,
  bestBasis,
  worstBasis,
  relabelLeg,
} from './stationChoice';
import type { FuelPrice, RefuelLeg, Station, TripPlan } from './types';

function station(id: string, price: number): Station {
  const fp: FuelPrice = { fuel: 'super', pricePerLiter: price, source: 'station', exact: true };
  return {
    id,
    brand: 'YPF',
    brandId: 'ypf',
    place: 'x',
    provinceId: 'x',
    kmFromStart: 100,
    coord: { lat: 0, lng: 0 },
    price: fp,
  };
}

function planWith(legs: RefuelLeg[], avgPricePerLiter = 1500, stations: Station[] = []): TripPlan {
  return {
    route: { waypoints: [], distanceKm: 0, geometry: [], roundTrip: false },
    car: {} as TripPlan['car'],
    totalDistanceKm: 1000,
    liters: 100,
    avgPricePerLiter,
    avgPriceEstimated: false,
    rangeKm: 500,
    refuelStops: legs.length,
    costs: [],
    stations,
    refuelLegs: legs,
    extraStations: [],
    tolls: 0,
    tollBooths: [],
    tollsUpdatedAt: '',
    tollsSource: '',
  };
}

describe('stationChoice', () => {
  it('la elegida por defecto es la más barata de la carga', () => {
    const leg: RefuelLeg = { n: 1, targetTripKm: 300, stations: [station('a', 1600), station('b', 1700)] };
    const sel = new Map<number, string>();
    expect(chosenStation(leg, sel)!.id).toBe('a');
  });

  it('elegir otra estación cambia la elegida', () => {
    const leg: RefuelLeg = { n: 1, targetTripKm: 300, stations: [station('a', 1600), station('b', 1700)] };
    const sel = new Map<number, string>([[1, 'b']]);
    expect(chosenStation(leg, sel)!.id).toBe('b');
  });

  it('el precio base sube al elegir una estación más cara', () => {
    const leg: RefuelLeg = { n: 1, targetTripKm: 300, stations: [station('a', 1600), station('b', 1800)] };
    const plan = planWith([leg]);
    const sel = new Map<number, string>();
    expect(currentBasis(plan, sel)).toBe(1600); // por defecto la más barata
    sel.set(1, 'b');
    expect(currentBasis(plan, sel)).toBe(1800); // ahora la cara
  });

  it('mejor/peor caso toman el mín y máx de cada carga', () => {
    const leg1: RefuelLeg = { n: 1, targetTripKm: 300, stations: [station('a', 1600), station('b', 1800)] };
    const leg2: RefuelLeg = { n: 2, targetTripKm: 600, stations: [station('c', 1500), station('d', 1900)] };
    const plan = planWith([leg1, leg2]);
    // best = avg(1600, 1500) = 1550 ; worst = avg(1800, 1900) = 1850
    expect(bestBasis(plan)).toBe(1550);
    expect(worstBasis(plan)).toBe(1850);
  });

  it('sin cargas con estaciones usa el promedio del recorrido (o mín/máx de ruta)', () => {
    const plan = planWith([], 1650, [station('a', 1600), station('b', 1700)]);
    expect(legsWithStations(plan)).toHaveLength(0);
    expect(currentBasis(plan, new Map())).toBe(1650);
    expect(bestBasis(plan)).toBe(1600);
    expect(worstBasis(plan)).toBe(1700);
  });

  it('relabelLeg pone el entero en la elegida y sub-numera el resto en orden', () => {
    const leg: RefuelLeg = {
      n: 2,
      targetTripKm: 600,
      stations: [station('a', 1600), station('b', 1700), station('c', 1800)],
    };
    relabelLeg(leg, 'b');
    expect(leg.stations.find((s) => s.id === 'b')!.seq).toBe('2'); // elegida → entero
    expect(leg.stations.find((s) => s.id === 'a')!.seq).toBe('2.1');
    expect(leg.stations.find((s) => s.id === 'c')!.seq).toBe('2.2');
  });
});
