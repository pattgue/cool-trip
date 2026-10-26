# Recon map: apps de planificación de viajes → Cool Trip (plugin de Obsidian, escritorio + móvil)

Scope: **la vista de viaje**, es decir, los lugares, la ruta día a día, las reservas (transporte y alojamiento) y los documentos esenciales de un viaje. Quedan fuera la búsqueda de vuelos y hoteles, la parte social y la IA generativa dentro de la app.
For: Patt, uso personal y privado, con su propio vault como laboratorio. Primer caso real: Italia, Nov-Dic 2026 (Roma + Palermo).
Date: 2026-10-26

Esto no es el recon de **una** app, sino de cinco apps de referencia combinadas en un "original compuesto". Cada pantalla, flujo y fila de `features.csv` indica en qué app se ha visto. Se reconstruye la función y el patrón de uso, nunca el código, los iconos, los textos ni la marca de ninguna.

## Sources

Nota sobre el método: la política de red de este entorno bloquea con un 403 los dominios de las apps (`wanderlog.com`, `tripsy.app`, `tripit.com`, `albo.inc`, `apps.apple.com`). Por eso las fuentes se han leído a través del buscador web y no directamente. La confianza baja en consecuencia, salvo en dos casos: la **API pública de Tripsy** (leída en su repositorio de GitHub, con licencia MIT) y la **cuenta de Albo de Patt** (leída con el conector oficial, en solo lectura).

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Albo, cuenta propia (conector) | `albo://` vía MCP de Albo | Colecciones "Italia • Nov-Dic 2026 • Alba" (44 lugares) y "Palermo trip" (41). Campos reales de cada lugar y de la colección. **La mejor fuente.** |
| 2 | Albo, ficha de App Store | https://apps.apple.com/gb/app/albo-save-organise-plan/id6578421992 | Changelog: Trip Planner (1.19.1, sep 2026), rutas sugeridas editables (1.25.1), mapa con filtros (1.11.x), chat de colección y votos. |
| 3 | Albo, web | https://albo.inc/ | "Trip planner" convierte reels y lugares guardados en un viaje por días con ruta. |
| 4 | Albo, capturas de UX | https://screensdesign.com/apps/albo-save-organise/?vs=302870 | 206 pantallas capturadas por terceros. Sirve como referencia visual si Patt la abre; aquí no se ha podido. |
| 5 | Tripsy, API pública | https://docs.api.tripsy.app/ · https://github.com/tripsyapp/cli | **Modelo de datos casi completo**: trips, activities, hostings, transportations, documents, expenses, categories, inbox. Reglas de zonas horarias. |
| 6 | Tripsy, ayuda (documentos) | https://tripsy.help/article/25-adding-documents | Documentos a nivel de viaje y a nivel de actividad. |
| 7 | Tripsy, ayuda (email) | https://tripsy.help/article/45-forwarding-emails-to-tripsy | Al reenviar un email, se adjunta a su actividad. |
| 8 | Tripsy, Pro | https://tripsy.app/pro · https://tripsy.help/article/19-whats-included-with-pro | Funciones de pago: reenvío de email, documentos ilimitados, sincronización con el calendario, tiempo, gastos, alertas de vuelo y exportación. |
| 9 | Tripsy 3.9 | https://alternativeto.net/news/2026/8/tripsy-3-9-adds-smart-routes-multi-stop-travel-planning-saved-addresses-and-timing-alerts/ | Smart Routes, aviso de "Tight Timing", constructor de rutas multiparada, direcciones guardadas, tipos Transfer y Subway. |
| 10 | Tripsy 3.10 | https://tripsy.app/updates | Importa desde capturas de pantalla, emails y listas de mapas. |
| 11 | Wanderlog, ayuda | https://help.wanderlog.com/hc/en-us/articles/5159511810843-Add-a-place-from-a-guide-to-trip-plan | Botón "Add", que añade a la última lista o día editado, con un "Change" para elegir otro destino. |
| 12 | Wanderlog, marketing | https://wanderlog.com/plan-a-trip | Itinerario con reservas, mapa y presupuesto. |
| 13 | Wanderlog, reseñas | https://www.redbrick.me/wanderlog-a-travel-tool-i-cant-live-without/ · https://www.androidpolice.com/2021/06/16/i-finally-found-the-perfect-travel-planning-app/ · https://community.ricksteves.com/travel-forum/general-europe/trial-of-wanderlog-and-tripit-inspired-by-trip-research-post | Secciones o listas como zona de espera antes de asignar días, mapa filtrado por día, color e icono por lista, hora y nota por parada, checklists. |
| 14 | Wanderlog, precio | https://recurdash.com/subscription-pricing/wanderlog · https://www.pilotplans.com/compare/wanderlog-alternative-feature-comparison | Pro (unos 40 $/año): offline, PDF, optimizar ruta, adjuntos ilimitados y Gmail. Hay contradicciones entre fuentes. |
| 15 | TripIt | https://10xtravel.com/tripit-everything-you-need-to-know/ · https://www.pilotplans.com/blog/review-of-tripit | Itinerario maestro montado a partir de emails reenviados o de la sincronización con el buzón. Tipos de plan. Pro: alertas. |
| 16 | Itini | https://mwm.ai/apps/itini-block-based-itinerary/6759225728 · https://saasbrowser.com/mr/saas/1536447/itini | Bloques (texto, checklist, lugar, link, hora, teléfono, imagen), reordenar arrastrando, PDF por día o del viaje entero. **Solo hay agregadores: confianza baja.** |
| 17 | Obsidian Map View | https://github.com/esm7/obsidian-map-view | Formato `location: [lat, lng]` en el frontmatter, mapas offline y rutas. |
| 18 | Wayfarer (plugin de Obsidian) | https://forum.obsidian.md/t/wayfarer-plan-with-your-ai-agent-in-markdown-follow-your-trip-on-your-phone/118266 | Plan en Markdown, el mapa como vista y una skill de IA para escribirlo. Leído solo a través del buscador. |

