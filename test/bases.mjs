// Las vistas de Cool Bases que crea Cool Trip, pintadas con el Cool Bases de verdad (sin Obsidian), con los viajes y lugares del
// canvas: así se ve el billete, el billete apaisado del móvil y las filas y tarjetas de lugares antes de probarlo en el vault.
// Uso: node test/bases.mjs <carpeta de pattgue/cool-bases, rama cool-bar, ya compilada con npm run build> → test/out/bases-*.png
// Las fórmulas las calcula test/bases-eval.mjs (lo mismo que comprueba npm test).
import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { evaluate } from "./bases-eval.mjs";
import * as X from "./bases-sample.mjs";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "playwright");
const here = dirname(fileURLToPath(import.meta.url)), out = join(here, "out");
const cb = process.argv[2];
if (!cb) { console.error("Uso: node test/bases.mjs <carpeta de cool-bases>"); process.exit(1); }
mkdirSync(out, { recursive: true });
const outfile = join(out, "bases-md.mjs");
await esbuild.build({ entryPoints: [join(here, "entry.ts")], bundle: true, format: "esm", platform: "node", outfile, logLevel: "error",
  plugins: [{ name: "stub", setup: b => b.onResolve({ filter: /^obsidian$/ }, () => ({ path: join(here, "obsidian-stub.mjs") })) }] });
const md = await import(pathToFileURL(outfile).href + "?" + Date.now());
md.setLocaleForTests("es");
const S = md.defaultSettings("es");
const ICONS = JSON.parse(readFileSync(join(here, "lucide-icons.json"), "utf8"));
const env = { cool: true, maps: true, iconSvg: n => ICONS[n] || "" };
const PAL = { bermellon: "#E8613C", mostaza: "#EDC14B", pistacho: "#B5D69A", cielo: "#9CC9F0", lavanda: "#C2B3F5", rosa: "#F5AFC0" };
const tb = md.tripsBase(S, env), pb = md.placesBase(S, env, ["Tokio"]);
/* el color de cada viaje, como lo escribe Cool Trip en el CSS libre */
const colorOf = tr => { const c = tr.fm.portada; const id = Object.keys(PAL).find(k => c.normalize("NFD").replace(/[̀-ͯ]/g, "").startsWith(k)) || X.ACCENT[tr.basename] || "bermellon"; return PAL[id]; };
md.syncBase(tb, "trips", S, env, { colors: md.tripColorsCss(X.TRIPS.map(tr => ({ path: tr.path, color: colorOf(tr) }))) });

