# Architecture: Cool Trip (plugin de Obsidian; las apps del recon son referencia, no un original a clonar)

Lee `replica/recon.md` y `replica/features.csv`. Aquí "stack" es la API de plugins de Obsidian: no hay servidor, base de datos, auth ni pagos. El "esquema" son los tipos de nota y su frontmatter (`replica/schema.ts`), y la "API" es lo que el plugin expone dentro de Obsidian (comandos, vistas, bloques) más las operaciones que hace Claude desde fuera.

## Stack

| capa | elección | por qué |
| --- | --- | --- |
| plataforma | API de plugins de Obsidian (`obsidian` 1.14.x en npm), escritorio y móvil | es donde viven las notas; un único `main.js` que funciona en las dos plataformas |
| lenguaje y build | TypeScript + esbuild (plantilla oficial del sample plugin) | lo estándar en plugins, con un build de milisegundos y un solo archivo de salida |
| UI | **Svelte 5** dentro de vistas de Obsidian (`ItemView` y bloques de código) | componentes reales (tarjetas, timeline, stepper) sin el peso de React; compila a JS mínimo |
| estilos | CSS con las **variables del tema de Obsidian** + tokens propios (de `/replica-design`) | respeta el modo claro y oscuro y los temas de Patt; los colores de día y de categoría son tokens |
| datos | notas Markdown + frontmatter; índice en memoria construido desde `metadataCache` | Markdown primero: sin el plugin, el viaje sigue siendo legible y consultable con Bases o Dataview |
| escritura | `fileManager.processFrontMatter` y `vault.process` (atómicos, por línea) | no machacar lo que Patt edita a mano ni provocar conflictos de Sync |
| mapa: render | **MapLibre GL JS 6.x** (WebGL, vectorial) | activo (6.16 del 25-10-2026); los estilos claro y oscuro casan con el tema; fluido en móvil |
| mapa: datos | **PMTiles 4.x** + estilos de `@protomaps/basemaps` 5.x | un solo archivo por ciudad dentro del vault, sin servidor ni API key; ver §Mapa sin conexión |
| mapa: tipografías e iconos | glyphs Noto Sans (solo rangos latinos) y sprites de basemaps, **incrustados en `main.js`** y servidos con `maplibregl.addProtocol` | BRAT y la instalación manual solo copian `main.js`, `manifest.json` y `styles.css`, así que todo tiene que ir dentro |
| tiempos entre paradas | estimación local: distancia en línea recta × 1,3 a 5 km/h, marcada como "aprox." | funciona offline y sin API de pago; el enrutado real (OSRM o OpenRouteService) queda como *could* |
| geocodificación | la hace Claude al importar (`geocodeLocation` de Albo y, si falla, Nominatim a 1 petición/s) | el plugin no llama a la red; las coordenadas quedan guardadas en la nota |
| puentes | Claude con conectores (Albo, Gmail, Drive, Calendar) escribiendo notas | Albo no tiene API pública; las mismas reglas de idempotencia que en Tripsy |
| tests | **vitest** para el modelo (parser, zonas horarias, índice) + **Playwright** contra un *harness* de desarrollo (Vite) que pinta los componentes con datos de ejemplo | Obsidian no se puede ejecutar en el contenedor Cloud; el harness permite diseñar y testear las vistas sin él |
| instalación | `npm run build` → copiar `main.js`, `manifest.json` y `styles.css` a `.obsidian/plugins/cool-trip/` (o BRAT desde un release privado) | plugin privado, no se publica en el directorio de la comunidad |

**Descartados:**
- **Leaflet + `protomaps-leaflet`**: más ligero, pero `protomaps-leaflet` no publica nada desde el 18-06-2025.
- **Map View como dependencia**: compartimos su formato `location`, pero no su render.
- **Cachear teselas raster de OpenStreetMap**: la política de uso de sus teselas prohíbe la descarga masiva para uso offline, y eso es justo lo que hace falta aquí.

## Mapa sin conexión con PMTiles

**Veredicto: sí, es la pieza adecuada.** Resuelve exactamente el problema y además nos ahorra un servidor de teselas.

