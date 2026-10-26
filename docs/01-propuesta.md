# Cool Trip: propuesta de plugin de Obsidian

> Estado: borrador v0 · 2026-10-26
> Laboratorio: el vault personal de Patt · Caso real: **Italia, Nov-Dic 2026** (Roma + Palermo)

## 1. Qué queremos

Una **vista de viaje** dentro de Obsidian, diseñada y fácil de leer de un vistazo, que junte en un solo sitio:

- las **notas de lugares** (qué ver, dónde comer, dónde dormir),
- las **propiedades del viaje** (fechas, viajeros, presupuesto, estado),
- los **documentos esenciales** (billetes, reservas, seguros, DNI/pasaporte),
- la **ruta concreta**: qué pasa cada día, en qué orden y cómo se va de un punto a otro.

Ahora mismo la información está repartida: los lugares en Albo, las confirmaciones en el correo, los PDF en Drive o en descargas y la ruta en la cabeza. La idea es que Obsidian sea **la fuente de verdad** y que el plugin sea **la forma bonita de leerla**.

> **Actualización:** la arquitectura (`replica/architecture.md`) y los tipos (`replica/schema.ts`) sustituyen al modelo de datos del §4. La reserva genérica se divide en `stay`, `transport` y `ticket`. Los días van dentro de la nota del viaje, como listas Markdown, lo que resuelve las decisiones 2 y 3. El mapa no va dentro del plugin: hay enlaces a la app de mapas, una descarga sin conexión guiada en el móvil y un croquis SVG por día. Las fechas son del 1 al 10 de diciembre de 2026. Boceto de todas las pantallas: https://claude.ai/artifact/EREibCe33hATP7gorQ6771

## 2. Qué tomamos de cada app (como referencia)

| App | Qué hace bien | Qué nos llevamos |
|---|---|---|
| **Albo** | Guardar sitios sin esfuerzo (desde un link, TikTok o Google Maps), con foto, categoría, rating y precio. Colecciones como tablero o lista y vista de mapa. | **Fichas de lugar** con imagen de portada, emoji, categoría, rating y `$$`. **Vista tablero por categorías.** Albo sigue siendo la herramienta para capturar, y Obsidian la que organiza. |
| **Wanderlog** | Itinerario día a día con mapa coloreado por día, líneas entre paradas y tiempo/distancia entre ellas. Optimiza el orden de las paradas. | **Color por día** en el mapa y en el timeline. **Tramos entre paradas** con modo de transporte y duración. |
| **Tripsy / TripIt** | Timeline cronológico de reservas (vuelo → traslado → hotel → actividad), con los documentos colgados de cada reserva. Funciona offline. TripIt importa las reservas desde el email. | **Reservas como entidades de primera clase**, cada una con sus adjuntos. **Panel "documentos esenciales"** siempre a mano. Importar desde Gmail (ver §6). |
| **Itini** | Itinerario hecho de bloques (texto, checklist, lugar, link, hora, teléfono) y exportación a PDF por día. | **Bloques de día** sencillos y **exportación a PDF por día** para tener un plan B sin batería ni datos. |
| **Plugins de Obsidian existentes** | *Map View* (esm7): mapas a partir de las coordenadas en el frontmatter, rutas y uso offline. *Wayfarer*: el plan es Markdown y el mapa solo una vista de él, pensado para escribirse con un agente de IA. *Travel Planner*: plantillas de viaje. | **Ser compatibles con Map View** (mismo formato `location`). La filosofía de Wayfarer: **Markdown primero**, el plugin no guarda datos propios. No reinventar lo que ya hace Map View: integrarnos con él o reutilizar su formato. |

**Lo que nos diferencia:** ninguna de estas apps vive dentro de *tus* notas. Aquí un lugar es una nota que puedes enlazar, ampliar y reutilizar en otros viajes. Una cafetería de Roma de 2025 sigue estando ahí en 2026.

## 3. Principios

1. **Markdown primero.** Todos los datos van en notas y frontmatter. Si mañana se desinstala el plugin, el viaje sigue siendo legible (y consultable con Bases o Dataview).
2. **El plugin solo lee y compone.** Edita lo mínimo, como mucho reordenar paradas o marcar algo como hecho, y siempre escribe en el frontmatter.
3. **Offline y móvil.** En el viaje se usa el móvil sin cobertura. Nada crítico depende de la red: los mapas offline son un extra, los documentos se guardan en local.
4. **Formatos estándar.** `location: [lat, lng]` como Map View, fechas ISO y enlaces wiki `[[...]]`.
5. **Diseño cuidado.** Jerarquía clara, imágenes de portada, color por día y buen contraste en modo claro y oscuro (que respete el tema de Obsidian).

