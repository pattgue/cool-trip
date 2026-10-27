# Terminar Cool Trip y publicarlo

Plan para la conversación que deja el plugin listo y lo publica en el directorio de plugins de la comunidad de Obsidian.
Se trabaja por fases y en orden; cada fase acaba con las comprobaciones de siempre (`npm run check`, `npm run lint`,
`npm test`, `node test/harness.mjs`) y una versión nueva para que Patt la pruebe con BRAT en el ordenador y en el móvil.
Las dudas marcadas como **Decide Patt** se le preguntan antes de empezar esa parte.

## Dónde está el diseño (cerrado el 27-10-2026)

Boceto: https://claude.ai/artifact/EREibCe33hATP7gorQ6771. Se lee con la herramienta Artifact (`action: "read"` y, para un
tablero, `path: "project/<Tablero>.dc.html"`). Patt edita el canvas a mano: lo que haya ahí manda.

| Fila del canvas | Qué es | Estado |
|---|---|---|
| 1 · 1b | Ajustes, diseño original | solo referencia |
| 1c · 1d | Ajustes (ordenador y móvil), generados desde el plugin | hechos en el plugin |
| 2 | Nuevo viaje y la nota del viaje (ordenador, móvil y Markdown), generados desde el plugin | hechos en el plugin |
| 3 | El viaje en el escritorio, planteamiento antiguo | descartado |
| 4 | Durante el viaje en el móvil (Hoy, ficha de lugar, mapa sin conexión), planteamiento antiguo | sin cerrar · **Decide Patt** si entra en la 1.0 |
| 5 · 5b | Bases de viajes y de lugares | **diseño cerrado, falta hacerlo en el plugin** |

Los tableros de las bases se generan con `design/bases/` (ver su README); son la especificación visual de la fase 1.

## Fase 1 · Las bases en el plugin

Hoy `baseYaml()` (`src/settings-tab.ts`) crea cada base con una sola tabla. Hay que crear las vistas del canvas, con y sin
Cool Bases, y rehacer las vistas previas del paso 5 de los ajustes para que se parezcan a ellas.

**Base de viajes** (fila 5)
- **Próximos:** viajes que no han acabado, del más cercano al más lejano. La tarjeta lleva: días y noches, la pastilla «EN CURSO» o «EN 38 DÍAS», el país grande a todo el ancho (con tope), las ciudades en ruta (`LISBOA → OPORTO`), los viajeros y las fechas con el año aparte.
- **Viajados:** los que ya acabaron, agrupados por año, del más reciente al más antiguo. Es la misma tarjeta, con «HACE 4 MESES».
- **Todos:** tabla con nombre, fechas, noches, destinos, viajeros y cuándo es. Al pie, la suma de las noches.
- **Mapa:** usa el plugin Maps de Obsidian (`obsidianmd/obsidian-maps`). Pone un marcador por viaje, con su color.
- **Sin Cool Bases:** tarjetas nativas. La portada es el color del viaje (una fórmula que da `#rrggbb`) o la foto de portada si la hay.
- **Con Cool Bases, en el ordenador:** la tarjeta-billete vertical, con el troquel discontinuo y una muesca a cada lado.
- **Con Cool Bases, en el móvil:** el billete apaisado. A la derecha va la matriz con «289 DÍAS», «EN CURSO» o «HACE 4 MESES».
- **Con Cool Bases, con foto:** la foto ocupa la parte de arriba y se funde en el color del viaje.
- **Lo que pide CSS extra (el CSS libre de Cool Bases, lo escribe Cool Trip):** el troquel y las muescas, el tamaño del país ajustado al ancho (`cqi` con tope) y el degradado de la foto a su color (una regla por viaje con `data-path`).
- **Nombre de la nota:** «2026 - Italia», «2026 - Italia y Grecia», o «2026 - Roma y Palermo» si algún destino no tiene país (`autoName()` en `src/modal.ts`). En las tarjetas, el título es ese nombre sin el año.

**Base de lugares** (fila 5b)
- **Guía por ciudad:** tabla agrupada por ciudad y país, con lugar, categoría y precio, valoración, «Visitado» (casilla) y viajes. Con Cool Bases: filas oscuras con el icono de la categoría en su color, estrellas y casilla.
- **Una vista por ciudad** (en el ejemplo, Tokio): tarjetas agrupadas por tipo (Ver, Comer, Pasear; el reparto está en `FAMILY`, en `design/bases/gen2.py`), con la foto del lugar o el color de su categoría. Con Cool Bases es la versión oscura.
- **Mapa:** marcadores con el icono y el color de la categoría. Usa la propiedad de ubicación que ya leen los lugares (`location`, lat,lon).
- **Menú de vistas:** se despliega encima del contenido, como en Obsidian. Las ciudades salen en una sección propia.

