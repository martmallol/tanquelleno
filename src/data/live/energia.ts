/**
 * Cliente del dataset oficial "Precios de combustibles en surtidor"
 * (Res. 314/2016, datos.energia.gob.ar — la misma fuente que usa naftas.com.ar).
 *
 * API CKAN: /api/3/action/datastore_search con `filters`. En dev pega al proxy
 * de Vite (/api/energia → datos.energia.gob.ar) para evitar mixed-content; la
 * base es configurable por env para producción (backend propio).
 *
 * Cada registro trae empresa, dirección, provincia, producto, precio vigente,
 * bandera y lat/lng — con eso resolvemos estaciones sobre la ruta Y su precio
 * exacto en un solo fetch. Cache en memoria + localStorage (TTL 6 h) por
 * (provincia, combustible).
 */

import type { FuelType } from '../../domain/types';
import { getJson } from './http';
import { PROVINCE_TO_DATASET } from './provinces';

const BASE: string = import.meta.env.VITE_ENERGIA_BASE ?? '/api/energia';
const RESOURCE_ID = '80ac25de-a44a-4445-9215-090cf55cfda5';

/** idproducto del dataset por tipo de nafta. */
const PRODUCT_ID: Record<FuelType, number> = {
  super: 2, // "Nafta (súper) entre 92 y 95 Ron"
  premium: 3, // "Nafta (premium) de más de 95 Ron"
};

const HORARIO_DIURNO = 2;

/** Registro adelgazado que guardamos en cache (el original pesa ~4x). */
export interface EnergiaRecord {
  /** id estable de la estación: `energia-<idempresa>` */
  stationId: string;
  empresa: string;
  direccion: string;
  localidad: string;
  bandera: string;
  precio: number;
  lat: number;
  lng: number;
  fecha: string;
}

interface RawRecord {
  idempresa: number;
  empresa: string;
  direccion: string;
  localidad: string;
  empresabandera: string | null;
  precio: number;
  latitud: number | null;
  longitud: number | null;
  fecha_vigencia: string;
}

interface DatastoreResponse {
  success: boolean;
  result: { records: RawRecord[]; total: number };
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const memCache = new Map<string, EnergiaRecord[]>();

function cacheKey(provinceId: string, fuel: FuelType): string {
  return `kmxkm.energia.v3.${provinceId}.${fuel}`;
}

function readStorage(key: string): EnergiaRecord[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; records: EnergiaRecord[] };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.records;
  } catch {
    return null;
  }
}

function writeStorage(key: string, records: EnergiaRecord[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), records }));
  } catch {
    // storage lleno: seguimos solo con cache en memoria
  }
}

function slim(r: RawRecord): EnergiaRecord | null {
  if (r.latitud == null || r.longitud == null || !Number.isFinite(r.precio) || r.precio <= 0) {
    return null;
  }
  return {
    stationId: `energia-${r.idempresa}`,
    empresa: r.empresa?.trim() ?? '',
    direccion: r.direccion?.trim() ?? '',
    localidad: r.localidad?.trim() ?? '',
    bandera: r.empresabandera?.trim() ?? 'Blanca',
    precio: r.precio,
    lat: r.latitud,
    lng: r.longitud,
    fecha: r.fecha_vigencia,
  };
}

/**
 * Precios vigentes (horario diurno) de un combustible en una provincia.
 * Un registro por estación. Cacheado.
 */
export async function fetchProvincePrices(
  provinceId: string,
  fuel: FuelType,
): Promise<EnergiaRecord[]> {
  const key = cacheKey(provinceId, fuel);
  const inMem = memCache.get(key);
  if (inMem) return inMem;
  const stored = readStorage(key);
  if (stored) {
    memCache.set(key, stored);
    return stored;
  }

  const datasetProv = PROVINCE_TO_DATASET[provinceId];
  if (!datasetProv) return [];

  const filters = encodeURIComponent(
    JSON.stringify({
      idproducto: PRODUCT_ID[fuel],
      idtipohorario: HORARIO_DIURNO,
      provincia: datasetProv,
    }),
  );
  const url = `${BASE}/api/3/action/datastore_search?resource_id=${RESOURCE_ID}&filters=${filters}&limit=32000`;
  const res = await getJson<DatastoreResponse>(url, 25000);

  // Si una estación aparece más de una vez, nos quedamos con la más reciente.
  const byStation = new Map<string, EnergiaRecord>();
  for (const raw of res.result.records) {
    const rec = slim(raw);
    if (!rec) continue;
    const prev = byStation.get(rec.stationId);
    if (!prev || rec.fecha > prev.fecha) byStation.set(rec.stationId, rec);
  }
  const records = filterPriceOutliers(filterStaleRecords([...byStation.values()]));

  memCache.set(key, records);
  writeStorage(key, records);
  return records;
}

/**
 * El dataset guarda el ÚLTIMO precio reportado por estación: hay estaciones
 * cuya última carga es de 2017. Con inflación, un precio viejo parece una
 * ganga y envenena el promedio y el ranking de "más barata". Nos quedamos
 * solo con reportes recientes.
 */
const MAX_PRICE_AGE_DAYS = 150;

export function filterStaleRecords(
  records: EnergiaRecord[],
  now: Date = new Date(),
): EnergiaRecord[] {
  const cutoff = new Date(now.getTime() - MAX_PRICE_AGE_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return records.filter((r) => r.fecha >= cutoff);
}

/**
 * Segunda red de seguridad contra basura de escala ($19/L, $158.000/L) con
 * fecha reciente. Bordes anchos (0.5×–2× de la mediana provincial): el spread
 * real de surtidor post-desregulación es grande y no queremos cortar ofertas
 * legítimas. Relativo a la mediana para sobrevivir inflación.
 */
export function filterPriceOutliers(records: EnergiaRecord[]): EnergiaRecord[] {
  if (records.length < 4) return records;
  const sorted = [...records].sort((a, b) => a.precio - b.precio);
  const median = sorted[Math.floor(sorted.length / 2)]!.precio;
  return records.filter((r) => r.precio >= median * 0.5 && r.precio <= median * 2);
}

/** Marca de estación → brandId de la UI (colores del colorway). */
export function brandIdFromBandera(bandera: string): string {
  const b = bandera.toUpperCase();
  if (b.includes('YPF')) return 'ypf';
  if (b.includes('SHELL')) return 'shell';
  if (b.includes('AXION')) return 'axion';
  if (b.includes('PUMA')) return 'puma';
  if (b.includes('GULF')) return 'gulf';
  if (b.includes('REFINOR')) return 'refinor';
  return 'otra';
}