Cómo funciona:
1. **Recorte por ciudad.** `pmtiles extract https://build.protomaps.com/AAAAMMDD.pmtiles roma.pmtiles --bbox=… --maxzoom=15`. Solo descarga los bytes de esa caja, sin bajarse el planeta (unos 120 GB). Con `--dry-run` se sabe el tamaño antes de descargar, y cada nivel de zoom de más aproximadamente duplica el archivo. Como el vectorial se puede sobreampliar, con maxzoom 14 o 15 las calles siguen viéndose nítidas a zoom 18.
2. **Al vault.** `Viajes/Italia 2026/mapas/roma.pmtiles` y `palermo.pmtiles`, enlazados desde el viaje con `maps: ["[[roma.pmtiles]]"]`.
3. **Lectura dentro de Obsidian** con un `Source` propio de pmtiles (`VaultSource`):
   - en **escritorio**, lecturas por rango con `fs` de Node sobre la ruta real del archivo, sin cargarlo entero;
   - en **móvil**, `adapter.readBinary` una vez y después `slice` del buffer (como hace `FileSource` de pmtiles). Esto pone un **límite de memoria** que hay que medir.
4. **Render.** MapLibre registra el protocolo `pmtiles://` y aplica el estilo `light` o `dark` de basemaps según el tema de Obsidian. Los glyphs y sprites salen de `main.js`. Encima van nuestras capas: pins numerados por día, la línea de ruta y el alojamiento.
5. **Atribución** visible: "© OpenStreetMap" (ODbL). El diseño de basemaps es CC0 y el código BSD-3.

**Riesgos a medir con un *spike* antes de construir la vista:**
- **Tamaño frente a Obsidian Sync.** Sync Standard sube como máximo **5 MB por archivo**; Sync Plus, 200 MB. Es casi seguro que un recorte de Roma a zoom 15 pasa de 5 MB. Si Patt usa Sync Standard, hay que pasar el archivo al móvil por otra vía (AirDrop o la app Archivos), recortarlo más (zoom 14, caja ajustada al centro) o partirlo por barrios. Para decidirlo hace falta saber qué sincronización usa (ver decisiones).
- **Memoria en el móvil** al cargar el archivo entero (objetivo: 30 MB o menos por ciudad, a validar).
- **WebGL2 en la WebView de Obsidian móvil**: debería estar (es Safari 15 o superior en iOS), pero hay que probarlo en el teléfono de Patt.
- **Red del contenedor.** Para hacer el recorte desde aquí hacen falta `build.protomaps.com` y las descargas de releases de GitHub (el binario `pmtiles`). Si no, Patt lo ejecuta una vez en su ordenador con el script `scripts/extract-map.sh`.

**Sin recorte del destino**, el mapa enseña los pins sobre un fondo neutro y un aviso: "descarga el mapa de esta ciudad". Opcionalmente se puede activar un fondo raster online (uso normal de OSM, con atribución), apagado por defecto.

## Referencias de diseño de Patt y lo que aportan

| referencia | patrón | dónde va en Cool Trip | funciones que añade |
| --- | --- | --- | --- |
| Tarjeta de embarque (cabecera de color, BERLIN · KYIV en grande, número y clase, rejilla de asiento, terminal, puerta, embarque y fecha, línea troquelada, código de barras) | **TransportCard** | S08 y el timeline: cada trayecto es un "billete" con origen y destino enormes (IATA o ciudad), el color de su día y la parte de abajo troquelada con el localizador en grande y un botón al PDF o QR | campos `seat`, `terminal`, `gate`, `boarding`, `class`, `passengers` en el transporte |
| Panel de tiles (Documentos 11 · Equipaje 55/78 · Estancias 4 · Trayectos 13 · Lugares y actividades 45 · Gastos 6522) | **SummaryTiles** | S03, la portada del viaje: seis tiles con un número grande, etiqueta y un objeto ilustrativo; cada tile abre su sección | contadores derivados del índice; **equipaje con progreso** (la checklist `## Equipaje` de la nota del viaje); total de gastos (*could*) |
| Hoja de ruta vertical con "estás aquí" (pasos numerados, línea que los une, CTA abajo) | **Stepper** | dos usos: (1) **"Antes del viaje"** en S03, con pasos calculados de los estados (vuelos → alojamiento → entradas con `needs_booking` → check-in online → documentos esenciales → mapas descargados), donde "estás aquí" es el primer paso sin hacer; (2) el **mismo lenguaje visual en el timeline del día**, con nodos numerados que coinciden con los pins del mapa | la hoja de ruta previa al viaje |

Se adoptan los patrones (jerarquía, ritmo, tipografía grande para lo importante, la metáfora del billete). Las ilustraciones, los textos y los colores serán propios, y los define `/replica-design`.

## Schema

Hay 6 tipos de nota (`type:` en el frontmatter) y 1 estructura dentro de la nota del viaje (los días). Las reglas de acceso son "data-layer": el plugin solo lee el vault local de Patt, así que no hay multiusuario. Los tipos completos están en **`replica/schema.ts`**, que pasará tal cual a `src/model/types.ts`.