**Decide Patt / por comprobar**
1. **Cool Bases:** confirmar con su código (`pattgue/cool-bases`, repo público) que la configuración de una vista se puede escribir desde el `.base` y que admite el CSS libre. Mirar también qué hace con el móvil (para el billete apaisado) y si una fórmula puede dar la imagen de la tarjeta (`data:` SVG, sin verificar).
2. **Foto de los lugares:** hace falta una propiedad nueva de imagen (por ejemplo `cover`). Hay que añadirla en Ajustes › 2 Propiedades.
3. **Coordenadas de los viajes** para su mapa: hoy los viajes no tienen. Opciones: que Cool Trip las escriba al crear el viaje, sacadas de los lugares de su primera ciudad, o quitar el mapa de viajes de la 1.0.
4. **El plugin Maps** es otro plugin y solo funciona con internet. Cuando falte, la vista Mapa no se crea y se explica en el paso 5.
5. **Vistas por ciudad:** ¿Cool Trip las añade solo al crear la base, o también cuando aparece una ciudad nueva?

## Fase 2 · Lo apuntado en `docs/pendientes.md`

Antes de publicar hay que resolver cada punto de esa lista: o se hace la función, o se cambia el texto que la promete. También
queda pendiente la Cool Bar en el móvil (`replica/architecture.md`, decisión 5): ahora no se pinta, y hay que diseñarle una
forma más sutil o dejarla fuera de la 1.0 (**Decide Patt**).

## Fase 3 · Preparar el repositorio para publicar

1. **Repositorio público.** El directorio de Obsidian solo acepta repos públicos y Patt es quien cambia la visibilidad. Antes, hay que revisar lo que quedaría a la vista:
   - el historial y `docs/`, `replica/`, `CLAUDE.md` y `.claude/` (las skills de terceros, con su licencia en `docs/third-party/`);
   - que no haya datos personales ni capturas de apps de terceros.
   
   **Decide Patt** qué se queda.
2. **Licencia.** Hay que añadir `LICENSE` (**Decide Patt**: MIT, como suele hacerse) y cambiar `package.json` (`license`, quitar `private`). Inter ya va con su OFL en `fonts/`, y su aviso se cita en el README.
3. **README en inglés.** Es lo que enseña el directorio. Debe llevar:
   - qué hace, con capturas del canvas o del harness;
   - cómo se usa (ajustes, Nuevo viaje, la nota, las bases);
   - qué otros plugins aprovecha (Cool Bases, Maps; ninguno es obligatorio);
   - que no usa la red;
   - la licencia de Inter.
   
   Las instrucciones de BRAT con token pasan a «Instalar una beta».
4. **`manifest.json`.**
   - La descripción debe tener menos de 250 caracteres, acabar en punto y no decir «Obsidian».
   - Hay que revisar `minAppVersion` según las API que se usan (Bases necesita la 1.10).
   - `version` pasa a `1.0.0`, y `versions.json` se actualiza igual.
   - El `id` `cool-trip` no debe estar ya en `community-plugins.json` de `obsidianmd/obsidian-releases`.
5. **Normas de Obsidian para plugins.** Se repasan las «Plugin guidelines» y la «Submission requirements» de la documentación oficial. `eslint-plugin-obsidianmd` ya cubre la mayoría. Además:
   - nada de `innerHTML`;
   - sin atajos de teclado por defecto;
   - sin `console.log` de sobra;
   - todo evento con `register*`;
   - los estilos, en `styles.css`.
6. **Cool Kit.** Hay que comprobar que `src/cool-kit/` y `css/cool-kit.css` son iguales a los de `pattgue/cool-bases`, rama `cool-bar`. No se editan aquí.
7. **El botón «Ver Cool Bases»** (Ajustes › 5) solo funciona cuando Cool Bases esté publicado. Antes de la 1.0, o se publica Cool Bases primero o se cambia el botón (**Decide Patt**).

## Fase 4 · Versión 1.0.0 y envío

1. Patt prueba la última beta con BRAT en su vault, en el ordenador y en el móvil. Se arregla lo que salga.
2. Se sube la versión 1.0.0 en `manifest.json`, `package.json` y `versions.json`. Se lanza la Action `Release` (etiqueta `1.0.0`, sin «v»), que sube `main.js`, `manifest.json` y `styles.css`.
3. **Envío al directorio:** un PR a `obsidianmd/obsidian-releases` que añade a `community-plugins.json`:
   - `id`, `name`, `author` y `description` (iguales a los del manifest);
   - `repo: "pattgue/cool-trip"`.
   
   La plantilla del PR trae una lista que hay que marcar. Un bot lo valida y luego lo revisa una persona, lo que suele tardar semanas. Lo que pidan se arregla con versiones nuevas.
4. Una vez publicado, se actualiza el README (instalar desde *Complementos de la comunidad*) y se quita lo de BRAT del uso normal.
