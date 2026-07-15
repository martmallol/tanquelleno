# tanquelleno

**KmxKm** — calculadora de costo de nafta para viajes en auto por Argentina.
Colorway **Crepúsculo** (del proyecto de Claude Design *Nafta Viajes — Exploraciones*).

Elegís auto y destino; la app calcula cuánta nafta gasta el viaje, cuánto sale, dónde
conviene cargar según la autonomía del auto, y los peajes. Funciona con **datos reales
sin API keys** (ver "Fuentes de datos"); con `VITE_DATA_SOURCE=mock` corre offline
con datos mockeados.

## Correr

```bash
npm install
npm run dev        # http://localhost:5173  (Vite, multi-página)
npm test           # tests de dominio + integración (Vitest)
npm run build      # typecheck (tsc) + build de producción a dist/
```

## Arquitectura

La regla central: **la lógica de negocio no conoce la fuente de datos**. Todo pasa por
interfaces (`src/data/ports.ts`); hoy las cumplen adapters mock, mañana adapters "live".

```
src/
  domain/            Lógica pura, sin red ni DOM (testeable sola)
    types.ts         Modelo: Car, Route, Station, FuelPrice, TripPlan…
    trip.ts          computeTrip(): litros, costo, autonomía, nº de cargas
    geo.ts           Haversine, geometría de ruta, distancia a polilínea
    car.ts           TripCar desde catálogo o categoría
    format.ts        Formateo es-AR ($ 126.900, 1.075 km, badges de precio)
  data/
    ports.ts         Interfaces de servicios (el "puerto" a la fuente de datos)
    provider.ts      Punto único que elige mock vs. live
    mock/            Adapters mock + datasets (autos AR, precios, ciudades, estaciones)
    live/            Adapters reales (Nominatim, OSRM, dataset oficial de surtidor)
  app/
    tripPlanner.ts   Orquesta servicios + dominio → TripPlan
    tripStore.ts     Estado del viaje (localStorage), compartido entre páginas
    home.ts          Controlador del inicio
    selector.ts      Controlador del selector de auto
    resultado.ts     Controlador del resultado
    mapView.ts       Dibuja la ruta/pins en SVG desde la geometría
  entries/           Un entrypoint por página (importa CSS + arranca el controlador)
  styles/            tokens.css (colorway) + main.css
  index.html · resultado.html · selector.html
```

## Fuentes de datos (live, sin API keys)

| Servicio | Puerto | Fuente real |
|----------|--------|-------------|
| Búsqueda de lugares | `DirectionsService` | Nominatim (OpenStreetMap), restringido a AR |
| Ruta, distancia, geometría | `DirectionsService` | OSRM público (ruta real por camino) |
| Estaciones + precio exacto | `StationsService` | Dataset oficial "Precios en surtidor" Res. 314/2016 (datos.energia.gob.ar — la fuente detrás de naftas.com.ar), con lat/lng por estación |
| Promedios de nafta | `FuelPriceService` | mismo dataset, promedio provincial calculado en vivo |
| Mapa | UI (`mapView.ts`) | Leaflet + tiles de OpenStreetMap |
| Catálogo de autos AR | `CarCatalog` | base propia curada (no existe API pública de consumos) |
| Peajes | `TollService` | estimación local (sin fuente abierta consolidada) |

En dev, el dataset de energía pasa por el proxy de Vite (`/api/energia`) para evitar
mixed-content; en producción esa misma ruta la serviría un backend propio.

### Limpieza de datos del dataset oficial

El dataset guarda el **último precio reportado** por estación (hay reportes de 2017).
`src/data/live/energia.ts` filtra: precios con más de ~5 meses de antigüedad
(con inflación parecen gangas y envenenan el ranking) y basura de escala
($19/L) por desvío de la mediana provincial. Cache 6 h por provincia/combustible.

### Estados de precio

- **precio exacto** — dato de la estación puntual del dataset (badge verde).
- **≈ estimado provincial / nacional** — promedio por provincia o país (badge gris,
  con "≈"), cuando la estación no tiene precio propio o el servicio no responde.

### Consumo → cálculo

Del catálogo salen L/100 km + nafta sugerida + tamaño de tanque (para autonomía y nº de
paradas). Si el auto no está, **fallback por categoría** (chico / sedán / SUV / pickup) con
consumo promedio marcado como estimado.

## Referencias

Ver [refs/references.md](refs/references.md).
