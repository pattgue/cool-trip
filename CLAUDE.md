# Cool Trip

Plugin privado de Obsidian para centralizar viajes. La propuesta está en `docs/01-propuesta.md`, y la arquitectura vigente en `replica/architecture.md` y `replica/schema.ts`. El boceto de todas las pantallas está en https://claude.ai/artifact/EREibCe33hATP7gorQ6771.

**Convenciones:** las de `pattgue/cool-bases`, el otro plugin de Patt (repo público): TypeScript sin framework con los helpers de DOM de Obsidian, esbuild, `css/` que se junta en `styles.css`, `i18n.ts` en español e inglés, `test/` con un mock de Obsidian y un harness en Chromium, un `demo-vault/` y lint con `eslint-plugin-obsidianmd`. Sin mapa propio: los mapas se abren en la app del móvil. La configuración va en la pestaña de ajustes del plugin, se adapta a las notas y propiedades que ya existan (sin carpetas ni plantillas obligatorias) y la interfaz usa Inter. El vault de Patt usa Obsidian Sync Standard, que no sube archivos de más de 5 MB.

## Skills Replica (`.claude/skills/replica-*`)

Hay 11 skills copiadas tal cual de [Jakeschincariol/replica-skill](https://github.com/Jakeschincariol/replica-skill), commit `77c9436` (licencia MIT, en `docs/third-party/replica-skill-LICENSE`). Están instaladas como skills de proyecto, no como plugin, así que los comandos no llevan prefijo: `/replica-recon`, `/replica-architect`, `/replica-design`, `/replica-build`, `/replica-backend`, `/replica-test`, `/replica-diff`, `/replica-entrepreneur`, `/replica-brand`, `/replica-launch` y `/replica-deploy`.

Para actualizarlas, se vuelve a copiar `replica-*` desde el repo original y se registra aquí el commit nuevo. No se editan a mano; las adaptaciones van en esta sección.

### Rutas de las herramientas

Los SKILL.md escriben `python3 sweep.py` o `../replica-diff/parity.py`. En este repo se lanzan desde la raíz:

```bash
python3 .claude/skills/replica-design/contrast.py replica/design/tokens.json
python3 .claude/skills/replica-diff/parity.py replica/features.csv
python3 .claude/skills/replica-diff/imgdiff.py replica/screens/S01.png replica/clone-screens/S01.png --out replica/diffs/S01.png
python3 .claude/skills/replica-entrepreneur/reviews.py replica/reviews.csv --out replica/feedback.md
python3 .claude/skills/replica-brand/sweep.py . --config replica/brand.json
python3 .claude/skills/replica-launch/listing.py replica/launch/listing.json
```

Solo usan la librería estándar (Python ≥ 3.8; el entorno Cloud trae 3.13), no tocan la red y no hace falta `pip install`. Los artefactos de trabajo van en `replica/`, en la raíz del repo.

### Entorno Cloud (claude.ai/code)

- **Playwright** (`/replica-test`): Chromium y Playwright ya vienen instalados. **No ejecutes** `npx playwright install chromium` como dice el SKILL.md. Si el proyecto fija otra versión de `@playwright/test`, lanza con `executablePath: '/opt/pw-browsers/chromium'`.
- **Red**: sale por un proxy. Algunos hosts no resuelven desde el contenedor (por ejemplo, `forum.obsidian.md` y `community.obsidian.md` fallaron por DNS), así que hay que buscar una fuente alternativa y decirlo.
- **Sin navegador ni cuenta del usuario**: el "click through your own account" de `/replica-recon` y el cuentagotas de color de `/replica-design` los hace Patt. Las capturas de referencia las sube Patt a `replica/screens/`.
- **Cuentas, claves y dominios** (`/replica-backend`, `/replica-deploy`): siempre las crea Patt, como exigen las propias skills.

### Cómo encajan en este proyecto

Cool Trip no es un clon para vender. Es un plugin privado que se inspira en Albo, Wanderlog, Tripsy/TripIt e Itini. **Esas apps son referencias, no originales a clonar**: de ellas se toman las funciones que encajan con los objetivos del plugin, y `parity.py` mide cuántas de las elegidas están cubiertas, no cuánto nos parecemos. Las referencias de diseño de Patt (tarjeta de embarque, panel de tiles, hoja de ruta vertical) están en `replica/architecture.md`. Por eso:

- **Útiles tal cual:** `/replica-recon` (mapa de pantallas y flujos de las apps de referencia, y `features.csv` con lo que queremos), `/replica-design` (tokens y contraste, que deben respetar las variables CSS del tema de Obsidian), `/replica-diff` (paridad de funciones), `/replica-entrepreneur` (qué odian los usuarios de esas apps) y `/replica-test`.
- **Red:** WebFetch no resuelve DNS en este entorno, pero `curl` sí funciona a través del proxy con los dominios permitidos (`wanderlog.com`, `tripsy.app`, `albo.inc`, `apps.apple.com`). Siguen bloqueados `tripit.com`, `docs.api.tripsy.app`, `*.protomaps.com` y las descargas de releases de GitHub. `git clone` de repos públicos de GitHub sí funciona.
- **Adaptadas:** en `/replica-architect`, el "stack" es la API de plugins de Obsidian (TypeScript + esbuild): no hay servidor ni base de datos, y los datos viven en el frontmatter de las notas. En `/replica-deploy`, "desplegar" es instalar el plugin en el vault (copiar `main.js`, `manifest.json` y `styles.css` a `.obsidian/plugins/cool-trip/`, o usar BRAT).
- **Por ahora no aplican:** `/replica-backend` (pagos y auth), `/replica-brand` y `/replica-launch` (mientras el plugin sea privado). Cool Trip ya tiene nombre propio y no usa marcas de terceros.
