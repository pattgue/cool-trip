# Arquitectura de Cool Trip

Plugin de Obsidian sin framework: TypeScript con los ayudantes de DOM de Obsidian (`src/dom.ts`, nunca cadenas HTML), esbuild,
`css/` que se junta en `styles.css`, textos en español e inglés. Las funciones, opciones y textos que ve quien lo usa están en la
guía editable de Patt (ver `CLAUDE.md`); aquí está cómo está hecho.

## El modelo

- **Dos tipos de nota: viaje y lugar.** Se reconocen por carpeta (por defecto), propiedad o etiqueta (`src/settings.ts`).
- **El viaje es una nota de Markdown que el plugin escribe y pinta encima**, como Kanban. Las reservas, los documentos, la
  maleta, las tareas, el presupuesto, el color y el plan van en el cuerpo, en un formato legible (`docs/propiedades.md` › «Lo que
  va dentro de la nota del viaje»). Si se desactiva el plugin, la nota sigue completa.
- **El lugar** tiene sus propiedades (ciudad, categoría, coordenadas…) y, con la ficha activada, secciones `##` según su tipo
  (`docs/lugares.md`).
- **La regla de las propiedades:** solo se escribe lo que rellenas, nunca vacías; lo que no es de Cool Trip se deja como está, y
  las propiedades que no cambian se escriben tal cual estaban (`docs/propiedades.md`).
- **Sin red**, salvo la búsqueda de coordenadas en OpenStreetMap si está activada (`src/geo.ts`). Los mapas se abren en la app
  de mapas del móvil.

## El código

| Archivo | Qué hace |
|---|---|
| `main.ts` | El plugin: registra las vistas, los comandos y la Cool Bar, y abre los viajes y lugares con su vista |
| `view.ts` | La vista del viaje (`TextFileView` sobre el `.md`): lee la nota, la pinta y la vuelve a escribir con cada cambio |
| `md.ts` | El Markdown del viaje: `parseTrip` y `serializeTrip` (lo que no entiende lo respeta), los pasos y los documentos |
| `prices.ts` | Precios y monedas: el número, el símbolo, cómo se escriben y la moneda del viaje |
| `ticket.ts` | La tarjeta de embarque: en «Nuevo viaje» y arriba de la nota |
| `plan.ts` · `plan-drag.ts` | El plan día a día (pasos, reservas, huecos) y el arrastre de pasos |
| `forms.ts` | Los formularios del plan, en su sitio, sin ventanas |
| `side.ts` · `docs.ts` | El lateral (mochila, maleta, por hacer, coste) y los documentos |
| `modal.ts` | «Nuevo viaje» |
| `placeview.ts` · `place-page.ts` · `place-types.ts` | La ficha de lugar: la vista, la página y las secciones de cada tipo con su formato |
| `places.ts` | Las notas de lugar: encontrarlas, crearlas, su tipo (icono, color y grupo) y el enlace a la app de mapas |
| `geo.ts` | Las coordenadas en OpenStreetMap |
| `bases.ts` · `bases-css.ts` · `keeper.ts` | Las bases de viajes y lugares: fórmulas, vistas y el CSS de Cool Bases; `keeper` las mantiene al día |
| `settings.ts` · `settings-tab.ts` · `settings-steps/` | Los ajustes: valores por defecto, la pestaña y un archivo por paso |
| `i18n.ts` · `i18n/es.ts` · `i18n/en.ts` | Los textos, uno por idioma |
| `types.ts` · `dates.ts` · `dom.ts` · `ui.ts` · `prompt.ts` | Tipos, fechas sin zona horaria, el DOM, piezas pequeñas y la ventanita de texto |
| `cool-kit/` | La Cool Bar común de los plugins Cool. Se copia tal cual de `pattgue/cool-bases`, rama `cool-bar`; no se edita aquí |

Los estilos van en `css/`, uno por pantalla (`ticket`, `plan`, `side`, `forms`, `place`, `settings`), sobre las variables del tema
de Obsidian. El billete y la cabecera de lugar llevan su propia paleta sólida.

## Lo delicado

- **No perder nada al guardar.** `parseTrip` → `serializeTrip` es estable (hay prueba): lo que no es de Cool Trip va a `intro`,
  `outro`, `raw` o `extra` y se vuelve a escribir igual.
- **Cambios desde fuera** (Sync, otro plugin): las vistas vuelven a leer la nota cuando cambia; la ficha de lugar guarda al
  momento para no pisar propiedades tocadas después.
- **Las bases son del usuario.** `keeper.ts` solo reescribe lo que es de Cool Trip (sus fórmulas y el bloque marcado de su CSS),
  y solo cuando cambia un viaje o un lugar.
- **Móvil.** Todo tiene versión móvil; se decide por `Platform.isPhone` o por el ancho de la vista (menos de 760 px).

## Pruebas

| Orden | Qué comprueba |
|---|---|
| `npm test` (`test/unit.mjs`) | El Markdown del viaje y de la ficha de lugar, los ajustes y las fórmulas de las bases, sin Obsidian |
| `node test/harness.mjs` | Pinta la nota, «Nuevo viaje», los ajustes y las fichas de lugar en Chromium con un Obsidian falso, y comprueba que no hay errores |
| `node test/canvas.mjs <carpeta>` | Genera desde el plugin los tableros del canvas de diseño |
| `node test/bases.mjs <cool-bases> [<carpeta>]` | Pinta las bases con el Cool Bases de verdad y, con la carpeta del canvas, escribe sus tableros |
| `node test/readme-shots.mjs` | Las capturas del README (`docs/img/`), en tema claro, después de `node test/harness.mjs light` |

En GitHub, `.github/workflows/ci.yml` pasa los tipos, el lint, las pruebas y la compilación en cada subida; `release.yml` crea la
Release cuando se sube una etiqueta `x.y.z` igual a la versión de `manifest.json`.
