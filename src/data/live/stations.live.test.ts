import { describe, expect, it } from 'vitest';
import { pruneAlongRoute, stationFromRecord } from './stations.live';
import { filterPriceOutliers, filterStaleRecords, type EnergiaRecord } from './energia';
import type { Route, Station } from '../../domain/types';

// Ruta recta BsAs → Mar del Plata (aprox) con puntos intermedios.
const route: Route = {
  waypoints: [
    { id: 'a', name: 'Buenos Aires', province: 'Buenos Aires', provinceId: 'buenos-aires', coord: { lat: -34.6, lng: -58.38 } },
    { id: 'b', name: 'Mar del Plata', province: 'Buenos Aires', provinceId: 'buenos-aires', coord: { lat: -38.0, lng: -57.54 } },
  ],
  distanceKm: 400,
  geometry: Array.from({ length: 21 }, (_, i) => ({
    lat: -34.6 + ((-38.0 + 34.6) * i) / 20,
    lng: -58.38 + ((-57.54 + 58.38) * i) / 20,
  })),
  roundTrip: false,
};

function record(
  id: number,
  lat: number,
  lng: number,
  precio: number,
  fecha = '2026-05-01T00:00:00',
): EnergiaRecord {
  return {
    stationId: `energia-${id}`,
    empresa: `Estación ${id}`,
    direccion: `Ruta 2 km ${id}`,
    localidad: 'CHASCOMUS',
    bandera: 'YPF',
    precio,
    lat,
    lng,
    fecha,
  };
}

describe('stationFromRecord', () => {
  it('incluye estaciones cerca de la ruta con precio exacto', () => {
    // Punto casi sobre la línea, a mitad de camino
    const s = stationFromRecord(record(1, -36.3, -57.96, 1600), 'buenos-aires', 'super', route);
    expect(s).not.toBeNull();
    expect(s!.price.exact).toBe(true);
    expect(s!.price.source).toBe('station');
    expect(s!.kmFromStart).toBeGreaterThan(100);
    expect(s!.brandId).toBe('ypf');
  });

  it('descarta estaciones lejos del corredor', () => {
    // Bahía Blanca queda a cientos de km de la ruta BsAs→MdP
    const s = stationFromRecord(record(2, -38.72, -62.27, 1600), 'buenos-aires', 'super', route);
    expect(s).toBeNull();
  });
});

describe('filterStaleRecords', () => {
  it('descarta precios viejos (el dataset guarda el último reporte, aunque sea de 2017)', () => {
    const now = new Date('2026-07-14');
    const records = [
      record(1, 0, 0, 2150, '2026-06-20T10:00:00'), // fresco
      record(2, 0, 0, 2200, '2026-03-01T10:00:00'), // dentro de la ventana
      record(3, 0, 0, 999, '2024-08-15T10:00:00'), // viejo: parece ganga, fuera
      record(4, 0, 0, 780, '2017-03-02T10:00:00'), // prehistórico, fuera
    ];
    const fresh = filterStaleRecords(records, now);
    expect(fresh.map((r) => r.precio)).toEqual([2150, 2200]);
  });
});

describe('filterPriceOutliers', () => {
  it('descarta registros basura ($19/L) sin tocar los reales', () => {
    const records = [
      record(1, 0, 0, 1580),
      record(2, 0, 0, 1610),
      record(3, 0, 0, 1650),
      record(4, 0, 0, 1700),
      record(5, 0, 0, 19), // basura: escala vieja
      record(6, 0, 0, 158000), // basura: mal cargado
    ];
    const clean = filterPriceOutliers(records);
    expect(clean.map((r) => r.precio).sort((a, b) => a - b)).toEqual([1580, 1610, 1650, 1700]);
  });

  it('con pocos registros no filtra (no hay mediana confiable)', () => {
    const records = [record(1, 0, 0, 19), record(2, 0, 0, 1650)];
    expect(filterPriceOutliers(records)).toHaveLength(2);
  });
});

describe('pruneAlongRoute', () => {
  function station(id: number, km: number, precio: number): Station {
    return {
      id: `s${id}`,
      brand: 'YPF',
      brandId: 'ypf',
      place: 'x',
      provinceId: 'buenos-aires',
      kmFromStart: km,
      coord: { lat: 0, lng: 0 },
      price: { fuel: 'super', pricePerLiter: precio, source: 'station', exact: true },
    };
  }

  it('conserva las más baratas por tramo y respeta el máximo', () => {
    // 30 estaciones amontonadas en el km 10 (área urbana) + 2 en ruta
    const urban = Array.from({ length: 30 }, (_, i) => station(i, 10, 1700 + i));
    const road = [station(100, 250, 1650), station(101, 420, 1620)];
    const pruned = pruneAlongRoute([...urban, ...road]);
    expect(pruned.length).toBeLessThanOrEqual(12);
    // Las del tramo urbano no desplazan a las de ruta
    expect(pruned.some((s) => s.id === 's100')).toBe(true);
    expect(pruned.some((s) => s.id === 's101')).toBe(true);
    // Del amontonamiento urbano quedan las 2 más baratas
    expect(pruned.filter((s) => s.kmFromStart === 10).length).toBe(2);
    expect(pruned.find((s) => s.kmFromStart === 10)!.price.pricePerLiter).toBe(1700);
  });

  it('queda ordenado por km de recorrido', () => {
    const pruned = pruneAlongRoute([station(1, 300, 1600), station(2, 50, 1700), station(3, 150, 1650)]);
    expect(pruned.map((s) => s.kmFromStart)).toEqual([50, 150, 300]);
  });
});
