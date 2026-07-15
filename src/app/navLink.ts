/**
 * Link de navegación a Google Maps + QR para abrirlo desde el celular.
 *
 * Google Maps Directions por URL soporta origen, destino y hasta ~9 waypoints
 * (paradas), así que codifica todo el recorrido. Desde Google Maps en el cel se
 * puede pasar la ruta a Waze. El QR se genera localmente con `qrcode` (sin
 * llamar a ninguna API externa — respeta el CSP de la app).
 */

import QRCode from 'qrcode';
import type { TripPlan } from '../domain/types';

/**
 * URL de Google Maps Directions para el recorrido del plan.
 * Usa nombre + coordenadas de cada waypoint para desambiguar.
 */
export function googleMapsUrl(plan: TripPlan): string {
  const wps = plan.route.waypoints;
  const origin = wps[0]!;
  const destination = wps[wps.length - 1]!;
  const middle = wps.slice(1, -1);

  const coord = (w: { coord: { lat: number; lng: number } }): string =>
    `${w.coord.lat.toFixed(5)},${w.coord.lng.toFixed(5)}`;

  const params = new URLSearchParams({
    api: '1',
    origin: coord(origin),
    destination: coord(destination),
    travelmode: 'driving',
  });
  if (middle.length > 0) {
    // Waypoints separados por "|" (hasta 9). Si hay más, recortamos.
    params.set('waypoints', middle.slice(0, 9).map(coord).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Genera un data URL PNG del QR que apunta al recorrido en Google Maps. */
export async function navQrDataUrl(plan: TripPlan): Promise<string> {
  const url = googleMapsUrl(plan);
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 240,
    color: { dark: '#1b2240ff', light: '#fffdfaff' },
    errorCorrectionLevel: 'M',
  });
}
