# Architecture: Cool Trip (plugin de Obsidian; las apps del recon son referencia, no un original a clonar)

Lee `replica/recon.md` y `replica/features.csv`. Aquí "stack" es la API de plugins de Obsidian: no hay servidor, base de datos, auth ni pagos. El "esquema" son los tipos de nota y su frontmatter (`replica/schema.ts`), y la "API" es lo que el plugin expone dentro de Obsidian (comandos, vistas, bloques) más las operaciones que hace Claude desde fuera.

## Stack

| capa | elección | por qué |
| --- | --- | --- |
| plataforma | API de plugins de Obsidian (`obsidian` 1.14.x en npm), escritorio y móvil | es donde viven las notas; un único `main.js` que funciona en las dos plataformas |
| lenguaje y build | TypeScript + esbuild (plantilla oficial del sample plugin) | lo estándar en plugins, con un build de milisegundos y un solo archivo de salida |
| UI | **TypeScript sin framework**, con los helpers de DOM de Obsidian (`createDiv`, `createEl`), dentro de vistas `ItemView` y bloques de código | lo mismo que `pattgue/cool-bases`: ligero, sin dependencias y con un estilo que Patt ya conoce |
| estilos | carpeta `css/` que esbuild junta en `styles.css` (como Cool Bases), con las **variables del tema de Obsidian** + tokens propios (de `/replica-design`) | respeta el modo claro y oscuro y los temas de Patt; los colores de día y de categoría son tokens |
| idiomas | `i18n.ts` en español e inglés (como Cool Bases) | Patt usa Obsidian en los dos idiomas |
| configuración | **asistente de configuración**: carpetas, propiedades con su tipo, bases (`.base`) y plantillas | el plugin monta el vault; las notas que crea también sirven sin él |
| datos | notas Markdown + frontmatter; índice en memoria construido desde `metadataCache` | Markdown primero: sin el plugin, el viaje sigue siendo legible y consultable con Bases o Dataview |
| escritura | `fileManager.processFrontMatter` y `vault.process` (atómicos, por línea) | no machacar lo que Patt edita a mano ni provocar conflictos de Sync |
| mapa | **enlaces a la app de mapas de Patt** (Google Maps, Apple Maps u Organic Maps) + un **croquis SVG** por día, dibujado con las coordenadas | sin librerías ni teselas: el plugin sigue pesando unos KB; ver §Mapas |
| tiempos entre paradas | estimación local: distancia en línea recta × 1,3 a 5 km/h, marcada como "aprox." | funciona offline y sin API de pago; el enrutado real (OSRM o OpenRouteService) queda como *could* |
| geocodificación | la hace Claude al importar (`geocodeLocation` de Albo y, si falla, Nominatim a 1 petición/s) | el plugin no llama a la red; las coordenadas quedan guardadas en la nota |
| puentes | Claude con conectores (Albo, Gmail, Drive, Calendar) escribiendo notas | Albo no tiene API pública; las mismas reglas de idempotencia que en Tripsy |
| tests | **como en Cool Bases**: `test/` con un *mock* de Obsidian y un *harness* que pinta las vistas del `demo-vault` en Chromium con Playwright; más pruebas unitarias del parser de días y de las zonas horarias | Obsidian no se puede ejecutar en el contenedor Cloud; el harness permite diseñar y testear sin él |
| vault de ejemplo | `demo-vault/` dentro del repo (como Cool Bases), con Italia 2026 | para probar y hacer capturas; el vault real de Patt se monta con el asistente |
| instalación | `npm run build` → copiar `main.js`, `manifest.json` y `styles.css` a `.obsidian/plugins/cool-trip/` (o BRAT desde un release privado) | plugin privado, no se publica en el directorio de la comunidad |

**Descartados:**
- **Un mapa dentro del plugin (MapLibre + PMTiles):** funcionaba sin servidor, pero añadía alrededor de 1 MB al plugin más 10–60 MB de mapa por ciudad. Además, Obsidian Sync Standard, el plan de Patt, no sube archivos de más de 5 MB. Pesaba demasiado para lo que aporta dentro de Obsidian, y las apps de mapas del móvil ya lo hacen mejor.
- **Svelte:** se queda en TypeScript sin framework, como Cool Bases.
- **Map View como dependencia:** compartimos su formato `location`, así que quien lo tenga instalado ve los lugares en su mapa, pero no dependemos de él.

## Mapas: enlaces a tu app + croquis

Cool Trip no lleva mapa propio. Hay tres piezas:

1. **"Abrir en Maps"** en cada lugar, parada y reserva. Usa la app elegida en el asistente:
   - Google Maps: `https://www.google.com/maps/search/?api=1&query=<nombre>%20<ciudad>` (o las coordenadas);
   - Apple Maps: `https://maps.apple.com/?q=<nombre>&ll=<lat>,<lng>`;
   - Organic Maps: su enlace con coordenadas, a confirmar en su documentación.

   En el móvil, Google y Apple abren su app directamente.
