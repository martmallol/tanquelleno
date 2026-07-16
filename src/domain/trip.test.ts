import { describe, expect, it } from 'vitest';
import {
  computeTrip,
  groupStationsByRefuel,
  litersFor,
  rangeFor,
  refuelStopsFor,
  type ComputeTripInput,
} from './trip';
import type { FuelPrice, FuelType, Route, Station, TripCar } from './types';

const cronos: TripCar = {
  label: 'Fiat Cronos 1.3 · 2022',
  carId: 'fiat-cronos-1.3-2022',
  category: 'sedan',
  consumptionLper100: 6.3,
  suggestedFuel: 'super',
  tankLiters: 48,
  estimatedConsumption: false,
};

function route(distanceKm: number, roundTrip: boolean): Route {
  return {
    waypoints: [
      { id: 'a', name: 'A', province: 'X', provinceId: 'x', coord: { lat: 0, lng: 0 } },
      { id: 'b', name: 'B', province: 'X', provinceId: 'x', coord: { lat: 1, lng: 1 } },
    ],
    distanceKm,
    geometry: [
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 },
    ],
    roundTrip,
  };
}

function price(fuel: FuelType, value: number, exact: boolean): FuelPrice {
  return { fuel, pricePerLiter: value, source: exact ? 'station' : 'province', exact };
}

function station(id: string, fuel: FuelType, value: number, exact: boolean, km: number): Station {
  return {
    id,
    brand: 'YPF',
    brandId: 'ypf',
    place: 'Algún lado',
    provinceId: 'x',
    kmFromStart: km,
    coord: { lat: 0.5, lng: 0.5 },
    price: price(fuel, value, exact),
  };
}

const refPrices: Record<FuelType, FuelPrice> = {
  super: price('super', 1650, false),
  premium: price('premium', 1880, false),
};

describe('fórmulas de consumo', () => {
  it('litros = distancia × consumo / 100', () => {
    expect(litersFor(1000, 6.3)).toBeCloseTo(63);
  });

  it('autonomía = tanque / consumo × 100', () => {
    expect(rangeFor(48, 6.3)).toBeCloseTo(761.9, 1);
  });

  it('nº de cargas = techo(distancia / autonomía) − 1 (sale con tanque lleno)', () => {
    // autonomía 640, viaje 640 → 0 cargas (llega justo)
    expect(refuelStopsFor(640, 640)).toBe(0);
    // viaje 641 → 1 carga
    expect(refuelStopsFor(641, 640)).toBe(1);
    // viaje 1280 → 1 carga; 1281 → 2
    expect(refuelStopsFor(1280, 640)).toBe(1);
    expect(refuelStopsFor(1281, 640)).toBe(2);
  });

  it('autonomía 0 no divide por cero', () => {
    expect(refuelStopsFor(500, 0)).toBe(0);
  });
});

describe('computeTrip', () => {
  const base: ComputeTripInput = {
    route: route(500, true),
    car: cronos,
    stations: [
      station('s1', 'super', 1600, true, 120),
      station('s2', 'super', 1700, true, 300),
    ],
    referencePrices: refPrices,
    tolls: 5000,
  };

  it('duplica la distancia en ida y vuelta', () => {
    const plan = computeTrip(base);
    expect(plan.totalDistanceKm).toBe(1000);
  });

  it('no duplica en solo ida', () => {
    const plan = computeTrip({ ...base, route: route(500, false) });
    expect(plan.totalDistanceKm).toBe(500);
  });

  it('litros y costo usan el consumo del auto y el promedio de estaciones', () => {
    const plan = computeTrip(base);
    // 1000 km × 6.3 / 100 = 63 L
    expect(plan.liters).toBe(63);
    // promedio de estaciones súper = (1600 + 1700) / 2 = 1650
    expect(plan.avgPricePerLiter).toBe(1650);
    const suggested = plan.costs[0]!;
    expect(suggested.fuel).toBe('super');
    expect(suggested.totalCost).toBeCloseTo(63 * 1650);
  });

  it('ordena estaciones por precio (más barata primero)', () => {
    const plan = computeTrip(base);
    expect(plan.stations[0]!.id).toBe('s1');
    expect(plan.stations[0]!.price.pricePerLiter).toBe(1600);
  });

  it('incluye la alternativa premium con su precio de referencia', () => {
    const plan = computeTrip(base);
    const alt = plan.costs[1]!;
    expect(alt.fuel).toBe('premium');
    expect(alt.pricePerLiter).toBe(1880);
  });

  it('marca el promedio como estimado si alguna estación no es exacta', () => {
    const plan = computeTrip({
      ...base,
      stations: [
        station('s1', 'super', 1600, true, 120),
        station('s2', 'super', 1700, false, 300), // estimada
      ],
    });
    expect(plan.avgPriceEstimated).toBe(true);
    expect(plan.costs[0]!.exact).toBe(false);
  });

  it('sin estaciones cae al precio de referencia y hereda su estado', () => {
    const plan = computeTrip({ ...base, stations: [] });
    expect(plan.avgPricePerLiter).toBe(1650); // referencia súper
    expect(plan.avgPriceEstimated).toBe(true); // la referencia es provincial
    expect(plan.stations).toHaveLength(0);
  });

  it('con precio de estación exacto el costo sugerido queda exacto', () => {
    const plan = computeTrip({
      ...base,
      stations: [station('s1', 'super', 1600, true, 120)],
    });
    expect(plan.avgPriceEstimated).toBe(false);
    expect(plan.costs[0]!.exact).toBe(true);
  });
});


