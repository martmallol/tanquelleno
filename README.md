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
`src/data/live/energia.ts` filtra por frescura con **ventana adaptativa** (medida sobre
el dataset real): 60 días como base — con la inflación argentina, un precio viejo parece
una ganga y envenena el ranking de "más barata" —, extendida a 90 días si la provincia
queda con muy pocas estaciones. Segunda red contra basura de escala ($19/L) por desvío
de la mediana provincial. Cache 6 h por provincia/combustible.

### Estados de precio

- **precio exacto** — dato de la estación puntual del dataset (badge verde).
- **≈ estimado provincial / nacional** — promedio por provincia o país (badge gris,
  con "≈"), cuando la estación no tiene precio propio o el servicio no responde.

### Catálogo de autos: cómo se cura y cómo escala

Los datos viven en [`src/data/cars.ar.json`](src/data/cars.ar.json), versionado y con
metadata de fuentes (`version`, `updatedAt`, `sources`). **No existe una API pública
argentina de consumos homologados**: la guía de ACARA es la nómina de precios (sin
consumo) y los portales de fichas técnicas no exponen API. Por eso el catálogo es un
JSON curado a mano a partir de fichas de fabricante y pruebas de ruta.

Para agregar modelos nuevos: editar el array `cars` del JSON y correr `npm test`
(la expansión a Car por año y los ids se generan solos en `cars.data.ts`). El
**fallback por categoría** (chico / sedán / SUV / pickup) cubre cualquier auto que no
esté en la base, con consumo promedio marcado como estimado — así la app nunca queda
sin respuesta aunque aparezca un modelo que todavía no cargamos.

### Peajes

Estimación local (`tolls.mock.ts`): ~$1.200 por cabina cada ~120 km. Es un placeholder
—no hay una fuente abierta consolidada de peajes—; el usuario puede ignorarlo o el
diseño lo muestra aparte del costo de nafta.

### Ajustes avanzados

En el inicio, "Ajustes avanzados" corrige el consumo según cómo viaja el auto:
**pasajeros**, **equipaje / auto muy cargado** y **aire acondicionado**. El precio de la
nafta NO se pide al usuario — sale solo de los datos oficiales (`loadFactor` en
`tripPlanner.ts` aplica la corrección; +2.5% por pasajero extra, +4% equipaje, +6% A/C,
con techo de +25%). Hay un campo experto opcional para quien sabe el consumo exacto de su
auto.

### Paradas: ida y/o vuelta

Cada parada puede marcarse "solo a la ida" o "ida y vuelta". Si alguna no se repite en la
vuelta, `planTrip` arma la ruta asimétrica explícita
(origen → paradas ida → destino → paradas vuelta → origen) en una sola pasada; si todas se
repiten, usa el camino directo y duplica (más eficiente).

### Plan de cargas (estilo GasBuddy)

`groupStationsByRefuel` (en `domain/trip.ts`) agrupa las estaciones por **carga**. Solo las
candidatas de cada carga se numeran, jerárquico: `1.1`, `1.2` (opciones de la 1ª carga),
`2.1`… — y ese número coincide entre la card y el pin del mapa. Las que no caen en ninguna
ventana de carga quedan como **estaciones de backup**: sin número, pin chico, listadas
aparte.

### Navegación (QR a Google Maps)

En el resultado y la impresión hay un QR (generado localmente con `qrcode`, sin API
externa) que abre el recorrido completo en Google Maps Directions —origen, paradas y
destino—, desde donde el celular puede pasar a Waze. Ver `navLink.ts`.

## Roadmap de negocio (no implementado)

Ideas de monetización/producto que necesitan acuerdos comerciales o datos que hoy no
existen, anotadas para no perderlas:

- **Cupones y ofertas de estaciones**: acuerdos con cadenas (YPF, Shell, Axion…) para
  mostrar descuentos y **posicionar esas estaciones primeras** en su grupo de carga. El
  modelo de datos ya separa estaciones por carga y las rankea, así que sumar un campo
  `offer` y un criterio de orden patrocinado es un cambio acotado.
- **Paradas para comer según la hora de salida**: estimar en qué franja
  (desayuno/almuerzo/merienda) caés en cada tramo y sugerir dónde parar, encajando ahí los
  descuentos gastronómicos. Requiere hora de salida (campo nuevo) + POIs de comida.
- **Ranking patrocinado**: destacar estaciones/marcas pagas, siempre diferenciándolas
  visualmente de la recomendación por precio para no romper la confianza.

## Referencias

Ver [refs/references.md](refs/references.md).
