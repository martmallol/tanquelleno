/**
 * Link de navegación a Google Maps + QR para abrir el viaje en el celular.
 *
 * Usamos SOLO Google Maps porque su URL de Directions soporta origen, destino y
 * hasta ~9 paradas: codifica TODO el recorrido. Waze quedó afuera a propósito:
 * su esquema de URL solo admite un destino (no paradas), así que no puede
 * respetar el recorrido completo. El QR se genera localmente con `qrcode` (sin
 * API externa — respeta el CSP de la app).
 */

import QRCode from 'qrcode';
import type { TripPlan } from '../domain/types';

const coord = (w: { coord: { lat: number; lng: number } }): string =>
  `${w.coord.lat.toFixed(5)},${w.coord.lng.toFixed(5)}`;

/**
 * URL de Google Maps Directions para el recorrido completo del plan
 * (origen + paradas + destino). Desde Google Maps en el cel se puede pasar a
 * navegar y, si se quiere, exportar a Waze manualmente.
 */
export function googleMapsUrl(plan: TripPlan): string {
  const wps = plan.route.waypoints;
  const origin = wps[0]!;
  const destination = wps[wps.length - 1]!;
  const middle = wps.slice(1, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: coord(origin),
    destination: coord(destination),
    travelmode: 'driving',
  });
  if (middle.length > 0) {
    params.set('waypoints', middle.slice(0, 9).map(coord).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Genera un data URL PNG de un QR para la URL dada. */
export function qrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 240,
    color: { dark: '#1b2240ff', light: '#fffdfaff' },
    errorCorrectionLevel: 'M',
  });
}

/** QR del recorrido completo en Google Maps. */
export function mapsQrDataUrl(plan: TripPlan): Promise<string> {
  return qrDataUrl(googleMapsUrl(plan));
}
