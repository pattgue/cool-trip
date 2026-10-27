# Cool Trip

Plugin privado de Obsidian para tener cada viaje centralizado en una nota: una portada como tarjeta de embarque y el plan día a día con reservas, documentos, comidas y coste.

- Propuesta y modelo de datos: [docs/01-propuesta.md](docs/01-propuesta.md)
- Arquitectura y diseño cerrados con Patt: [replica/architecture.md](replica/architecture.md)
- Notas para Claude y skills Replica instaladas en el proyecto: [CLAUDE.md](CLAUDE.md)

## Instalarlo en tu vault

**Con BRAT (sin copiar archivos, también en el móvil):**

1. Instala el plugin de la comunidad **BRAT** (Obsidian42 - BRAT) y actívalo.
2. Como el repositorio es privado, BRAT necesita un token de GitHub: en github.com › Settings › Developer settings › Personal access tokens › Fine-grained tokens, crea uno con acceso de solo lectura a `pattgue/cool-trip` (*Contents: Read-only*). Pégalo en BRAT › *Personal GitHub Access Token*.
3. BRAT › *Add Beta plugin* › `pattgue/cool-trip`. Activa Cool Trip en Complementos de la comunidad.

BRAT descarga la última Release. Cada versión nueva (`manifest.json` + una etiqueta `x.y.z`) la crea la Action `Release`, y BRAT la actualiza sola.

**A mano:** descarga `main.js`, `manifest.json` y `styles.css` de la última Release y cópialos en `.obsidian/plugins/cool-trip/` de tu vault.

## Desarrollo

```bash
npm install
npm run dev      # vigila src/ y css/ y compila main.js y styles.css
npm run check    # tipos
npm run lint     # las reglas de eslint-plugin-obsidianmd
npm test         # el Markdown de la nota: leer, escribir y volver a leer (test/sample.md)
node test/harness.mjs dark   # capturas de la vista y de Nuevo viaje sin Obsidian (test/out/), con Playwright
```
