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
| configuración | **pestaña de ajustes** del plugin: cómo reconoce tus notas (propiedad, etiqueta o carpeta), qué propiedades usa (las tuyas o las sugeridas), archivos, mapas y bases (`.base`). Sin plantillas | el plugin se adapta al vault y no al revés; las notas también sirven sin él |
| datos | notas Markdown + frontmatter; índice en memoria construido desde `metadataCache` | Markdown primero: sin el plugin, el viaje sigue siendo legible y consultable con Bases o Dataview |
| escritura | `fileManager.processFrontMatter` y `vault.process` (atómicos, por línea) | no machacar lo que Patt edita a mano ni provocar conflictos de Sync |
| mapa | **enlaces a la app de mapas de Patt** (Google Maps, Apple Maps u Organic Maps) + un **croquis SVG** por día, dibujado con las coordenadas | sin librerías ni teselas: el plugin sigue pesando unos KB; ver §Mapas |
| tiempos entre paradas | estimación local: distancia en línea recta × 1,3 a 5 km/h, marcada como "aprox." | funciona offline y sin API de pago; el enrutado real (OSRM o OpenRouteService) queda como *could* |
| geocodificación | la hace Claude al importar (`geocodeLocation` de Albo y, si falla, Nominatim a 1 petición/s) | el plugin no llama a la red; las coordenadas quedan guardadas en la nota |
| puentes | Claude con conectores (Albo, Gmail, Drive, Calendar) escribiendo notas | Albo no tiene API pública; las mismas reglas de idempotencia que en Tripsy |
| tests | **como en Cool Bases**: `test/` con un *mock* de Obsidian y un *harness* que pinta las vistas del `demo-vault` en Chromium con Playwright; más pruebas unitarias del parser de días y de las zonas horarias | Obsidian no se puede ejecutar en el contenedor Cloud; el harness permite diseñar y testear sin él |
| vault de ejemplo | `demo-vault/` dentro del repo (como Cool Bases), con Italia 2026 | para probar y hacer capturas; el vault real de Patt se configura en Ajustes › Cool Trip |
| instalación | `npm run build` → copiar `main.js`, `manifest.json` y `styles.css` a `.obsidian/plugins/cool-trip/` (o BRAT desde un release privado) | plugin privado, no se publica en el directorio de la comunidad |

**Descartados:**
- **Un mapa dentro del plugin (MapLibre + PMTiles):** funcionaba sin servidor, pero añadía alrededor de 1 MB al plugin más 10–60 MB de mapa por ciudad. Además, Obsidian Sync Standard, el plan de Patt, no sube archivos de más de 5 MB. Pesaba demasiado para lo que aporta dentro de Obsidian, y las apps de mapas del móvil ya lo hacen mejor.
- **Svelte:** se queda en TypeScript sin framework, como Cool Bases.
- **Map View como dependencia:** compartimos su formato `location`, así que quien lo tenga instalado ve los lugares en su mapa, pero no dependemos de él.

## Mapas: enlaces a tu app + croquis

Cool Trip no lleva mapa propio. Hay tres piezas:

1. **"Abrir en Maps"** en cada lugar, parada y reserva. Usa la app elegida en Ajustes › Mapas:
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

## Cambio de modelo (ronda 2 del boceto, 26-10-2026)

Patt lo dejó claro en los comentarios de la ronda 2. Esto manda sobre lo que diga más abajo hasta que se rehaga el schema:

