/**
 * Adapter de peajes contra la API de TollGuru (precios en vivo, con TelePASE).
 *
 * Le mandamos la geometría real de la ruta (la misma que dibuja el mapa,
 * codificada como polilínea Google precision 5) al endpoint
 * `complete-polyline-from-mapping-service`, y TollGuru devuelve las cabinas
 * sobre esa traza con su tarifa por medio de pago. Usamos el precio con
 * transponder (`tag` = TelePASE) y caemos a efectivo si no viene.
 *
 * La API key NO va en el cliente: se inyecta server-side en el proxy
 * `/api/tollguru` (ver vite.config.ts / un backend en prod). El parser está
 * separado (parseTollguru) para testearlo sin red, y es defensivo con los
 * nombres de campo porque TollGuru varía un poco entre versiones. Si algo
 * falla, liveServices cae al dataset curado (ver data/live/index.ts).
 */

import type { LatLng, Route, TollBooth, TollEstimate } from '../../domain/types';
import { kmAlongPath } from '../../domain/geo';
import type { TollService } from '../ports';
import { postJson } from '../live/http';

const ENDPOINT = '/api/tollguru/toll/v2/complete-polyline-from-mapping-service';

// ---- Forma (parcial y tolerante) de la respuesta de TollGuru ----

interface TollguruToll {
  name?: string;
  road?: string;
  operator?: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  start?: { latitude?: number; longitude?: number };
  tagCost?: number;
  cashCost?: number;
  cost?: number;
  arrival?: { distance?: number };
}

interface TollguruResponse {
  route?: {
    costs?: { tag?: number; cash?: number; [k: string]: number | undefined };
    tolls?: TollguruToll[];
  };
}

/** Primer número finito entre los candidatos, o null. */
function firstNum(...vals: Array<number | undefined>): number | null {
  for (const v of vals) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

const slug = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export interface ParseCtx {
  roundTrip: boolean;
  /** Km del viaje para una coordenada (fallback si TollGuru no trae distancia). */
  kmAt: (c: LatLng) => number;
  /** Mes actual "YYYY-MM" (inyectable para tests). */
  now?: string;
}

/**
 * Mapea la respuesta de TollGuru a nuestro TollEstimate, priorizando el precio
 * con TelePASE (`tag`) y cayendo a efectivo. Función pura y testeable.
 */
export function parseTollguru(json: TollguruResponse, ctx: ParseCtx): TollEstimate {
  const r = json.route ?? {};
  const raw = Array.isArray(r.tolls) ? r.tolls : [];

  const booths: TollBooth[] = raw
    .map((t, i): TollBooth => {
      const lat = firstNum(t.lat, t.latitude, t.start?.latitude) ?? 0;
      const lng = firstNum(t.lng, t.longitude, t.start?.longitude) ?? 0;
      const coord = { lat, lng };
      // Preferimos TelePASE (tag); si no, efectivo.
      const price = firstNum(t.tagCost, t.cashCost, t.cost) ?? 0;
      const km =
        t.arrival?.distance != null
          ? Math.round(t.arrival.distance / 1000)
          : ctx.kmAt(coord);
      return {
        id: `tg-${i}-${slug(t.name ?? String(i))}`,
        name: t.name ?? `Peaje ${i + 1}`,
        road: t.road ?? '',
        operator: t.operator ?? 'TollGuru',
        coord,
        kmFromStart: km,
        price,
      };
    })
    .sort((a, b) => a.kmFromStart - b.kmFromStart);

  const legs = ctx.roundTrip ? 2 : 1;
  const onePass =
    firstNum(r.costs?.tag, r.costs?.cash) ?? booths.reduce((s, b) => s + b.price, 0);

  return {
    total: Math.round(onePass * legs),
    booths,
    updatedAt: ctx.now ?? new Date().toISOString().slice(0, 7),
    source: 'TollGuru · TelePASE',
  };
}

/**
 * Codifica una polilínea con el algoritmo de Google (precision 5), como espera
 * TollGuru para `source: "osrm"`.
 */
export function encodePolyline(points: LatLng[], precision = 5): string {
  const factor = 10 ** precision;
  let lastLat = 0;
  let lastLng = 0;
  let out = '';
  const enc = (value: number): string => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let s = '';
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    s += String.fromCharCode(v + 63);
    return s;
  };
  for (const p of points) {
    const lat = Math.round(p.lat * factor);
    const lng = Math.round(p.lng * factor);
    out += enc(lat - lastLat) + enc(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return out;
}

export const tollguruTolls: TollService = {
  async tollsForRoute(route: Route): Promise<TollEstimate> {
    const body = {
      source: 'osrm',
      polyline: encodePolyline(route.geometry, 5),
      vehicle: { type: '2AxlesAuto' },
      currency: 'ARS',
    };
    const json = await postJson<TollguruResponse>(ENDPOINT, body, 20000);
    return parseTollguru(json, {
      roundTrip: route.roundTrip,
      kmAt: (c) => Math.round(kmAlongPath(c, route.geometry)),
    });
  },
};
