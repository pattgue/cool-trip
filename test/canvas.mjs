// Genera los tableros del boceto (el canvas de diseño) desde el plugin real: los ajustes, la nota y «Nuevo viaje», en ordenador y móvil.
// Uso: node test/harness.mjs && node test/canvas.mjs <carpeta>   → escribe <carpeta>/project/*.dc.html y cool-trip.css,
// obsidian-settings.css (el marco de Ajustes de Obsidian), y actualiza el alto de esos tableros en <carpeta>/project/canvas.json si existe. El tema (oscuro o claro) se elige en el canvas.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "playwright");
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, "out");
const dest = join(process.argv[2] || join(out, "canvas"), "project");
mkdirSync(dest, { recursive: true });

/* los colores del tema de Obsidian (los mismos que el harness), para el selector «tema» del canvas */
const DARK = "--background-primary: #1e1e1e; --background-secondary: #262626; --background-modifier-border: #363636; --text-normal: #dcddde; --text-muted: #a8a8a8; --text-faint: #6d6d6d; --interactive-accent: #7f6df2; --text-on-accent: #fff; color-scheme: dark";
const LIGHT = "--background-primary: #ffffff; --background-secondary: #f6f6f6; --background-modifier-border: #e0e0e0; --text-normal: #222; --text-muted: #5c5c5c; --text-faint: #ababab; --interactive-accent: #8a5cf5; --text-on-accent: #fff; color-scheme: light";
const STEP_NAMES = ["Tus notas", "Propiedades", "Archivos", "Mapas", "Bases", "Cool Bar", "Listo"];
const BOARDS = [
  /* los ajustes: solo el hueco que deja Obsidian para la pestaña del plugin (la ventana de Ajustes mide como mucho 1100px y su
     barra lateral 250: quedan 850; en el móvil, toda la pantalla) */
  ...STEP_NAMES.map((n, i) => ({ file: `Plugin-Ajustes-${i + 1}.dc.html`, title: `Ajustes · ${i + 1} ${n}`, w: 850, vw: 1100, mode: "settings" + (i + 1), phone: false })),
  ...STEP_NAMES.map((n, i) => ({ file: `Plugin-Ajustes-Movil-${i + 1}.dc.html`, title: `Ajustes móvil · ${i + 1} ${n}`, w: 390, mode: "settings" + (i + 1), phone: true })),
  { file: "NuevoViaje-A.dc.html", title: "Nuevo viaje", w: 1440, mode: "modal", phone: false },
  { file: "NuevoViaje-Movil.dc.html", title: "Nuevo viaje · móvil", w: 390, mode: "modal", phone: true },
  { file: "Nota-Plan.dc.html", title: "Nota del viaje", w: 1440, mode: "view", phone: false },
  { file: "Nota-Movil.dc.html", title: "Nota del viaje · móvil", w: 390, mode: "view", phone: true },
  ...[["eat", "Restaurante", "restaurante"], ["see", "Museo", "museo"], ["music", "Sala", "sala de conciertos"]].flatMap(([m, f, n]) => [
    { file: `Lugar-${f}.dc.html`, title: `Nota de lugar · ${n}`, w: 1440, mode: "place-" + m, phone: false },
    { file: `Lugar-${f}-Movil.dc.html`, title: `Nota de lugar · ${n} · móvil`, w: 390, mode: "place-" + m, phone: true }]),
];

writeFileSync(join(dest, "cool-trip.css"), readFileSync(join(here, "..", "styles.css"), "utf8"));
writeFileSync(join(dest, "obsidian-settings.css"), readFileSync(join(here, "obsidian-settings.css"), "utf8"));
const b = await chromium.launch();
const sizes = {};
for (const bd of BOARDS) {
  const p = await b.newPage({ viewport: { width: bd.vw || bd.w, height: 1000 } });
  await p.addInitScript(ph => { window.__phone = ph; }, bd.phone);
  await p.goto(pathToFileURL(join(out, bd.mode + ".html")).href);
  await p.waitForTimeout(400);
  const { html, h } = await p.evaluate(mode => {
    let el;
    if (mode === "modal") {
      el = document.querySelector(".modal-container");
      /* la ✕ de Obsidian (en el harness es una caja vacía) */
      const x = el.querySelector(".modal-close-button");
      if (x) {
        x.setAttribute("style", "position: absolute; top: 14px; right: 14px; width: 28px; height: 28px; display: grid; place-items: center; color: var(--text-muted)");
        x.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      }
      el.querySelector(".modal")?.style.setProperty("position", "relative");
      el.querySelector(".modal")?.style.setProperty("margin", "0 auto");
    } else if (mode.startsWith("settings")) {
      /* la pestaña sola, con el relleno y el fondo que le da Obsidian en ese hueco */
      el = document.querySelector(".ct-settings");
      const cs = getComputedStyle(el);
      for (const k of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "backgroundColor"]) el.style[k] = cs[k];
    } else el = document.querySelector(".ct-view");
    return { html: el.outerHTML, h: Math.ceil(el.getBoundingClientRect().height) };
  }, bd.mode);
  const pad = bd.mode === "modal" && !bd.phone ? 40 : 0;
  const height = h + pad * 2;
  sizes[bd.file] = { w: bd.w, h: height };
  writeFileSync(join(dest, bd.file), `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${bd.title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="./cool-trip.css">${bd.mode.startsWith("settings") ? '\n<link rel="stylesheet" href="./obsidian-settings.css">' : ""}
<style>
body{margin:0}
html,body{overflow:hidden}
button{background:var(--background-modifier-border);border:0;border-radius:4px;height:30px;color:var(--text-normal);font:inherit}
</style>
</helmet>
<div class="{{theme}}" style="width: ${bd.w}px; min-height: ${height}px; box-sizing: border-box; padding: ${pad}px 0; {{vars}}; background: var(--background-primary); color: var(--text-normal); font-family: Inter, system-ui, sans-serif">
${html.replace(/\u0000/g, "")}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"tema":{"editor":"enum","options":["Oscuro","Claro"],"default":"Oscuro"},"$preview":{"width":${bd.w},"height":${height}}}'>
class Component extends DCLogic {
  renderVals() {
    const DARK = '${DARK}';
    const LIGHT = '${LIGHT}';
    const light = this.props.tema === 'Claro';
    return { vars: light ? LIGHT : DARK, theme: light ? 'theme-light' : 'theme-dark' };
  }
}
</script>
</body>
</html>
`);
  console.log(bd.file, bd.w + "×" + height);
  await p.close();
}
await b.close();
/* el alto de cada tablero en el canvas */
const cj = join(dest, "canvas.json");
if (existsSync(cj)) {
  const c = JSON.parse(readFileSync(cj, "utf8"));
  for (const [f, s] of Object.entries(sizes)) if (c.boards[f]) Object.assign(c.boards[f], s);
  writeFileSync(cj, JSON.stringify(c, null, 2) + "\n");
}