1. **Solo hay dos tipos de nota: viaje y lugar.** Las reservas (vuelos, trenes, alojamientos, entradas), los documentos y el plan de cada día **no son notas sueltas**: son secciones dentro de la nota del viaje. Una nota por reserva era "muchísimo ruido por cada viaje". Desaparecen las notas `stay`, `transport` y `ticket`, la base `Reservas.base` y la vista de reservas como notas aparte. Sus campos (`schema.ts`) pasan a ser la forma de cada bloque dentro de la nota.
2. **El plugin escribe la nota; tú no escribes Markdown.** Cool Trip tiene formularios sencillos para fechas, días, horas, lugares, reservas y documentos. Con lo que rellenas, escribe el cuerpo de la nota del viaje en un Markdown estructurado y legible (`## Plan`, `### 3 dic · Roma`, `- 09:00 [[Galleria Borghese]]`, `## Reservas`, …), y lo pinta encima con una vista diseñada. Por ser Markdown real, los enlaces salen en el grafo y en los backlinks, el texto se encuentra con el buscador y, si se desactiva el plugin, la nota sigue completa.
3. **Sin interruptor "ver como texto".** La nota de viaje se abre siempre diseñada mientras el plugin esté activo. El Markdown es la copia de seguridad para cuando no lo esté. El precedente técnico es el plugin Kanban: un archivo `.md` normal que se abre en una vista propia y que la vista reescribe.
4. **Destinos sin notas de ciudad.** El plugin trae una lista de ciudades y países, con coordenadas, zona horaria y país, que no se guarda en el vault como notas. `destinos` y `ciudad` se rellenan eligiendo de esa lista. La lista da la zona horaria, el centro para "Abrir en Maps" y descargar el mapa sin conexión, y agrupa los lugares por destino. *Por decidir:* el tamaño. Una estimación es que GeoNames, con las ciudades de más de 100 000 habitantes, cabe en unos cientos de KB; es CC BY 4.0, así que hay que atribuirla.
5. **Cool Bar.** Se abre desde el botón COOL TRIP de la Cool Bar, la barra que comparten todos los "Cool Plugins" de Patt, o con el comando `Cool Trip: Nuevo viaje`. No tiene icono propio en la cinta lateral. Su código común es el **Cool Kit**, que está en `pattgue/cool-bases`, rama `cool-bar`: `src/cool-kit/` y `css/cool-kit.css` (ver "Cool Kit" más abajo).

## Ajustes de Cool Trip (ronda 3, cerrada con Patt)

La configuración vive en **Ajustes › Complementos de la comunidad › Cool Trip** (un `PluginSettingTab`), con la misma estructura en escritorio y en móvil. Cada cambio se guarda al momento (`saveData` en cada `onChange`) y el pie lo indica con "Guardado automático.". En escritorio, **cada paso cabe en la pestaña sin scroll**; está medido en Chromium. En móvil, los pasos son solo números: siete círculos como los del ordenador, en una fila sin scroll horizontal. Los pasos ya configurados llevan el número en verde. Los desplegables siempre se superponen a lo de debajo; nunca empujan el contenido como un acordeón.

1. **Tus notas:** una tarjeta para Viajes y otra para Lugares. El icono es cuadrado y ocupa el alto de la tarjeta. Cada tarjeta permite elegir si se reconoce por propiedad = valor, etiqueta o carpeta. **Debajo** de cada tarjeta va "Los nuevos se guardan en", un desplegable con el árbol de carpetas del vault (la raíz, las existentes y "Organización automática"). La organización automática enseña una vista previa como el explorador de Obsidian y se elige con el botón "Usar organización automática", con una carita, al final de la sección. Organiza así:
   - **viajes:** una sola nota por viaje, sin carpeta propia, todas juntas en `Viajes/`;
   - **título sugerido del viaje:** empieza por el año ("2027 Japón"), para que se ordenen solos;
   - **lugares:** agrupados por ciudad (`Lugares/Tokio/`).
2. **Propiedades:** filas de una línea, con el dato y para qué sirve, el tipo, tu propiedad y el estado, y `*` en las necesarias.
   - **Viaje:** empieza\*, termina\* (fecha), destinos\* (lista, de la lista de ciudades), quién viaja (lista), portada (texto).
   - **Lugar:** ubicación\* (lista), ciudad\* (texto), **país** (se rellena solo con la ciudad), categoría (texto), **precio** (texto: entrada o precio medio), valoración (número), visitado (casilla).
   - **El tipo no se puede elegir:** en Obsidian el tipo de una propiedad es único para todo el vault, así que cambiarlo desde Cool Trip afectaría a todas las notas. Además, el plugin necesita, por ejemplo, fechas de verdad.
   - **Destinos se queda como propiedad:** así se puede filtrar y agrupar en Bases y en Cool Bases, y alimenta los mapas sin conexión. El cuerpo de la nota no se puede consultar desde Bases.