/* los valores de cada nota, con sus fórmulas ya calculadas */
const valuesOf = (doc, n) => {
  const ctx = { fm: n.fm, file: n, formulas: doc.formulas, today: X.TODAY, notes: X.NOTES, backlinks: X.backlinks, _cache: {} };
  const v = {};
  for (const k of Object.keys(doc.formulas)) { const r = evaluate(doc.formulas[k], ctx); v["formula." + k] = Array.isArray(r) ? r.map(x => x && x.link ? "[[" + x.link + "]]" : String(x)) : r && typeof r === "object" && r.link ? "[[" + r.link + "]]" : r; }
  return v;
};
/* una foto de ejemplo para las portadas con imagen */
/* una foto difícil, como la de Roma: cielo muy claro, edificios oscuros y columnas blancas (si aquí se lee, se lee con cualquiera) */
const PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" width="400" height="260"><rect width="400" height="260" fill="#f4efe2"/><path d="M0 120 L40 70 L80 110 L120 60 L170 100 L220 50 L270 95 L320 65 L400 100 V260 H0Z" fill="#3b2f25"/><g fill="#efe6d2">' + Array.from({ length: 12 }, (_, i) => `<rect x="${20 + i * 32}" y="95" width="12" height="120"/>`).join("") + '</g><rect y="200" width="400" height="60" fill="#8a6d4b"/><circle cx="330" cy="40" r="22" fill="#fff"/></svg>';
const data = {
  views: [
    ...tb.views.filter(v => v.type === "cool-bases").map(v => ({ base: "Viajes", view: v, notes: X.TRIPS.map(n => ({ ...n, v: valuesOf(tb, n) })) })),
    ...pb.views.filter(v => v.type === "cool-bases").map(v => ({ base: "Lugares", view: v, notes: X.PLACES.map(n => ({ ...n, v: valuesOf(pb, n) })) })),
  ],
  photo: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(PHOTO),
};
const theme = `body { margin: 0; font-family: Inter, system-ui, sans-serif; background: var(--background-primary); color: var(--text-normal); }
.theme-dark { --background-primary: #1e1e1e; --background-secondary: #262626; --background-modifier-border: #363636; --text-normal: #dcddde; --text-muted: #a8a8a8; --text-faint: #6d6d6d; --interactive-accent: #7f6df2; color-scheme: dark; }
body { --font-interface: Inter, system-ui, sans-serif; --font-text: var(--font-interface); }
.sec { padding: 16px 24px 32px; } .sec h2 { font-size: 14px; color: var(--text-muted); font-weight: 600; margin: 0 0 12px; }
.cb-group { font-size: 15px; font-weight: 600; padding: 14px 0 8px; }`;
const script = s => "<script>\n" + s.replace(/<\/script/gi, "<\\/script") + "\n</script>\n";
const harness = `(async function () {
  const { StringValue, NullValue, ListValue, TFile, toValue } = window.__obsidian;
  const D = window.DATOS, out = document.getElementById("out");
  const view = new URLSearchParams(location.search).get("v");
  const notes = D.views.flatMap(x => x.notes).map(n => Object.assign(new TFile(n.path), { fm: n.fm }));
  const byName = new Map(notes.map(f => [f.basename.toLowerCase(), f]));
  const app = { renderContext: {}, metadataCache: { getFileCache: f => f && f.fm ? { frontmatter: f.fm } : null,
      getFirstLinkpathDest: l => byName.get(String(l).replace(/\\.md$/, "").toLowerCase()) || (/\\.(jpe?g|png)$/.test(l) ? new TFile(l) : null) },
    vault: { getMarkdownFiles: () => notes, getFiles: () => notes, getResourcePath: () => D.photo, getAbstractFileByPath: () => null },
    fileManager: { processFrontMatter: async () => {} }, workspace: Object.assign(new window.__obsidian.Events(), { iterateAllLeaves: () => {}, getMostRecentLeaf: () => null }) };
  const mod = window.__pluginModule, plugin = new (mod.default || mod)(app, { id: "cool-bases" });
  await plugin.onload();
  const reg = window.__basesViews["cool-bases"];
  for (const x of D.views) {
    if (view && x.view.name !== view) continue;
    const v = x.view;
    const ok = n => { const f = v.filters && v.filters.and && v.filters.and[0]; if (!f) return true;
      if (/>= today/.test(f)) return n.fm.fin >= "${X.TODAY}"; if (/< today/.test(f)) return n.fm.fin < "${X.TODAY}";
      const m = /== "([^"]+)"/.exec(f); return m ? n.fm.ciudad === m[1] : true; };
    let list = x.notes.filter(ok);
    const sk = (v.sort || [])[0];
    if (sk) { const p = sk.property.slice(5); list.sort((a, b) => String(a.fm[p]).localeCompare(String(b.fm[p])) * (sk.direction === "DESC" ? -1 : 1)); }
    const entries = list.map(n => ({ file: Object.assign(new TFile(n.path), { fm: n.fm }), getValue: p => {
      if (p === "file.name") return new StringValue(n.basename);
      if (p.startsWith("note.")) return toValue(n.fm[p.slice(5)]);
      if (p.startsWith("formula.")) { const r = n.v[p]; return r === "" || r == null ? new NullValue() : toValue(Array.isArray(r) ? r : String(r)); }
      return new NullValue(); } }));
    const groups = [];
    if (v.groupBy) { const m = new Map(); for (const e of entries) { const k = String(list[entries.indexOf(e)].v[v.groupBy.property] ?? ""); if (!m.has(k)) m.set(k, []); m.get(k).push(e); }
      let keys = [...m.keys()].sort((a, b) => a.localeCompare(b) * (v.groupBy.direction === "DESC" ? -1 : 1));
      if (v.groupOrder) keys = v.groupOrder.filter(k => m.has(k));
      for (const k of keys) groups.push({ key: new StringValue(k), hasKey: () => true, entries: m.get(k) }); }
    else groups.push({ key: new NullValue(), hasKey: () => false, entries });
    const store = Object.assign({}, v);
    const config = { name: v.name, get: k => store[k], set: (k, val) => { store[k] = val; }, getOrder: () => v.order || [], getSort: () => [], getAsPropertyId: k => store[k] || null, getDisplayName: p => p };
    const sec = out.createDiv({ cls: "sec" }); sec.createEl("h2", { text: x.base + " · " + v.name });
    const host = sec.createDiv({ cls: "workspace-leaf-content" });
    const scroll = host.createDiv({ cls: "bases-view-scroll" });
    const vw = reg.factory({ app, config, data: { data: entries, groupedData: groups }, allProperties: [] }, scroll);
    vw.onDataUpdated();
  }
  window.__done = true;
})().catch(e => { window.__err = String(e && e.stack || e); });`;
const html = (phone) => "<!doctype html><meta charset=\"utf-8\">\n<style>" + theme + "</style>\n<style>" + readFileSync(join(cb, "styles.css"), "utf8") + "</style>\n" +
  `<body class="theme-dark${phone ? " is-mobile is-phone" : ""}"><div id="out"></div>\n` + script("window.__lang = 'es';") +
  script(readFileSync(join(cb, "test", "obsidian-mock.js"), "utf8")) + script("window.DATOS = " + JSON.stringify(data) + ";") +
  script("(function(){ var module = { exports: {} }, exports = module.exports;\n" + readFileSync(join(cb, "main.js"), "utf8") + "\nwindow.__pluginModule = module.exports; })();") + script(harness);
writeFileSync(join(out, "bases.html"), html(false));
writeFileSync(join(out, "bases-phone.html"), html(true));
const b = await chromium.launch();
for (const x of data.views) for (const phone of [false, true]) {
  const p = await b.newPage({ viewport: { width: phone ? 390 : 1200, height: 800 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(pathToFileURL(join(out, phone ? "bases-phone.html" : "bases.html")).href + "?v=" + encodeURIComponent(x.view.name));
  await p.waitForFunction(() => window.__done || window.__err, null, { timeout: 10000 });
  await p.waitForTimeout(500);
  const err = await p.evaluate(() => window.__err);
  const name = `bases-${x.base}-${x.view.name}${phone ? "-movil" : ""}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
  await p.screenshot({ path: join(out, name + ".png"), fullPage: true });
  console.log(name, err || errs.join(" | ") || "sin errores");
  await p.close();
}
await b.close();
