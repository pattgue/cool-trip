// Las capturas del README (docs/*.png), en tema claro: node test/harness.mjs light && node test/readme-shots.mjs
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "playwright");
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, "out"), docs = join(here, "..", "docs", "img");
mkdirSync(docs, { recursive: true });
const shots = [
  ["trip", "view.html", 1440, 900, false],
  ["trip-phone", "view.html", 390, 844, true],
  ["new-trip", "modal.html", 1440, 900, false],
  ["place", "place-see.html#view", 1100, 900, false],
  ["place-phone", "place-eat.html#view", 390, 844, true],
];
const b = await chromium.launch();
for (const [name, file, w, hgt, phone] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2 });
  await p.addInitScript(ph => { window.__phone = ph; }, phone);
  await p.goto(pathToFileURL(join(out, file.split("#")[0])).href + (file.includes("#") ? "#" + file.split("#")[1] : ""));
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(docs, name + ".png") });
  console.log("docs/img/" + name + ".png");
  await p.close();
}
await b.close();
/* las bases, si test/bases.mjs las ha pintado con Cool Bases */
/* (las bases salen tal cual las pinta test/bases.mjs, en tema oscuro; el fondo vacío de abajo se recorta aparte) */
for (const [from, to] of [["bases-Viajes-Proximos.png", "bases-trips.png"], ["bases-Lugares-Guia-por-ciudad.png", "bases-places.png"]])
  if (existsSync(join(out, from))) { copyFileSync(join(out, from), join(docs, to)); console.log("docs/img/" + to); }