## 4. Modelo de datos (borrador)

Cinco tipos de nota, que se distinguen por la propiedad `type`:

```
Viajes/
  Italia 2026/
    Italia 2026.md          ← type: trip
    Días/
      2026-11-28 Roma.md    ← type: day   (opcional: el día también puede ir dentro de la nota del viaje)
    Reservas/
      Vuelo MAD-FCO.md      ← type: booking
      YellowSquare Rome.md  ← type: booking (alojamiento)
    Documentos/             ← PDFs, capturas, QR (adjuntos del vault)
Lugares/
  Roma/
    Galleria Borghese.md    ← type: place  (los lugares viven FUERA del viaje para poder reutilizarse)
```

### 4.1 Viaje (`type: trip`)

```yaml
---
type: trip
title: Italia 2026
start: 2026-11-28
end: 2026-12-08
travelers: [Patt, Alba]
destinations: ["[[Roma]]", "[[Palermo]]"]
status: planning        # idea | planning | booked | ongoing | done
cover: Documentos/portada.jpg
budget: 1200
currency: EUR
albo_collections:
  - c8ce6429-b171-42cf-b29a-4778a685ce6c   # Italia • Nov-Dic 2026
  - 4827bf87-2784-4e8f-8251-1a58f886b2e4   # Palermo trip
essentials:             # lo que tiene que estar a un toque
  - "[[DNI Patt.pdf]]"
  - "[[Seguro viaje.pdf]]"
---
```

### 4.2 Lugar (`type: place`)

Pensado para que se pueda generar automáticamente desde Albo:

```yaml
---
type: place
title: Galleria Borghese
city: "[[Roma]]"
category: museo          # comer | dormir | ver | comprar | tomar algo | museo…
emoji: 🏛️
rating: 4.6
price:                   # $ | $$ | $$$ | $$$$
location: [41.9142, 12.4922]
address: Piazzale Scipione Borghese 5
cover: https://cdn.albo.inc/…jpg
albo: albo://extract/d15c16b3-4b69-44ae-a4cc-1173cc7f387b
needs_booking: true      # "Booking essential"
tags: [arte, bernini, caravaggio]
---
Villa con obras del s. XV al XVIII de Bernini y Caravaggio. **Reserva obligatoria.**
```

### 4.3 Día (`type: day`), que es la ruta

Cada día es una **lista ordenada de paradas** con tramos entre ellas. Hay dos formas posibles (decisión pendiente, §8):

**A. Frontmatter (fácil de leer para el plugin):**

```yaml
---
type: day
trip: "[[Italia 2026]]"
date: 2026-11-29
base: "[[YellowSquare Rome]]"
color: "#E07A5F"
stops:
  - place: "[[Galleria Borghese]]"
    time: "09:00"
    booking: "[[Entrada Borghese]]"
  - move: walk           # walk | metro | bus | train | taxi | flight | ferry
    duration: 20m
  - place: "[[Piazza di Spagna]]"
  - place: "[[Il Margutta]]"
    time: "13:30"
    note: comida
---
```

**B. Markdown (más cómodo de escribir a mano y por la IA):** una lista con enlaces y pequeñas marcas que el plugin interpreta.

```markdown
- 09:00 [[Galleria Borghese]] 🎟 [[Entrada Borghese]]
- 🚶 20 min
- [[Piazza di Spagna]]
- 13:30 [[Il Margutta]] · comida
```

### 4.4 Reserva / trayecto (`type: booking`)

```yaml
---
type: booking
trip: "[[Italia 2026]]"
kind: flight             # flight | train | bus | ferry | lodging | ticket | car
from: MAD
to: FCO
depart: 2026-11-28T07:15
arrive: 2026-11-28T09:45
carrier: …
code: ABC123             # localizador
files: ["[[Tarjeta embarque Patt.pdf]]", "[[Tarjeta embarque Alba.pdf]]"]
links: ["https://…check-in"]
status: confirmed        # idea | pending | confirmed | checked-in
---
```

## 5. Vistas del plugin