**Términos:** Albo se ha leído en la cuenta propia de Patt, con su conector oficial y sin escribir nada. El resto son fuentes públicas. Cool Trip es de uso privado, no un producto que compita a la venta.

## Core loop

**Abrir un viaje y ver, en una pantalla, qué toca cada día, dónde está en el mapa y qué papel hay que enseñar.** Es lo que hacen Tripsy y TripIt con las reservas y Wanderlog y Albo con los lugares, y nadie lo hace dentro de tus propias notas.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Lista de viajes | inicio de la app (Tripsy, TripIt, Wanderlog) | elegir un viaje y ver qué viene | tarjeta de viaje con portada, fechas y destino; secciones próximos/pasados | vacío, lleno, viaje en curso |
| S02 | Crear viaje | botón "+" en S01 (Tripsy: nombre, fechas, zona horaria, portada) | dar de alta un viaje | formulario: nombre, fechas o "sin fechas" (`has_dates`), destino, portada | sin fechas, con fechas, error de fechas |
| S03 | Portada del viaje | tocar una tarjeta en S01 (Wanderlog overview, Tripsy trip) | visión de conjunto | hero con portada, fechas, cuenta atrás, viajeros, resumen de reservas, documentos y notas | planificando, en curso, terminado |
| S04 | Itinerario día a día | pestaña "Itinerary" (Wanderlog), timeline (Tripsy), master itinerary (TripIt), Trip Planner (Albo) | la ruta: qué se hace cada día y en qué orden | cabecera de día, elemento con hora e icono de tipo, tramo entre paradas (modo y duración), aviso de tiempo justo (Tripsy) | día vacío, lleno, solapes, viaje sin fechas |
| S05 | Mapa del viaje | pestaña o panel de mapa (Wanderlog, Albo, Tripsy) | ver dónde está todo | pins de color por día o categoría, línea de ruta, filtros de día y categoría, pin del alojamiento | sin coordenadas, un día, todo el viaje, offline |
| S06 | Lugares guardados (banquillo) | listas o secciones (Wanderlog), colección en tablero o lista (Albo) | sitios aún sin día asignado | tarjeta de lugar, agrupación por categoría, filtros (top rated, open now) | vacío, lleno, "hechos" ocultos |
| S07 | Ficha de lugar | tocar un lugar (Albo extract, Wanderlog place) | todo sobre un sitio | foto, emoji, resumen, categoría, rating, precio, dirección, notas, estado (pendiente/hecho), enlaces | sin foto, sin coordenadas, "reserva obligatoria" |
| S08 | Ficha de transporte | tocar un vuelo, tren o transfer (Tripsy transportation, TripIt) | datos del trayecto | origen y destino, cada uno con hora y **su propia zona horaria**, número de servicio, localizador, documentos | sin hora, pendiente, confirmado |
| S09 | Ficha de alojamiento | tocar un hotel (Tripsy hosting) | datos de la estancia | check-in y check-out, dirección, localizador, documentos | — |
| S10 | Documentos | sección de documentos del viaje o de un elemento (Tripsy) | encontrar el papel | lista de documentos con miniatura, título y padre (viaje o elemento); acceso a la URL | vacío, offline, sin permiso |
| S11 | Añadir lugar a un día | botón "Add" (Wanderlog), guardar (Albo) | meter un sitio en el plan | búsqueda, "añadir al último día editado" con opción de cambiar | sin resultados, duplicado |
| S12 | Importar reservas | reenviar email (TripIt, Tripsy), sincronizar Gmail (Wanderlog Pro, TripIt), capturas (Tripsy 3.10) | no teclear las reservas | bandeja de entrada para revisar a mano y asignar a un elemento (Tripsy inbox) | sin asignar, asignado, error |
| S13 | Constructor de ruta multiparada | Tripsy 3.9 | encadenar paradas con transporte | paradas reordenables, modo por tramo, hora de inicio, hora estimada de llegada a cada parada, vista previa en el mapa | tiempo justo |
| S14 | Modo "Hoy" | *guess*: widgets de Tripsy, "Go Now" de TripIt | usar la app durante el viaje | próxima parada, siguiente tramo, documentos del día | antes del viaje, en curso, último día |
| S15 | Exportar a PDF | Itini (viaje o día), Wanderlog Pro | plan B sin batería ni datos | selector "viaje entero / días" | — |
| S16 | Checklists | Wanderlog (listas precargadas), Itini (bloque checklist) | equipaje y pendientes | casillas, progreso | vacío, completo |
| S17 | Presupuesto y gastos | Wanderlog budget, Tripsy expenses (Pro) | controlar el dinero | total, gasto por categoría, moneda | — |

