# Cool Trip

Plugin de Obsidian para centralizar viajes (privado hasta la 1.0). Cómo está hecho: `docs/arquitectura.md`. El boceto de todas las pantallas está en https://claude.ai/artifact/EREibCe33hATP7gorQ6771. Los tableros de los ajustes, de la nota y de «Nuevo viaje» (ordenador y móvil) no se dibujan a mano: se generan desde el plugin con `node test/harness.mjs && node test/canvas.mjs <carpeta>` y se publican en el canvas; los cambios que Patt haga en ellos se pasan al código. Los tableros dibujados de los ajustes se quedan arriba del canvas como referencia del diseño original. Lo que las pantallas prometen y el plugin aún no hace se apunta en `docs/pendientes.md`, para resolverlo antes de publicar. Los tableros de las bases (filas 5 y 5b) salen de `design/bases/`. El plan para terminar y publicar el plugin está en `docs/publicar.md`.

**Convenciones:** las de `pattgue/cool-bases`, el otro plugin de Patt (repo público): TypeScript sin framework con los helpers de DOM de Obsidian, esbuild, `css/` que se junta en `styles.css`, `i18n.ts` en español e inglés, `test/` con un mock de Obsidian y un harness en Chromium, un `demo-vault/` y lint con `eslint-plugin-obsidianmd`. Sin mapa propio: los mapas se abren en la app del móvil. La configuración va en la pestaña de ajustes del plugin, se adapta a las notas y propiedades que ya existan (sin carpetas ni plantillas obligatorias) y la interfaz usa Inter. Se abre desde la **Cool Bar**, cuyo código común (el Cool Kit: `src/cool-kit/` y `css/cool-kit.css`) se copia tal cual de `pattgue/cool-bases`, **rama `cool-bar`** (no está en `main`). Solo hay dos tipos de nota, viaje y lugar: las reservas, los documentos y el plan de cada día van dentro de la nota del viaje, que escribe el plugin en Markdown y pinta encima con su vista (detalle en `docs/arquitectura.md`). El vault de Patt usa Obsidian Sync Standard, que no sube archivos de más de 5 MB.

**Diseño: regla de Patt.** No se cambian formas, colores, tipografía ni espaciados de nada que Patt no haya pedido o no haya cambiado por su cuenta. Cada ronda del boceto aplica solo los cambios de sus comentarios, sobre la última versión publicada (que puede llevar ediciones suyas). Si algo no cabe, se arregla con el mínimo ajuste y se dice. Las respuestas a las dudas o sugerencias de Patt van en el chat, **nunca como textos dentro de las pantallas del plugin**, que solo llevan lo que vería cualquier usuario. Cada pantalla que se diseñe lleva **su versión móvil** (el plugin se usará sobre todo en el móvil). Lo que rodea a las vistas sale de las **variables del tema de Obsidian**, para que funcione con cualquier tema, claro u oscuro. El billete del viaje lleva su propia paleta sólida, sin transparencias (detalle en `docs/arquitectura.md`). Los ajustes son sobrios; las vistas del viaje, atractivas y divertidas, sin copiar las piezas de los ajustes. El plugin es para el **público general**: nada de Claude ni de otras apps o servicios en las pantallas.

## La guía editable de Patt

Patt no programa: cada proyecto lleva un **documento editable (Claude Docs) que «traduce» todas sus funciones, opciones y
detalles**, con una pestaña por parte del proyecto, en tablas que Patt pueda editar o comentar. Es la fuente de verdad de
lo que hace el plugin, en los dos sentidos: lo que Patt cambie ahí se pasa al código, y lo que cambie en el código se
actualiza ahí. Al empezar una sesión se lee solo lo que haya cambiado desde la última vez (`sinceRev`). De momento existe
la pestaña de las fichas de lugar ([Secciones de cada tipo de lugar](https://claude.ai/artifact/EkfgsgztJTuFJnFLR7wydn),
resumida en `docs/lugares.md`); la guía entera se monta durante la auditoría previa a la 1.0.

## Entorno Cloud (claude.ai/code)

- **Playwright:** Chromium y Playwright ya vienen instalados. No ejecutes `npx playwright install`. Si el proyecto fija otra versión de `@playwright/test`, lanza con `executablePath: '/opt/pw-browsers/chromium'`.
- **Red:** sale por un proxy. `git clone` de repos públicos de GitHub funciona; las descargas de releases de GitHub, no.
- **Cool Bases para `test/bases.mjs`:** `git clone -b cool-bar https://github.com/pattgue/cool-bases`, `npm install` y `npm run build` en esa carpeta.