3. **Archivos:** las tarjetas de opción y, en móvil, la vista previa arriba del todo.
   - **Opciones:** nube, cartera del móvil, "carpeta de tu dispositivo" y dentro del vault.
   - **Aviso en la de nube:** compartir el archivo solo contigo, nunca con "cualquiera con el enlace".
   - **Vista previa:** sin la línea repetida de "descargado".
4. **Mapas:** app y modos de moverse (casillas).
   - **Por tramo:** cada tramo se abre con su modo (Google `travelmode`, Apple `dirflg`).
   - **Ruta del día entera:** usa un solo modo, porque las apps solo admiten uno por ruta.
5. **Bases:** recomendación del plugin Cool Bases con su icono real (`lucide-id-card`, el de `registerBasesView` en Cool Bases), vistas previas sin y con Cool Bases, y una carpeta por base.
6. **Cool Bar** (nuevo): la sección común del Cool Kit (`renderCoolBarSettings`), la misma en todos los plugins Cool.
   - **Pestañas** Ordenador y Móvil.
   - **Ubicación:** arriba o abajo de la pestaña, o flotante.
   - **Alineación** y **modo:** fija, contextual o escondida.
   - **Plegada.**
   - **Botones:** cuándo se ve cada uno (siempre, solo cuando aplica, nunca) y en qué orden.
   - **Vista previa** de la barra real en una nota de viaje: COOL TRIP disponible y COOL BASES bloqueado, porque ahí no aplica.
7. **Listo:** el Markdown que se guarda frente a la misma nota pintada, con un **viaje de ejemplo inventado**: 2027 Japón, del 3 al 14 de abril de 2027, Tokio y Kioto, Ana y Leo, 12 días de viaje, empieza en 159 días contando desde el 26-10-2026, y el vuelo MAD → NRT con localizador K7QX2P.
   - **Tres pasos:** crea un viaje desde la Cool Bar, rellénalo y Cool Trip lo monta todo.
   - **Lo que añade y lo que no toca.**
   - **Botón "Listo".**
   - **Pendiente:** la estructura del Markdown se redefinirá al diseñar el contenido de la nota del viaje.

### Cool Kit

Cool Trip se une a la Cool Bar copiando tal cual `src/cool-kit/` y `css/cool-kit.css` de `pattgue/cool-bases` (rama `cool-bar`, `KIT_VERSION = 1`) y llamando a `joinCoolKit(this, { id, label, appliesTo, isOpen, toggle, saveShared, loadShared })` en `onload()`.
- **`appliesTo`:** la pestaña muestra una nota de viaje o de lugar.
- **`toggle`:** abre o cierra el panel de Cool Trip.
- **Ajustes de la barra:** se guardan en `coolBar`, dentro del `data.json` de cada plugin Cool, y gana la copia más reciente.
- **Pestaña de ajustes:** llama a `renderCoolBarSettings(containerEl)` para pintar la sección común.

**Diseño de los ajustes:** es el del boceto de Patt (Inter, sus tarjetas y colores). Del Cool Kit solo se toman la configuración común de la barra y el aspecto de la propia Cool Bar, tal como la pinta `css/cool-kit.css`. Un intento de pasar todos los ajustes al sistema visual de Cool Bases (Inter Tight y las variables `--cool-*`) se deshizo: Patt no lo había pedido.

**Sin plantillas.** "Nuevo viaje" escribe la nota con las propiedades elegidas en el paso 2.

**Idioma:** el de Obsidian (`getLanguage()`, como `i18n.ts` de Cool Bases), en español o inglés. Los nombres sugeridos de propiedad siguen ese idioma.

**Tipografía:** Inter en toda la interfaz del plugin (petición de Patt). Hay que comprobar si Obsidian ya la incluye; si no, se embebe un subconjunto latino en `styles.css`, nunca descargado de internet.

### Archivos: billetes y PDFs fuera del vault

