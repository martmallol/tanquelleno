/**
 * Dataset curado de cabinas de peaje reales de Argentina.
 *
 * Mismo patrón que el catálogo de autos: no existe una API abierta y
 * consolidada de peajes en el país, así que mantenemos una base propia con
 * ubicaciones reales y tarifas publicadas (auto categoría 1, pago manual).
 * Se refresca a mano cuando cambian los cuadros tarifarios.
 *
 * Vigencia de tarifas: 2026-07 (ver TOLLS_UPDATED_AT).
 *
 * Fuentes:
 *   - Corredor a la Costa (RP2 / RP11 / RP74, AUBASA — Sistema Vial Integrado
 *     del Atlántico): Resolución 544/2026 del Ministerio de Infraestructura de
 *     la Provincia de Buenos Aires (aumento 6,71%, vigente desde 2026-07).
 *   - Autopista Buenos Aires–La Plata (AUBASA) y accesos: cuadro AUBASA 2026.
 *   - Corredores Viales Nacionales (RN9 / RN8 / RN7 / RN12): cuadro tarifario
 *     nacional 2026 (tarifa piso auto $1.500). Valores de referencia por plaza.
 *
 * Las coordenadas son la ubicación aproximada de la plaza sobre la traza; el
 * matching contra la ruta usa cercanía a la geometría (ver tolls.service).
 */

/** Mes de vigencia de las tarifas de este dataset. */
export const TOLLS_UPDATED_AT = '2026-07';

export interface TollSeed {
  id: string;
  /** Nombre de la cabina. */
  name: string;
  /** Ruta donde está. */
  road: string;
  /** Concesionaria / operador. */
  operator: string;
  lat: number;
  lng: number;
  /** Tarifa auto categoría 1, pago manual, en ARS (una pasada). */
  price: number;
}

export const TOLLS: TollSeed[] = [
  // ---- Corredor a la Costa Atlántica (tarifas confirmadas Res. 544/2026) ----
  // Autopista Buenos Aires–La Plata (ramal a RP2), AUBASA.
  { id: 'aubasa-hudson', name: 'Hudson', road: 'Au. Bs.As.–La Plata', operator: 'AUBASA', lat: -34.7969, lng: -58.1364, price: 2100 },
  // Autovía 2 (RP2) — troncal a Mar del Plata.
  { id: 'rp2-samborombon', name: 'Samborombón', road: 'RP2 (Autovía 2)', operator: 'AUBASA', lat: -35.5719, lng: -57.8925, price: 7900 },
  { id: 'rp2-maipu', name: 'Maipú', road: 'RP2 (Autovía 2)', operator: 'AUBASA', lat: -36.8106, lng: -57.8261, price: 7900 },
  // Ruta 11 (interbalnearia, costa norte).
  { id: 'rp11-la-huella', name: 'La Huella', road: 'RP11', operator: 'AUBASA', lat: -37.4536, lng: -57.3072, price: 7900 },
  { id: 'rp11-mar-chiquita', name: 'Mar Chiquita', road: 'RP11', operator: 'AUBASA', lat: -37.7414, lng: -57.4275, price: 3700 },
  // Ruta 74 (acceso a Pinamar / Villa Gesell / Madariaga).
  { id: 'rp74-madariaga', name: 'General Madariaga', road: 'RP74', operator: 'AUBASA', lat: -37.0028, lng: -57.1361, price: 3300 },

  // ---- Corredor Buenos Aires → Rosario → Córdoba (RN9, Corredores Viales) ----
  // Ubicaciones reales; tarifa por plaza APROXIMADA (~$1.900): el cuadro
  // nacional 2026 fija un piso de $1.500 para autos y el total BA→Rosario ronda
  // los $10.000 en ~5 cabinas. Confirmar por plaza cuando haya dato oficial.
  { id: 'rn9-hudson-acc', name: 'General Pacheco', road: 'RN9 (Panamericana)', operator: 'Corredores Viales', lat: -34.4497, lng: -58.6486, price: 1900 },
  { id: 'rn9-zarate', name: 'Zárate', road: 'RN9', operator: 'Corredores Viales', lat: -34.0958, lng: -59.0292, price: 1900 },
  { id: 'rn9-ramallo', name: 'Ramallo', road: 'RN9', operator: 'Corredores Viales', lat: -33.4794, lng: -60.0006, price: 1900 },
  { id: 'rn9-roldan', name: 'Roldán', road: 'RN9 (Au. Rosario)', operator: 'Corredores Viales', lat: -32.8983, lng: -60.9114, price: 1900 },
  { id: 'rn9-carcarana', name: 'Carcarañá', road: 'RN9 (Au. Córdoba)', operator: 'Corredores Viales', lat: -32.8608, lng: -61.1531, price: 1900 },
  { id: 'rn9-leones', name: 'Leones', road: 'RN9 (Au. Córdoba)', operator: 'Corredores Viales', lat: -32.6592, lng: -62.2969, price: 1900 },
  { id: 'rn9-villa-maria', name: 'Pilar (Córdoba)', road: 'RN9', operator: 'Corredores Viales', lat: -31.6797, lng: -63.8792, price: 1900 },

  // ---- Corredor Buenos Aires → Luján → Junín (RN7 / RN8, Corredores Viales) ----
  { id: 'rn7-lujan', name: 'Luján', road: 'RN7 (Au. del Oeste)', operator: 'Corredores Viales', lat: -34.5708, lng: -59.1044, price: 1900 },
  { id: 'rn8-pilar', name: 'Pilar', road: 'RN8', operator: 'Corredores Viales', lat: -34.4589, lng: -58.9142, price: 1900 },

  // ---- Corredor del Litoral (RN12 / RN14, Corredores Viales) ----
  { id: 'rn12-ceibas', name: 'Ceibas', road: 'RN12', operator: 'Corredores Viales', lat: -33.4931, lng: -58.7739, price: 1900 },
];