describe('groupStationsByRefuel (plan de cargas estilo GasBuddy)', () => {
  // Viaje 500 km ida, ida y vuelta = 1000 km, autonomía 500 → útil 450:
  // cargas en km 450 y 900 del viaje total.
  const oneWay = 500;
  const total = 1000;
  const range = 500;

  it('asigna estaciones a la carga cuya ventana atraviesan (ida o vuelta)', () => {
    const stations = [
      station('ida-430', 'super', 1700, true, 430),  // ida: km 430 ∈ [247, 450] → 1ª carga
      station('ida-260', 'super', 1600, true, 260),  // ida: km 260 ∈ [247, 450] → 1ª carga
      station('vuelta-120', 'super', 1650, true, 120), // vuelta: km 880 ∈ [697, 900] → 2ª carga
      station('cerca-origen', 'super', 1500, true, 20), // km 20 y 980: fuera de ambas → extra
    ];
    const { legs, extras } = groupStationsByRefuel(stations, oneWay, total, range, true);
    expect(legs).toHaveLength(2);
    expect(legs[0]!.stations.map((s) => s.id).sort()).toEqual(['ida-260', 'ida-430']);
    // Dentro de la carga, más barata primero
    expect(legs[0]!.stations[0]!.id).toBe('ida-260');
    expect(legs[1]!.stations.map((s) => s.id)).toEqual(['vuelta-120']);
    expect(extras.map((s) => s.id)).toEqual(['cerca-origen']);
  });

  it('solo ida no espeja posiciones de vuelta', () => {
    const stations = [station('ida-120', 'super', 1650, true, 120)];
    const { legs, extras } = groupStationsByRefuel(stations, oneWay, oneWay, range, false);
    // 500 km con 450 útiles → 1 carga en km 450; km 120 queda fuera de [202, 450]... no:
    // ventana = [450 - 202.5, 450] = [247.5, 450] → 120 es extra
    expect(legs).toHaveLength(1);
    expect(legs[0]!.stations).toHaveLength(0);
    expect(extras.map((s) => s.id)).toEqual(['ida-120']);
  });

  it('viaje corto sin cargas: todo queda como extra ordenado por km', () => {
    const stations = [station('b', 'super', 1600, true, 300), station('a', 'super', 1700, true, 100)];
    const { legs, extras } = groupStationsByRefuel(stations, 400, 400, 900, false);
    expect(legs).toHaveLength(0);
    expect(extras.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('numera la elegida con el entero de la carga y las alternativas 1.1, 1.2; backup sin número', () => {
    const plan = computeTrip({
      route: route(oneWay, true),
      car: cronos, // tanque 48 / 6.3 → autonomía 762, útil 685 → 1 carga en km 685
      stations: [
        station('vuelta-350', 'super', 1700, true, 350), // vuelta: km 650 ∈ [377, 685] → 1ª carga
        station('vuelta-400', 'super', 1600, true, 400), // vuelta: km 600 ∈ ventana → 1ª carga
        station('extra', 'super', 1500, true, 10),
      ],
      referencePrices: refPrices,
      tolls: 0,
    });
    expect(plan.refuelLegs).toHaveLength(1);
    const leg = plan.refuelLegs[0]!;
    // más barata primero dentro de la carga → es la elegida por defecto → "1"
    expect(leg.stations[0]!.id).toBe('vuelta-400');
    expect(leg.stations[0]!.seq).toBe('1');
    // la alternativa se sub-numera
    expect(leg.stations[1]!.seq).toBe('1.1');
    // la de backup NO se numera
    expect(plan.extraStations[0]!.seq).toBeUndefined();
  });
});