Lo esencial de cada reserva (localizador, horas, asiento, puerta) es **texto dentro de la nota del viaje**: no pesa nada, se sincroniza con el vault y se ve sin conexión. El archivo es solo un enlace de respaldo, y cada persona marca qué sitios usa:

| dónde | cómo lo usa Cool Trip | sin conexión en el móvil |
| --- | --- | --- |
| nube (Drive, iCloud, Dropbox): recomendado | enlace al archivo. "Antes del viaje" recuerda descargarlo en la app de la nube | sí, si se ha descargado en esa app (*por comprobar* que el enlace abre la copia local) |
| cartera del móvil (Apple/Google Wallet) | un botón "Abrir Wallet" abre la app, y el billete se elige desde ahí. No hay un enlace público a un pase concreto. En iOS sería `shoebox://`, que no está documentado; en Android, el enlace de Google Wallet (*por comprobar los dos*) | sí |
| carpeta del ordenador | enlace `file://` | no (solo en ese ordenador) |
| dentro del vault | carpeta elegida | sí, si se sincroniza el vault; ocupa espacio |


## Nuevo viaje y la nota del viaje (desde cero, paso a paso con Patt)

**Ronda 1, descartada (27-10-2026).** El panel estrecho de 440 px colgando de la Cool Bar (copiado del de Cool Bases) y las dos láminas de Markdown no gustaron a Patt: no se entendía y era feo. Que se abra desde la Cool Bar no obliga a que sea un panel lateral estrecho: el tamaño y el layout se adaptan a lo que necesita esta pantalla. Se quitó del boceto entero.

**Lo que se busca:** la sencillez y la accesibilidad de los ajustes (Inter, fondo de Obsidian, morado `#6b58e6` para la acción principal, números verdes `#47BE88` en lo hecho), con mucha más personalidad y un toque divertido. Referencias visuales de Patt: tiles grandes y redondeados en crema y negro, colores planos atrevidos (naranja, lila, rosa) con una forma orgánica tipo flor, pastillas de días y una cabecera de color con mucho tamaño de letra.

**Paso 1, elegir dirección** (fila 2 del boceto; todas con el viaje de ejemplo 2027 Japón, Tokio 6 noches y Kioto 5, Ana y Leo):
- **A · Billete:** modal centrado. El formulario es una tarjeta de viaje crema con cabecera del color de la portada, destinos enormes, ida, vuelta, días y noches en rejilla, el reparto como fila de días y un talón troquelado con el nombre de la nota, los viajeros, la portada y «Crear viaje».
- **B · Tiles:** modal ancho. Una portada viva en color con flor y avatares a la izquierda; a la derecha, cuatro tiles grandes (Destinos\*, Fechas\*, Viajeros, Portada) con su número verde al rellenarse, y debajo el reparto como pastillas de día.
- **C · Pregunta a pregunta:** se abre como pestaña. Una pregunta enorme cada vez (Destinos → Fechas → Viajeros → Portada), con los números de los ajustes como pasos; en Fechas, un calendario pintado por ciudad con el reparto. A la derecha, la portada se va montando sola.

**Elegida: A · Billete** (27-10-2026). Patt la ve bien como resumen de lo básico del viaje (las propiedades), pero insuficiente por sí sola: faltan los lugares, las reservas y sus archivos, los documentos y el horario de cada día. *Por decidir con Patt:* si eso se añade después, desde la vista del viaje (propuesta), o como pasos opcionales al crear.

Después, por orden: los detalles de la dirección elegida, el móvil y la estructura Markdown de la nota.

**Datos que recoge** (sin cambios): destinos\* (lista de ciudades del plugin), empieza\* y termina\* (fecha), reparto de noches por destino si hay dos o más, quién viaja, portada (color o imagen) y el nombre de la nota, sugerido con el año delante («2027 Japón») en la carpeta del paso 1 de los ajustes. Solo salen los campos cuya propiedad esté en uso en el paso 2, y la nota se marca como viaje según el paso 1.

