// ajusta el país de cada tarjeta al ancho: el mayor tamaño (hasta 52 px) con el que cabe en una línea
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const D = process.argv[2], out = {};
const b = await chromium.launch();
for (const f of ["Base-Viajes-Proximos-CB.dc.html", "Base-Viajes-Viajados-CB.dc.html"]) {
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.goto("file://" + D + "/" + f); await p.waitForTimeout(500);
  Object.assign(out, await p.evaluate(() => {
    const r = {};
    for (const el of document.querySelectorAll("[data-fit]")) {
      let fs = 52; el.style.fontSize = fs + "px";
      while (el.scrollWidth > el.clientWidth && fs > 16) el.style.fontSize = --fs + "px";
      r[el.dataset.fit] = Math.min(r[el.dataset.fit] ?? 99, fs);
    }
    return r;
  }));
  await p.close();
}
await b.close();
writeFileSync(new URL("./fits.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