| type | nota | campos clave | lección del recon |
| --- | --- | --- | --- |
| `trip` | `Viajes/<viaje>/<viaje>.md` | `start`, `end` (fechas; sin ellas el viaje es "sin fechas"), `timezone`, `cover`, `travelers`, `destinations`, `status`, `essentials[]`, `maps[]`, `currency` | Tripsy: `has_dates` es autoritativo |
| `place` | `Lugares/<ciudad>/<lugar>.md` (fuera del viaje, reutilizable) | `category`, `emoji`, `rating`, `price`, `location`, `address`, `cover` (local), `albo`, `needs_booking`, `status` | Albo extract; coordenadas por geocodificación |
| `stay` | `Viajes/<viaje>/Reservas/` | `place?`, `check_in`, `check_out` (hora local) + `timezone`, `address`, `location`, `code`, `docs[]`, `status` | Tripsy: el alojamiento **no** es una actividad |
| `transport` | `Viajes/<viaje>/Reservas/` | `mode`, `from`, `to`, `depart` + `depart_tz`, `arrive` + `arrive_tz`, `from_location`, `to_location`, `number`, `code`, `seat`, `terminal`, `gate`, `boarding`, `class`, `passengers`, `docs[]`, `status` | Tripsy: **cada extremo tiene su zona horaria** |
| `ticket` | `Viajes/<viaje>/Reservas/` | `place`, `start`, `end?` + `timezone`, `code`, `docs[]`, `status` | entrada con hora (Galleria Borghese) |
| `expense` (*could*) | dentro de la nota del viaje, o como notas | `amount` (céntimos), `currency`, `category`, `parent?` | Tripsy expenses; dinero como entero |

Esto **refina la propuesta** (§4.4): el `booking` genérico con `kind` se parte en `stay`, `transport` y `ticket`, porque tienen campos y comportamientos distintos (Tripsy).

**Días y ruta: dentro de la nota del viaje** (resuelve las decisiones abiertas 2 y 3 de la propuesta). Cada día es un encabezado `## AAAA-MM-DD · etiqueta` y una lista Markdown:

```markdown
## 2026-11-29 · Roma clásica
- [ ] 09:00 [[Galleria Borghese]] 🎟 [[Entrada Borghese]] · llegar 15 min antes
- 🚶 20 min
- [ ] [[Piazza di Spagna]]
- [ ] 13:30 [[Il Margutta]] · comida
- [x] [[Trevi Fountain]]
```

Gramática (parser en `src/model/day-md.ts`, con tests):

| elemento | forma | notas |
| --- | --- | --- |
| encabezado de día | `## ` + fecha ISO + `·` + etiqueta opcional | se ignoran los encabezados sin fecha (`## Equipaje`, `## Notas`) |
| parada | elemento de lista con un `[[enlace]]` a un `place` (o texto libre) | `- [ ]` o `- [x]` marca hecho/pendiente; la hora `HH:MM` va al principio; el comentario libre, tras `·` |
| entrada | `🎟 [[nota ticket]]` dentro de la parada | enlaza la reserva con la parada |
| tramo | elemento de lista con un emoji o palabra de modo (`🚶 a pie`, `🚇 metro`, `🚌 bus`, `🚆 tren`, `🚕 taxi`, `⛴ ferry`) y una duración opcional | sin tramo explícito, el plugin calcula uno "aprox." a pie |
| reservas | **no se escriben en la lista** | `transport`, `stay` y `ticket` se intercalan solos por hora en el día que corresponde |

Invariantes (las comprueba el comando "Validar viaje"; avisa, nunca bloquea):
- `arrive` es posterior a `depart` en tiempo absoluto, comparando cada uno en su zona.
- `check_out` es posterior a `check_in`, y las estancias de un mismo viaje no se solapan.
- Los encabezados de día caen entre `start` y `end` y no se repiten.
- Un `place` sin `location` aparece en el timeline pero no en el mapa; el aviso lo cuenta.
- Las zonas horarias son IANA válidas (`Europe/Rome`); sin zona, se usa la del viaje.

## API (superficie del plugin)