**Capturas de referencia:** no hay ninguna en `replica/screens/`, porque desde aquí no se puede abrir ninguna app. Ver `replica/screens/README.md` para la lista de las que hacen falta.

## Flows

Los clics del camino feliz **no se han medido** porque desde este entorno no hay acceso a las apps. La columna "objetivo" es el número que Cool Trip quiere batir, y se medirá con `/replica-test`.

```
F01 Convertir una colección de Albo en un viaje
    (Albo Trip Planner) colección -> S04 por días con ruta -> S05
    en Cool Trip: Claude lee la colección -> crea notas de lugar (S07) -> nota de viaje (S03) -> S06 con todo en el banquillo
    happy path clicks: no medido · objetivo: 0 clics de Patt (lo hace Claude)
    edge: lugar ya existente en el vault (no duplicar), lugar sin coordenadas, colección con sitios de dos ciudades, nombre con acentos o emoji

F02 Repartir lugares en días
    S06 -> elegir lugar -> "añadir al día X" (Wanderlog: va al último día editado, "Change" para otro) -> S04
    happy path clicks: Wanderlog ~2 (Add + confirmar), según su ayuda · objetivo: 2, o arrastrar en escritorio
    edge: día ya muy lleno, lugar ya asignado a otro día, viaje sin fechas, móvil (sin arrastrar)

F03 Añadir un vuelo con su tarjeta de embarque
    S04/S03 -> nueva reserva -> tipo transporte -> origen y destino con hora y zona horaria -> adjuntar PDF -> S08
    happy path clicks: no medido · objetivo: plantilla + 1 adjunto
    edge: llegada al día siguiente, zonas horarias distintas en origen y destino, vuelo con escala, dos viajeros con dos PDF

F04 Ver un día en el mapa
    S04 -> día X -> S05 filtrado por ese día, con la ruta en orden
    happy path clicks: Wanderlog 1-2 (filtro de día) · objetivo: 1
    edge: paradas sin coordenadas, una sola parada, día sin paradas, sin conexión

F05 Consultar "hoy" durante el viaje (móvil)
    abrir la app -> S14 -> próxima parada -> S07 o S08 -> documento
    happy path clicks: no medido · objetivo: 1 hasta la próxima parada
    edge: fuera de las fechas del viaje, cambio de zona horaria tras un vuelo, sin datos, con la pantalla bloqueada (*guess*: widget)

F06 Enseñar un documento esencial (DNI, tarjeta de embarque, seguro)
    S03 -> barra de esenciales -> documento
    happy path clicks: Tripsy ~3 (viaje -> documentos -> archivo) · objetivo: 2
    edge: PDF que no se ha sincronizado al móvil, documento borrado, imagen en vez de PDF

F07 Importar una confirmación de email
    TripIt/Tripsy: reenviar a una dirección -> se crea o adjunta la reserva -> bandeja para revisar
    en Cool Trip: Claude lee Gmail con el conector -> crea la nota de reserva y adjunta el email o PDF -> Patt revisa
    happy path clicks: TripIt 1 (reenviar) · objetivo: 0-1
    edge: email con varias reservas, idioma, reserva cancelada o modificada después, adjuntos que no son PDF

F08 Exportar un día a PDF
    S04 -> exportar -> elegir días -> PDF (Itini)
    happy path clicks: no medido · objetivo: 2
    edge: día con muchas paradas, imágenes pesadas, modo oscuro

F09 Marcar un lugar como visitado
    S07 -> "hecho" (Albo marca los extracts como completados) -> se atenúa en S04, S05 y S06
    happy path clicks: Albo 1 · objetivo: 1
    edge: desmarcar, lugar que aparece en varios viajes
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Tarjeta de viaje | próxima, en curso, pasada | default, hover, focus | S01 |
| Hero de viaje | con o sin portada | planificando, en curso, terminado | S03 |
| Cuenta atrás | días, "hoy", "en curso: día N de M" | — | S01, S03, S14 |
| Cabecera de día | — | vacío, con N paradas, colapsado, hoy | S04 |
| Elemento de timeline | lugar, transporte, alojamiento, nota | pendiente, hecho, confirmado, con o sin hora, tiempo justo | S04, S14 |
| Chip de tramo | a pie, metro, bus, tren, taxi, avión, ferry | con o sin duración | S04, S13 |
| Aviso de tiempo justo | — | — | S04, S13 (Tripsy) |
| Tarjeta de lugar | grande (tablero), fila (lista) | sin foto, hecho, "reserva obligatoria" | S06, S07, S11 |
| Badge de categoría | por categoría, con emoji | — | S06, S07 |
| Rating y precio | ★ 4.6 · $$ | sin dato | S06, S07 |
| Pin de mapa | numerado por orden, color por día o categoría, alojamiento | seleccionado, hecho | S05 |
| Línea de ruta | color del día | — | S05 |
| Chips de filtro | día, categoría | activo, inactivo | S05, S06 |
| Tile de documento | PDF, imagen, link | offline, falta | S03, S08, S09, S10 |
| Barra de esenciales | — | vacía, llena | S03, S14 |
| Badge de estado | idea, pendiente, confirmado, check-in hecho | — | S08, S09 |
| Hora con zona | local, origen→destino con dos zonas | — | S08 |
| Checklist | — | vacía, parcial, completa | S16 |
| Estado vacío | por pantalla | — | todas |
| Bottom sheet (móvil) | — | abierto, cerrado | S05, S07 |

## Inferred data model

Las entidades y campos combinan Tripsy (la API pública, por eso la confianza es alta) y Albo (la cuenta propia). En Cool Trip, cada entidad es una nota con frontmatter.

```
Trip         name, starts_at (fecha), ends_at (fecha), has_dates, timezone (IANA),
             cover_image_url, travelers, destinations
             evidence: Tripsy API trips (`tripsy trips create --name --starts-at --ends-at
             --timezone --cover-image-url`, `has_dates` es autoritativo)
             confidence: high