1. **Portada del viaje.** Imagen hero, fechas, cuenta atrás, viajeros, destinos y estado. Debajo, una **barra de esenciales** (DNI, seguro, billetes) a un toque y un **resumen de pendientes**: reservas sin confirmar y lugares con `needs_booking` que aún no tienen entrada.
2. **Timeline.** El viaje día a día, en columnas o en una lista vertical en el móvil. Cada día con su color, sus paradas, los tramos entre ellas y las reservas de ese día intercaladas por hora (estilo Tripsy).
3. **Mapa.** Pins coloreados por día y líneas en el orden de la ruta, con filtros por día o categoría (estilo Wanderlog). Usaríamos Leaflet con OpenStreetMap: no hace falta API key y se pueden cachear teselas para usar sin conexión.
4. **Lugares.** Tablero de tarjetas por categoría, con foto, rating y precio (estilo Albo). Incluye los lugares guardados que no están asignados a ningún día, el "banquillo", y se pueden arrastrar a un día.
5. **Modo "Hoy"**, pensado para el móvil durante el viaje: solo el día actual, la próxima parada, el siguiente tramo y los documentos de ese día.
6. **Exportar día o viaje a PDF.** El plan B sin batería.

## 6. El puente con Albo (y Gmail y Drive)

Lo que vimos al revisar tu cuenta:

- La colección **"Italia • Nov-Dic 2026 • Alba"** tiene 44 lugares, todos en Roma (su chat se llama "Roma trip"). **"Palermo trip"** tiene 41.
- Cada lugar trae título, resumen, categoría, rating, precio, emoji, foto de portada y un deeplink `albo://extract/…`. **No trae coordenadas ni dirección**, pero se pueden obtener con la geocodificación de Albo o con OpenStreetMap.
- La colección tiene un campo `trips` que está vacío. Parece que Albo tiene o prepara una función de viajes propia, y conviene vigilarla.

**No hemos encontrado una API pública de Albo**, así que el plugin no puede leer Albo por sí solo. La propuesta es que **Claude haga de puente**, porque tiene acceso a Albo, Gmail, Drive y Calendar con tus conectores:

| Fuente | Qué genera Claude en el vault |
|---|---|
| Colección de Albo | Una nota `type: place` por lugar, con coordenadas geocodificadas, sin duplicar las que ya existan. |
| Gmail (confirmaciones) | Notas `type: booking` con horarios, localizador y links de check-in. |
| Drive / descargas | PDF enlazados en `files` y `essentials`. |
| Google Calendar | (Opcional) crear eventos a partir de los vuelos y reservas. |

Más adelante, esto puede convertirse en una **skill de Claude** ("sincroniza mi viaje") que viva junto al plugin, como hace Wayfarer.

## 7. Hoja de ruta

| Fase | Qué | Cómo sabemos que funciona |
|---|---|---|
| **0. Convención** | Plantillas de nota (trip, place, day, booking). Importar Italia desde Albo a notas reales. Montar una vista provisional con **Bases**, el plugin oficial de Obsidian. | Puedes planificar Roma solo con notas, sin plugin. |
| **1. Portada + Timeline** | Plugin con la vista de viaje en modo lectura (esqueleto TypeScript + esbuild y el template oficial). | Abres "Italia 2026" y ves el viaje entero en una pantalla. |
| **2. Mapa** | Leaflet, pins por día y ruta. | Ves cada día de Roma dibujado. |
| **3. Modo Hoy + móvil + PDF** | Pensado para usar durante el viaje. | Lo usas de verdad durante el viaje a Italia. |
| **4. Puentes** | Skill de sincronización con Albo y Gmail. | Un lugar nuevo guardado en Albo aparece en el vault. |

Con el viaje a finales de noviembre, el objetivo realista es **llegar con las fases 0 y 1, y la 2 si da tiempo**. Lo demás se puede pulir a la vuelta con lo aprendido.

## 8. Decisiones abiertas

1. **Fechas exactas y reparto Roma/Palermo.** Las fechas de este documento son de ejemplo.
2. **La ruta del día, ¿en frontmatter (A) o en Markdown (B)?** Recomendación: **B**, porque es más natural de escribir y de editar en el móvil. El plugin lo parsea, y si hace falta algo estructurado se añade al frontmatter.
3. **¿Una nota por día o los días dentro de la nota del viaje** (con encabezados `## 2026-11-29`)? Recomendación: dentro de la nota del viaje para viajes cortos, aunque esto se puede hacer configurable.
4. **¿Dónde están hoy tus notas de lugares en Obsidian?** Si ya existe una convención, la adoptamos en vez de imponer otra.
5. **Mapas offline:** ¿basta con tener los documentos offline, o el mapa también tiene que funcionar sin conexión?
