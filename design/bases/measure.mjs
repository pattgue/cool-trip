import { createRequire } from "node:module";
import { readdirSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const D = process.argv[2], shots = process.argv[3];
const b = await chromium.launch();
const out = {};
for (const f of readdirSync(D).filter(f => f.startsWith(process.env.PFX || "Base-"))) {
  const w = f.includes("Movil") ? 390 : 1200;
  const p = await b.newPage({ viewport: { width: w, height: 600 } });
  await p.goto("file://" + D + "/" + f);
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const el = document.querySelector("x-dc > div"); el.style.minHeight = "0"; return { h: Math.ceil(el.getBoundingClientRect().height), sw: document.documentElement.scrollWidth }; });
  out[f] = r.h;
  if (r.sw > w) console.log("ANCHO", f, r.sw);
  if (shots) await p.screenshot({ path: shots + "/" + f.replace(".dc.html", ".png"), fullPage: true });
  await p.close();
}
await b.close();
writeFileSync(D + "/../" + (process.env.HJ || "heights3.json") + "", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