**La nota en Markdown: por definir con Patt.** Punto de partida, que a Patt le pareció bien a simple vista: frontmatter con las propiedades de los ajustes; un resumen en callout que reescribe el plugin; `## Plan` con un `### Día · ciudad` por día y una lista de paradas (`- 16:30 [[Senso-ji]]`), tramos y enlaces a reservas; `## Reservas`, y `## Documentos` y `## Equipaje` solo cuando tienen algo; datos solo del plugin en un comentario `%% … %%`. Queda abierto el formato de los encabezados de día que lee el parser.

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

Los nombres de campo de esta tabla son los internos. En el vault, cada uno se mapea a la propiedad que Patt elija en Ajustes › Propiedades, y la columna "nota" es solo el orden sugerido opcional: el plugin reconoce las notas por propiedad, etiqueta o carpeta (Ajustes › Tus notas).

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
| comando `Nuevo viaje` | modal (S02) que crea la nota del viaje con las propiedades elegidas en ajustes (sin plantillas) | Patt | nombre, fechas o sin fechas, destinos, zona | nota `trip` | — |
| comandos `Nuevo transporte`, `Nueva estancia`, `Nueva entrada` | crea la nota con el `trip` y la zona ya rellenados | Patt | tipo | nota | F03 |
| comando `Añadir al día…` | desde una nota `place`: elige un día (recuerda el último usado) y añade la línea | Patt | día | línea en la nota del viaje | F02 |
| acción en timeline: casilla | marca o desmarca una parada como hecha (`- [x]`) | Patt | clic | línea editada con `vault.process` | F09 |
| acción en timeline: arrastrar (escritorio) o subir/bajar (móvil) | reordena las paradas de un día | Patt | — | líneas reordenadas | F02 |
| comando `Ajustes de Cool Trip` | abre la pestaña de ajustes: reconocer notas, propiedades, archivos, mapas, bases | Patt | — | `.base` opcionales; carpetas solo si se piden | — |
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

Orden acordado con Patt: **primero el plugin**, configurado en su pestaña de ajustes para adaptarse a las notas y propiedades que ya haya, y **después las notas**. Las operaciones de Claude escriben con esa misma estructura. Mientras tanto se prueban en `demo-vault/` dentro del repo.

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

0. **Andamiaje + rebanada vertical** (fea pero completa). Esqueleto del plugin, copiando la estructura de Cool Bases (TypeScript, esbuild, `css/`, `i18n.ts`, `test/` con mock y harness); `schema.ts` → `types.ts`; parser de frontmatter y de días con tests; `TripIndex`; vista con **Resumen mínimo (S03) + Itinerario de solo lectura (S04)**; `demo-vault/` con Italia 2026 (1–10 dic) y unos 10 lugares reales de Albo; **pestaña de ajustes** (S00, seis secciones). Así se prueba el stack: abrir "Italia 2026" y ver los días.
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
| 0 | ajustes, S03 (mín.), S04 (lectura) | trip, place, días | `Ajustes de Cool Trip`, `cool-trip-view`, `Abrir viaje` |
| 1 | S01, S02, S03, S04 (+ croquis), S06, S07, S08, S09, S10 | todos menos expense | vistas, comandos `Nuevo…`, importar Albo |
| 2 | S03 (tiles y stepper), S11, S13 (simple), S14, S15, S16 | + checklist | `Añadir al día…`, `Hoy`, `Imprimir día`, importar reservas |
| 3 | S17 | expense | — |

## Decisiones tomadas (26-10-2026)

1. **Sincronización:** Obsidian Sync Standard (máximo 5 MB por archivo). Fuera el mapa propio, y Cool Trip avisa de los PDF grandes.
2. **Orden:** primero el plugin con sus ajustes; después las notas. El plugin se adapta a las notas y propiedades que ya existan, sin carpetas ni plantillas obligatorias.
3. **Fechas:** del 1 al 10 de diciembre de 2026. El reparto (Roma 1–6, Palermo 6–10) y el origen de los vuelos siguen siendo de ejemplo.
4. **Mapas:** enlaces a la app de mapas, descarga sin conexión en el móvil y croquis SVG, en lugar de MapLibre + PMTiles.