2. **"Ruta del día"**: un enlace de direcciones con las paradas en orden y el modo por defecto (a pie). En Google Maps es `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=a|b|c&travelmode=walking`. Según fuentes no oficiales, en el navegador del móvil admite como mucho 3 paradas intermedias y en el resto 9; hay que comprobarlo en el teléfono. Si un día tiene más, se parte en tramos ("Ruta 1/2", "Ruta 2/2"). Para Apple Maps hay que confirmar la sintaxis de paradas de las URLs nuevas (iOS 18.4); si no funciona, se abre parada a parada.
3. **Croquis del día** dentro de Cool Trip: un SVG con los puntos numerados en su posición real (latitud y longitud proyectadas) unidos por una línea en el color del día. No tiene calles ni teselas, pero sirve para ver de un vistazo "esto queda al norte" y funciona siempre, sin conexión.

**Sin conexión:** la hoja de ruta "Antes del viaje" incluye el paso **"Mapas sin conexión"**, con una ciudad por destino. Cada ciudad tiene un botón que abre la app centrada en ella e instrucciones para descargarla:
- Google Maps: foto de perfil → Mapas sin conexión → Selecciona tu propio mapa;
- Apple Maps (iOS 17 o posterior): foto de perfil → Mapas sin conexión;
- Organic Maps: Descargar mapas → región.

Patt marca cada ciudad como hecha.

## Asistente de configuración

Se abre la primera vez o con el comando `Configurar Cool Trip`. Tiene cuatro pasos:
1. **Carpetas:** `Viajes/`, `Lugares/` y `Viajes/{viaje}/Archivos`, editables. El asistente nunca toca notas que ya existan.
2. **Propiedades:** las registra con su tipo en Obsidian (fecha, lista, texto, número, casilla), así que funcionan en Bases y en otros plugins. Los nombres son en español o en inglés y se pueden renombrar en los ajustes.
3. **Mapas:** la app y el modo por defecto entre paradas.
4. **Listo:** crea `Viajes.base`, `Lugares.base` y `Reservas.base` (vistas para usar el vault sin Cool Trip, y compatibles con Cool Bases) y las plantillas de viaje, lugar, transporte y estancia.

Después viene **Nuevo viaje** (nombre, fechas o "sin fechas", destinos con sus fechas, viajeros y portada), que crea `Viajes/<viaje>/<viaje>.md`. Sin foto, la portada se genera con tipografía, como las portadas de Cool Bases.


## Referencias de diseño de Patt y lo que aportan

| referencia | patrón | dónde va en Cool Trip | funciones que añade |
| --- | --- | --- | --- |
| Tarjeta de embarque (cabecera de color, BERLIN · KYIV en grande, número y clase, rejilla de asiento, terminal, puerta, embarque y fecha, línea troquelada, código de barras) | **TransportCard** | S08 y el timeline: cada trayecto es un "billete" con origen y destino enormes (IATA o ciudad), el color de su día y la parte de abajo troquelada con el localizador en grande y un botón al PDF o QR | campos `seat`, `terminal`, `gate`, `boarding`, `class`, `passengers` en el transporte |
| Panel de tiles (Documentos 11 · Equipaje 55/78 · Estancias 4 · Trayectos 13 · Lugares y actividades 45 · Gastos 6522) | **SummaryTiles** | S03, la portada del viaje: seis tiles con un número grande, etiqueta y un objeto ilustrativo; cada tile abre su sección | contadores derivados del índice; **equipaje con progreso** (la checklist `## Equipaje` de la nota del viaje); total de gastos (*could*) |
| Hoja de ruta vertical con "estás aquí" (pasos numerados, línea que los une, CTA abajo) | **Stepper** | dos usos: (1) **"Antes del viaje"** en S03, con pasos calculados de los estados (vuelos → alojamiento → entradas con `needs_booking` → check-in online → documentos esenciales → mapas descargados), donde "estás aquí" es el primer paso sin hacer; (2) el **mismo lenguaje visual en el timeline del día**, con nodos numerados que coinciden con los pins del mapa | la hoja de ruta previa al viaje |

Se adoptan los patrones (jerarquía, ritmo, tipografía grande para lo importante, la metáfora del billete). Las ilustraciones, los textos y los colores serán propios, y los define `/replica-design`. Boceto de todas las pantallas: https://claude.ai/artifact/EREibCe33hATP7gorQ6771

## Schema

Hay 6 tipos de nota (`type:` en el frontmatter) y 1 estructura dentro de la nota del viaje (los días). Las reglas de acceso son "data-layer": el plugin solo lee el vault local de Patt, así que no hay multiusuario. Los tipos completos están en **`replica/schema.ts`**, que pasará tal cual a `src/model/types.ts`.

