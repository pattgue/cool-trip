// Capturas de la vista de Cool Trip sin Obsidian: node test/harness.mjs [dark|light] → test/out/*.png
import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "playwright");
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, "out");
mkdirSync(out, { recursive: true });
await esbuild.build({ entryPoints: [join(here, "harness-entry.ts")], bundle: true, format: "iife", outfile: join(out, "harness.js"), logLevel: "error",
  plugins: [{ name: "stub", setup: b => b.onResolve({ filter: /^obsidian$/ }, () => ({ path: join(here, "obsidian-browser.js") })) }] });
const theme = process.argv[2] || "dark";
const vars = theme === "dark"
  ? "--background-primary:#1e1e1e;--background-secondary:#262626;--background-modifier-border:#363636;--text-normal:#dcddde;--text-muted:#a8a8a8;--text-faint:#6d6d6d;--interactive-accent:#7f6df2;--text-on-accent:#fff;color-scheme:dark"
  : "--background-primary:#ffffff;--background-secondary:#f6f6f6;--background-modifier-border:#e0e0e0;--text-normal:#222;--text-muted:#5c5c5c;--text-faint:#ababab;--interactive-accent:#8a5cf5;--text-on-accent:#fff;color-scheme:light";
const css = readFileSync(join(here, "..", "styles.css"), "utf8");
const page = mode => `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;${vars};background:var(--background-primary);color:var(--text-normal);font-family:Inter,system-ui,sans-serif}
button{background:#363636;border:0;border-radius:4px;height:30px}</style></head>
<body class="theme-${theme}"><script>window.__sample=${JSON.stringify(readFileSync(join(here, "sample.md"), "utf8"))};window.__mode=${JSON.stringify(mode)};</script>
<script src="harness.js"></script></body></html>`;
writeFileSync(join(out, "view.html"), page("view"));
writeFileSync(join(out, "modal.html"), page("modal"));
const b = await chromium.launch();
for (const [name, w, mode, phone] of [["desk", 1440, "view", false], ["phone", 390, "view", true], ["modal", 1440, "modal", false], ["modal-phone", 390, "modal", true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.addInitScript(ph => { window.__phone = ph; }, phone);
  await p.goto(pathToFileURL(join(out, mode + ".html")).href);
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(out, `${name}-${theme}.png`), fullPage: true });
  const h = await p.evaluate(() => document.body.scrollHeight);
  console.log(name, theme, "alto", h, errs.length ? "ERRORES: " + errs.join(" | ") : "sin errores");
  await p.close();
}
await b.close();
/* formularios: añadir un lugar, un alojamiento (el hueco de Kioto) y un transporte */
{
  const b2 = await chromium.launch();
  const p = await b2.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(pathToFileURL(join(out, "view.html")).href);
  await p.click("text=Añadir al sáb 3 abr");
  await p.fill(".ct-form .ct-picker input", "Tsuk");
  await p.waitForTimeout(100);
  await p.locator(".ct-form").screenshot({ path: join(out, `form-place-${theme}.png`) });
  await p.click(".ct-form >> text=Transporte");
  await p.locator(".ct-form").screenshot({ path: join(out, `form-transport-${theme}.png`) });
  await p.click(".ct-form >> text=Cancelar");
  await p.click("text=Alojamiento en Kioto >> nth=0");
  await p.waitForTimeout(100);
  await p.locator(".ct-form").screenshot({ path: join(out, `form-lodging-${theme}.png`) });
  /* guardar un lugar y comprobar el Markdown */
  await p.click(".ct-form >> text=Cancelar");
  await p.click("text=Añadir al lun 5 abr");
  await p.fill(".ct-form input[type=time]", "11:00");
  await p.fill(".ct-form .ct-picker input", "Tsukiji");
  await p.click(".ct-option >> text=Tsukiji Outer Market");
  await p.click(".ct-form >> text=Guardar");
  const saved = await p.evaluate(() => window.__saved || "");
  console.log("guardar lugar:", /- \[ \] 11:00 \[\[Tsukiji Outer Market\]\]/.test(saved) ? "ok" : "FALLA", errs.length ? "ERRORES: " + errs.join(" | ") : "sin errores");
  await b2.close();
}