| superficie | qué hace | quién | entrada | salida | flujo |
| --- | --- | --- | --- | --- | --- |
| vista `cool-trip-view` (ItemView) | el viaje en pestañas: **Resumen** (S03), **Itinerario** (S04), **Mapa** (S05), **Lugares** (S06) y **Documentos** (S10) | Patt | nota de viaje activa o elegida | vista | F04, F06 |
| vista `cool-trip-list` | lista de viajes, próximos y pasados (S01) | Patt | — | vista | — |
| comando `Abrir viaje` | abre la vista del viaje (la nota activa o un selector) | Patt | — | vista | F05, F06 |
| comando `Nuevo viaje` | modal (S02) que crea la carpeta y la nota con su plantilla | Patt | nombre, fechas o sin fechas, destinos, zona | nota `trip` | — |
| comandos `Nuevo transporte`, `Nueva estancia`, `Nueva entrada` | crea la nota con el `trip` y la zona ya rellenados | Patt | tipo | nota | F03 |
| comando `Añadir al día…` | desde una nota `place`: elige un día (recuerda el último usado) y añade la línea | Patt | día | línea en la nota del viaje | F02 |
| acción en timeline: casilla | marca o desmarca una parada como hecha (`- [x]`) | Patt | clic | línea editada con `vault.process` | F09 |
| acción en timeline: arrastrar (escritorio) o subir/bajar (móvil) | reordena las paradas de un día | Patt | — | líneas reordenadas | F02 |
| comando `Hoy` | vista compacta: próxima parada, siguiente tramo y documentos del día (S14) | Patt | fecha del dispositivo | vista | F05 |
| comando `Validar viaje` | lista los problemas de las invariantes | Patt | viaje | aviso o nota de informe | — |
| comando `Imprimir día` | hoja del día lista para imprimir o guardar como PDF (escritorio) o nota `Hoja del día` (móvil) | Patt | día | PDF o nota | F08 |
| bloque ```` ```cool-trip ```` | incrusta `summary`, `day 2026-11-29`, `map` o `roadmap` en cualquier nota | Patt | opciones YAML | render | — |
| ajustes | carpetas de viajes y lugares, zona por defecto, fondo de mapa online (apagado), paleta de días | Patt | — | — | — |

Eventos en lugar de webhooks: `metadataCache.on('changed' | 'resolved')`, `vault.on('rename' | 'delete')` y `workspace.on('css-change')` (para el tema claro u oscuro del mapa). Todos actualizan el índice de forma incremental.

No hay jobs en el plugin. "Hoy" y la cuenta atrás se recalculan al abrir la vista y al cambiar de día (con un temporizador mientras la vista está abierta).

**Operaciones de Claude (fuera del plugin, con los conectores de Patt):**

| operación | qué hace | idempotencia | flujo |
| --- | --- | --- | --- |
| `importar-albo <colección> <ciudad>` | una nota `place` por lugar; descarga la portada `w600` al vault (para verla offline); geocodifica | la clave es `albo` (id del extract): si existe, actualiza y no duplica | F01 |
| `importar-reservas <viaje>` | lee las confirmaciones en Gmail y crea notas `transport`, `stay` o `ticket`, con los PDF como `docs` | la clave es `code` + `type` | F07 |
| `recortar-mapa <ciudad>` | `pmtiles extract` con la caja de los lugares del viaje + margen; informe de tamaño | sobrescribe el mismo archivo | F04 |
| `calendario <viaje>` (*could*) | eventos en Google Calendar para los trayectos | la clave es `code` | — |

Por ahora, como Claude no tiene acceso al vault desde la nube, estas operaciones escriben en `vault/` dentro de este repo y Patt copia las notas a su vault (ver decisiones).

## The parts that bite

- **Zonas horarias:** las horas se guardan como hora local + zona IANA (más fácil de escribir a mano que UTC). Se convierten con `Intl.DateTimeFormat` (sin librerías) y se pintan en la zona del elemento. Un vuelo con llegada al día siguiente cae en el día de llegada. Italia cambió de horario el 25-10-2026, así que en noviembre y diciembre no hay saltos, pero el código y los tests cubren marzo y octubre.
- **Idempotencia:** las importaciones de Claude se pueden repetir sin duplicar (claves `albo` y `code`). El plugin nunca crea dos veces la misma línea al "añadir al día" (comprueba si el enlace ya está en ese día).
- **Carreras y conflictos de Sync:** las ediciones son mínimas y atómicas (`vault.process` sobre la línea exacta, `processFrontMatter`). Si la línea ha cambiado desde que se pintó, no se escribe: se avisa y se repinta.
- **Tamaño de archivos:** los `.pmtiles` frente al límite de 5 MB de Sync Standard. Las portadas se bajan en la variante `w600` de Albo, no en el original. Hay que medir la memoria del móvil con el mapa.
- **Offline:** en tiempo de ejecución no se usa la red. Notas, PDF, portadas, mapa, glyphs y sprites son locales. La única excepción es el fondo online opcional.
- **Rendimiento:** MapLibre (alrededor de 1 MB minificado) va en `main.js`, pero solo se instancia al abrir la pestaña Mapa. El índice se actualiza por archivo y nunca recorre todo el vault en cada cambio.
- **Móvil:** no hay `fs` de Node (`Platform.isMobile`), así que `VaultSource` cambia de estrategia. Los objetivos táctiles miden al menos 44 px, y en móvil se reordena con botones en lugar de arrastrar.
- **Seguridad:** el contenido de Albo y Gmail no es de confianza. Se renderiza siempre como texto (Svelte escapa por defecto y está prohibido `{@html}`), y los enlaces abren fuera.
- **Licencias:** la atribución a OSM es visible en el mapa; las fuentes Noto tienen licencia OFL; basemaps es BSD-3/CC0.
- **Lo que no aplica:** webhooks, rate limits propios, email, multi-tenancy y borrado RGPD (son notas locales de Patt).

## Build order

0. **Andamiaje + rebanada vertical** (fea pero completa). Esqueleto del plugin (TypeScript, esbuild, Svelte); `schema.ts` → `types.ts`; parser de frontmatter y de días con tests; `TripIndex`; vista con **Resumen mínimo (S03) + Itinerario de solo lectura (S04)**; harness de desarrollo con un vault de ejemplo (`vault/`, Italia con unos 10 lugares reales de Albo). Así se prueba el stack: abrir "Italia 2026" y ver los días.
   **Spike de mapa en paralelo** (es el mayor riesgo): recorte de Roma con `--dry-run` y real, MapLibre + `VaultSource` en el harness, y prueba en el móvil de Patt (memoria y WebGL).
1. **Must** (`features.csv`), por área:
   - **viajes y plataforma:** S01, S02, S03 con hero, cuenta atrás y viajeros; temas claro y oscuro; móvil.
   - **itinerario:** paradas con hora y nota; reservas intercaladas.
   - **reservas:** `transport` como **TransportCard** (tarjeta de embarque), `stay`, `code`.
   - **documentos:** por viaje y por elemento, barra de esenciales, todo offline.
   - **lugares:** banquillo (S06), ficha (S07), importación de Albo (F01).
   - **mapa:** pins y filtro por día (S05) con PMTiles.
   - **propias:** lugares reutilizables, frontmatter legible, enlaces wiki.
2. **Should:** **SummaryTiles**, **Stepper "Antes del viaje"**, equipaje con progreso, color por día, tramos con modo y tiempo aprox., ruta en el mapa, mapa offline completo, "Añadir al día…", marcar hecho, estado de reserva, "Hoy", imprimir día, importar reservas desde Gmail.
3. **Could:** aviso de tiempo justo, optimizar el orden, filtros por categoría y rating, gastos, calendario, bloques libres, tramos con enrutado real.
4. **Arreglos de `/replica-entrepreneur`**, si se ejecuta: lo que odian los usuarios de Wanderlog, Tripsy y Albo.

Cada hito con sus pantallas:

| hito | pantallas | tipos | superficie |
| --- | --- | --- | --- |
| 0 | S03 (mín.), S04 (lectura) | trip, place, días | `cool-trip-view`, `Abrir viaje` |
| 0b spike | S05 (prototipo) | trip.maps | `VaultSource`, MapLibre |
| 1 | S01, S02, S03, S04, S05, S06, S07, S08, S09, S10 | todos menos expense | vistas, comandos `Nuevo…`, importar Albo |
| 2 | S03 (tiles y stepper), S11, S13 (simple), S14, S15, S16 | + checklist | `Añadir al día…`, `Hoy`, `Imprimir día`, importar reservas |
| 3 | S17 | expense | — |

## Decisiones que necesito de Patt

1. **¿Qué sincronización usa el vault?** Obsidian Sync Standard (límite de 5 MB por archivo), Plus (200 MB), iCloud u otra. Decide cómo llega el mapa al móvil.
2. **¿Cómo escribe Claude en el vault?** Hay tres opciones:
   - (a) copias tú a mano lo que genero en `vault/`;
   - (b) el vault, o una carpeta suya, vive en un repo git (plugin Obsidian Git);
   - (c) me usas desde la app de escritorio con acceso a la carpeta del vault.

   Recomendación: **(a)** para este viaje y **(b)** o **(c)** después.
3. **Fechas reales del viaje** y reparto entre Roma y Palermo (siguen siendo de ejemplo).
4. **Red para el spike:** permitir `build.protomaps.com`, `github.com` y `objects.githubusercontent.com` (para el binario `pmtiles`) si quieres que haga el recorte desde aquí. Si no, te dejo el script.