| type | nota | campos clave | lección del recon |
| --- | --- | --- | --- |
| `trip` | `Viajes/<viaje>/<viaje>.md` | `start`, `end` (fechas; sin ellas el viaje es "sin fechas"), `timezone`, `cover`, `travelers`, `destinations`, `status`, `essentials[]`, `offline_maps[]`, `currency` | Tripsy: `has_dates` es autoritativo |
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
| vista `cool-trip-view` (ItemView) | el viaje en pestañas: **Resumen** (S03), **Itinerario** (S04, con el croquis del día), **Lugares** (S06) y **Reservas y documentos** (S08–S10) | Patt | nota de viaje activa o elegida | vista | F04, F06 |
| vista `cool-trip-list` | lista de viajes, próximos y pasados (S01) | Patt | — | vista | — |
| comando `Abrir viaje` | abre la vista del viaje (la nota activa o un selector) | Patt | — | vista | F05, F06 |
| comando `Nuevo viaje` | modal (S02) que crea la carpeta y la nota con su plantilla | Patt | nombre, fechas o sin fechas, destinos, zona | nota `trip` | — |
| comandos `Nuevo transporte`, `Nueva estancia`, `Nueva entrada` | crea la nota con el `trip` y la zona ya rellenados | Patt | tipo | nota | F03 |
| comando `Añadir al día…` | desde una nota `place`: elige un día (recuerda el último usado) y añade la línea | Patt | día | línea en la nota del viaje | F02 |
| acción en timeline: casilla | marca o desmarca una parada como hecha (`- [x]`) | Patt | clic | línea editada con `vault.process` | F09 |
| acción en timeline: arrastrar (escritorio) o subir/bajar (móvil) | reordena las paradas de un día | Patt | — | líneas reordenadas | F02 |
| comando `Configurar Cool Trip` | asistente: carpetas, propiedades con tipo, app de mapas, bases y plantillas | Patt | — | carpetas, `.base`, plantillas | — |
| acción `Abrir en Maps` y `Ruta del día` | enlace a la app de mapas elegida (lugar, parada, reserva o día entero) | Patt | — | abre la app | F04 |
| comando `Hoy` | vista compacta: próxima parada, siguiente tramo y documentos del día (S14) | Patt | fecha del dispositivo | vista | F05 |
| comando `Validar viaje` | lista los problemas de las invariantes | Patt | viaje | aviso o nota de informe | — |
| comando `Imprimir día` | hoja del día lista para imprimir o guardar como PDF (escritorio) o nota `Hoja del día` (móvil) | Patt | día | PDF o nota | F08 |
| bloque ```` ```cool-trip ```` | incrusta `summary`, `day 2026-12-03`, `croquis` o `roadmap` en cualquier nota | Patt | opciones YAML | render | — |
| ajustes | carpetas de viajes y lugares, nombres de propiedades, app de mapas y modo por defecto, zona por defecto, paleta de días | Patt | — | — | — |

Eventos en lugar de webhooks: `metadataCache.on('changed' | 'resolved')`, `vault.on('rename' | 'delete')` y `workspace.on('css-change')` (para el tema claro u oscuro). Todos actualizan el índice de forma incremental.

No hay jobs en el plugin. "Hoy" y la cuenta atrás se recalculan al abrir la vista y al cambiar de día (con un temporizador mientras la vista está abierta).

**Operaciones de Claude (fuera del plugin, con los conectores de Patt):**

| operación | qué hace | idempotencia | flujo |
| --- | --- | --- | --- |
| `importar-albo <colección> <ciudad>` | una nota `place` por lugar; descarga la portada `w600` al vault (para verla offline); geocodifica | la clave es `albo` (id del extract): si existe, actualiza y no duplica | F01 |
| `importar-reservas <viaje>` | lee las confirmaciones en Gmail y crea notas `transport`, `stay` o `ticket`, con los PDF como `docs` | la clave es `code` + `type` | F07 |
| `calendario <viaje>` (*could*) | eventos en Google Calendar para los trayectos | la clave es `code` | — |

Orden acordado con Patt: **primero el plugin**, que monta las carpetas, propiedades y plantillas con su asistente, y **después las notas**. Las operaciones de Claude escriben con esa misma estructura. Mientras tanto se prueban en `demo-vault/` dentro del repo.

## The parts that bite

- **Zonas horarias:** las horas se guardan como hora local + zona IANA (más fácil de escribir a mano que UTC). Se convierten con `Intl.DateTimeFormat` (sin librerías) y se pintan en la zona del elemento. Un vuelo con llegada al día siguiente cae en el día de llegada. Italia cambió de horario el 25-10-2026, así que en noviembre y diciembre no hay saltos, pero el código y los tests cubren marzo y octubre.
- **Idempotencia:** las importaciones de Claude se pueden repetir sin duplicar (claves `albo` y `code`). El plugin nunca crea dos veces la misma línea al "añadir al día" (comprueba si el enlace ya está en ese día).
- **Carreras y conflictos de Sync:** las ediciones son mínimas y atómicas (`vault.process` sobre la línea exacta, `processFrontMatter`). Si la línea ha cambiado desde que se pintó, no se escribe: se avisa y se repinta.
- **Tamaño de archivos:** Patt usa Sync Standard, que no sube archivos de más de 5 MB. Las portadas se bajan en la variante `w600` de Albo, y los PDF grandes se avisan.
- **Offline:** en tiempo de ejecución no se usa la red. Notas, PDF, portadas y croquis son locales; el mapa sin conexión vive en la app de mapas del móvil.
- **Rendimiento:** sin dependencias pesadas. El índice se actualiza por archivo y nunca recorre todo el vault en cada cambio.
- **Móvil:** los objetivos táctiles miden al menos 44 px, y en móvil se reordena con botones en lugar de arrastrar. Los enlaces de mapas abren la app nativa.
- **Seguridad:** el contenido de Albo y Gmail no es de confianza. Se renderiza siempre como texto (`createEl` con `text`, nunca `innerHTML`), y los enlaces abren fuera.
- **Lo que no aplica:** webhooks, rate limits propios, email, multi-tenancy y borrado RGPD (son notas locales de Patt).

## Build order

0. **Andamiaje + rebanada vertical** (fea pero completa). Esqueleto del plugin, copiando la estructura de Cool Bases (TypeScript, esbuild, `css/`, `i18n.ts`, `test/` con mock y harness); `schema.ts` → `types.ts`; parser de frontmatter y de días con tests; `TripIndex`; vista con **Resumen mínimo (S03) + Itinerario de solo lectura (S04)**; `demo-vault/` con Italia 2026 (1–10 dic) y unos 10 lugares reales de Albo; **asistente de configuración** (S00). Así se prueba el stack: abrir "Italia 2026" y ver los días.
1. **Must** (`features.csv`), por área:
   - **viajes y plataforma:** S01, S02, S03 con hero, cuenta atrás y viajeros; temas claro y oscuro; móvil.
   - **itinerario:** paradas con hora y nota; reservas intercaladas.
   - **reservas:** `transport` como **TransportCard** (tarjeta de embarque), `stay`, `code`.
   - **documentos:** por viaje y por elemento, barra de esenciales, todo offline.
   - **lugares:** banquillo (S06), ficha (S07), importación de Albo (F01).
   - **mapas:** "Abrir en Maps" en lugares, paradas y reservas; croquis del día.
   - **propias:** lugares reutilizables, frontmatter legible, enlaces wiki.
2. **Should:** **SummaryTiles**, **Stepper "Antes del viaje"**, equipaje con progreso, color por día, tramos con modo y tiempo aprox., "Ruta del día" en la app, paso "Mapas sin conexión", "Añadir al día…", marcar hecho, estado de reserva, "Hoy", imprimir día, importar reservas desde Gmail.
3. **Could:** aviso de tiempo justo, optimizar el orden, filtros por categoría y rating, gastos, calendario, bloques libres, tramos con enrutado real.
4. **Arreglos de `/replica-entrepreneur`**, si se ejecuta: lo que odian los usuarios de Wanderlog, Tripsy y Albo.

Cada hito con sus pantallas:

| hito | pantallas | tipos | superficie |
| --- | --- | --- | --- |
| 0 | asistente, S03 (mín.), S04 (lectura) | trip, place, días | `Configurar Cool Trip`, `cool-trip-view`, `Abrir viaje` |
| 1 | S01, S02, S03, S04 (+ croquis), S06, S07, S08, S09, S10 | todos menos expense | vistas, comandos `Nuevo…`, importar Albo |
| 2 | S03 (tiles y stepper), S11, S13 (simple), S14, S15, S16 | + checklist | `Añadir al día…`, `Hoy`, `Imprimir día`, importar reservas |
| 3 | S17 | expense | — |

## Decisiones tomadas (26-10-2026)

1. **Sincronización:** Obsidian Sync Standard (máximo 5 MB por archivo). Fuera el mapa propio, y Cool Trip avisa de los PDF grandes.
2. **Orden:** primero el plugin con su asistente; después las notas, ya con la estructura que crea el plugin.
3. **Fechas:** del 1 al 10 de diciembre de 2026. El reparto (Roma 1–6, Palermo 6–10) y el origen de los vuelos siguen siendo de ejemplo.
4. **Mapas:** enlaces a la app de mapas, descarga sin conexión en el móvil y croquis SVG, en lugar de MapLibre + PMTiles.