Place        title, summary, emoji, category (label libre: "Art museum", "Roman restaurant"...),
             rating, price ($..$$$$), cover_image, deep_link, status (pendiente/hecho),
             wishlisted, pinned, address, latitude, longitude
             evidence: Albo extracts de Patt (títulos, summary, featuredAttributeLabels
             con categoría, rating y precio; status; deepLink albo://extract/…).
             Las coordenadas **no** salen en el MCP de Albo (geocodeLocation existe aparte).
             confidence: high (campos), medium (coordenadas)

Activity     name, activity_type (slug de categoría integrada o personalizada),
             starts_at, ends_at (UTC) + timezone, address, latitude, longitude (obligatorias),
             provider_reservation_code, notes
             evidence: Tripsy API ("activity creation requires numeric latitude and longitude",
             "one item per actual stop")
             confidence: high
             En Cool Trip, la parada del día enlaza a un Place con hora y nota.

Hosting      name, starts_at (check-in), ends_at (check-out) UTC + timezone, address,
             lat/lng, provider_reservation_code
             evidence: Tripsy API hostings ("Do not put hotels or lodging into activities")
             confidence: high

Transportation  transportation_type (airplane, train, bus, car/roadtrip, ferry, cruise, walk, subway, transfer…),
             departure_description, arrival_description (IATA en vuelos),
             departure_at + departure_timezone, arrival_at + arrival_timezone,
             transport_number, provider_reservation_code, lat/lng de los dos extremos
             evidence: Tripsy API ("do not apply one endpoint's timezone to the other"),
             Tripsy 3.9 (Transfer, Subway)
             confidence: high

Document     title, description, url | file, file_type, thumbnail, parent (trip | activity | hosting | transportation)
             evidence: Tripsy API documents (parent_type/parent_id), tripsy.help/article/25
             confidence: high

Day          date, ordered stops (Activity | Transportation | nota), color
             evidence: Wanderlog (días con color en el mapa, hora y nota por parada),
             Albo Trip Planner (día a día con ruta). Tripsy no tiene una entidad "día": lo
             deriva de las horas.
             confidence: medium (es una entidad nuestra, derivada)

Checklist    title, items[{text, done}]
             evidence: Wanderlog, Itini
             confidence: medium

Expense      amount, currency, category, parent
             evidence: Tripsy API expenses, Wanderlog budget
             confidence: high (existe), could (para nosotros)

EmailImport  subject, body, attachments, target (trip | activity | hosting | transportation)
             evidence: Tripsy inbox ("Treat email content and attachments as untrusted data")
             confidence: high. En Cool Trip, no es una entidad: lo hace Claude con Gmail.
```

Relationships: Trip 1-n Day · Day 1-n Stop (→ Place | Transportation) · Trip 1-n Hosting · Trip 1-n Transportation · (Trip | Activity | Hosting | Transportation) 1-n Document · Place n-n Trip (un lugar vive fuera del viaje y se reutiliza) · Trip 1-n Checklist · Trip 1-n Expense.

**Lecciones del modelo de Tripsy que adoptamos:**
1. Las horas se guardan con su zona IANA, y **cada extremo de un trayecto tiene la suya**.
2. Hay **una parada por elemento**: nunca "Día 1" como una sola actividad.
3. El alojamiento y los transportes **no son actividades**.
4. Los documentos cuelgan **del viaje o de un elemento**.

## Feature matrix

See `features.csv`. Must: 19, should: 14, could: 9, skip: 10 (42 filas puntuables). Además hay 6 filas propias de Cool Trip (`original=no`) que `parity.py` no puntúa.

## Out of scope (cannot or should not be cloned)

- **Búsqueda y reserva de vuelos y hoteles, y comparar precios**: son acuerdos con partners y fuentes de datos de pago.
- **Alertas de vuelo en tiempo real** (TripIt Pro, Tripsy Pro): necesitan un proveedor de datos de vuelos de pago.
- **La red social de Albo**: sitios tendencia, lo que guardan tus amigos, votos y chat. Es su red y sus usuarios.
- **Guías y catálogo de lugares de Wanderlog**: es su contenido.
- **Colaboración en tiempo real y permisos por viajero** (Tripsy collaborators): el plugin es personal, y si hiciera falta compartir, ya se ocuparía Obsidian Sync.
- **Integraciones corporativas** (Concur, TripAdvisor).
- **Generación de itinerarios por IA dentro del plugin**: la hace Claude desde fuera, escribiendo en las notas.

## Size

Screens 17, flows 9, entities 8 (+1 que resuelve Claude).

Hard parts:
1. **Mapa en Obsidian, sobre todo en el móvil y sin conexión**: Leaflet dentro de la vista, teselas en caché y rendimiento.
2. **Leer y reescribir la ruta del día en Markdown** sin romper lo que Patt escribe a mano (reordenar o marcar como hecho).
3. **Zonas horarias** por elemento y por extremo de cada trayecto.
4. **Tiempo entre paradas** sin una API de pago: estimarlo a pie con la distancia, o usar OSRM o OpenRouteService con sus límites.
5. **Importar desde Albo**: no tiene API pública. Lo hace Claude con el conector y geocodifica las coordenadas, que Albo no da.

Size: **M** (unas semanas) para los must. Antes del viaje es realista llegar a portada, timeline, fichas, documentos y la importación desde Albo. El mapa queda en el límite.

## Hallazgo a tener en cuenta

Albo **ya tiene un Trip Planner** (sep 2026) que arma días con ruta a partir de los lugares guardados. Cool Trip no compite con eso. Albo sigue siendo el sitio para **capturar** y bocetar la ruta, y Cool Trip es donde viven **las reservas, los documentos y las notas**, que Albo no cubre. El MCP de Albo devuelve `trips: []` en la colección de Italia; si Patt arma el viaje en Albo, Claude podría intentar importarlo desde ahí, aunque el MCP no expone ninguna herramienta específica para leer viajes.
