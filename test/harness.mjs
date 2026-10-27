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
const css = readFileSync(join(here, "..", "styles.css"), "utf8") + readFileSync(join(here, "obsidian-settings.css"), "utf8");
const page = mode => `<!doctype html><html><head><meta charset="utf-8"><style>${css}
body{margin:0;${vars};background:var(--background-primary);color:var(--text-normal);font-family:Inter,system-ui,sans-serif}
button{background:#363636;border:0;border-radius:4px;height:30px}</style></head>
<body class="theme-${theme}"><script>window.__sample=${JSON.stringify(readFileSync(join(here, "sample.md"), "utf8"))};window.__mode=${JSON.stringify(mode)};</script>
<script src="harness.js"></script></body></html>`;
writeFileSync(join(out, "view.html"), page("view"));
writeFileSync(join(out, "modal.html"), page("modal"));
for (let i = 1; i <= 7; i++) writeFileSync(join(out, `settings${i}.html`), page("settings" + i));
const b = await chromium.launch();
for (const [name, w, mode, phone] of [...[1, 2, 3, 4, 5, 6, 7].map(i => ["settings" + i, 1100, "settings" + i, false]), ["desk", 1440, "view", false], ["phone", 390, "view", true], ["modal", 1440, "modal", false], ["modal-img", 1440, "modal.html#img", false], ["modal-phone", 390, "modal", true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.addInitScript(ph => { window.__phone = ph; }, phone);
  await p.goto(pathToFileURL(join(out, mode.includes(".html") ? mode.split("#")[0] : mode + ".html")).href + (mode.includes("#") ? "#" + mode.split("#")[1] : ""));
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(out, `${name}-${theme}.png`), fullPage: true });
  const h = await p.evaluate(() => document.body.scrollHeight);
  console.log(name, theme, "alto", h, errs.length ? "ERRORES: " + errs.join(" | ") : "sin errores");
  await p.close();
}
await b.close();
/* Nuevo viaje en el móvil, como lo vio Patt: una sola ✕, las fechas se tocan, los nombres no se meten bajo los botones y hace scroll */
{
  const b2 = await chromium.launch();
  const p = await b2.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.addInitScript(() => { window.__phone = true; });
  await p.goto(pathToFileURL(join(out, "modal.html")).href + "#patt");
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(out, `modal-patt-${theme}.png`) });
  const ok = (what, cond) => console.log(what + ":", cond ? "ok" : "FALLA");
  ok("una sola ✕", await p.evaluate(() => [...document.querySelectorAll(".modal-close-button, [aria-label='Cerrar']")].filter(e => e.offsetParent).length === 1));
  ok("la fecha se toca", await p.evaluate(() => [...document.querySelectorAll(".ct-field-wrap")].every(w => {
    const i = w.querySelector(".ct-date-input"), a = i.getBoundingClientRect(), f = w.getBoundingClientRect();
    return getComputedStyle(i).pointerEvents !== "none" && a.height >= f.height - 1 && document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2) === i;
  })));
  ok("nombres sin pisar los botones", await p.evaluate(() => [...document.querySelectorAll(".ct-dest-top")].every(r => {
    const c = r.querySelector(".ct-dest-city").getBoundingClientRect(), s = r.querySelector(".ct-stepper, .ct-step-n").getBoundingClientRect();
    return c.right <= s.left + 1;
  })));
  const sc = await p.evaluate(() => { const c = document.querySelector(".modal-content"); c.scrollTop = 99999; return [c.scrollHeight > c.clientHeight, c.scrollTop > 0]; });
  ok("hace scroll", sc[0] && sc[1]);
  ok("botón Crear viaje a la vista al final", await p.evaluate(() => { const r = document.querySelector(".ct-btn-create")?.getBoundingClientRect(); return !!r && r.bottom <= innerHeight && r.top >= 0; }));
  await p.screenshot({ path: join(out, `modal-patt-end-${theme}.png`) });
  console.log(errs.length ? "ERRORES: " + errs.join(" | ") : "sin errores");
  await b2.close();
}
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
  await p.click(".ct-slot:has-text('Alojamiento en Kioto') .ct-slot-pill");
  await p.waitForTimeout(100);
  await p.locator(".ct-form").screenshot({ path: join(out, `form-lodging-${theme}.png`) });
  /* guardar un lugar y comprobar el Markdown */
  await p.click(".ct-form >> text=Cancelar");
  await p.click("text=Añadir al lun 5 abr");
  await p.fill(".ct-form input[type=time]", "11:00");
  await p.fill(".ct-form .ct-picker input", "Tsukiji");
  await p.waitForTimeout(150);
  await p.click(".ct-option >> text=Tsukiji Outer Market");
  await p.click(".ct-form >> text=Guardar");
  const saved = await p.evaluate(() => window.__saved || "");
  console.log("guardar lugar:", /- \[ \] 11:00 \[\[Tsukiji Outer Market\]\]/.test(saved) ? "ok" : "FALLA", errs.length ? "ERRORES: " + errs.join(" | ") : "sin errores");
  const ok = (name, cond) => console.log(name + ":", cond ? "ok" : "FALLA");
  /* el formulario sale en el hueco que lo abrió (no al final del día) */
  await p.click(".ct-slot:has-text('Alojamiento en Kioto') .ct-slot-pill");
  ok("formulario en su hueco", await p.evaluate(() => { const f = document.querySelector(".ct-form"); const day = f.closest(".ct-day"); return !!day && f.closest(".ct-row").nextElementSibling !== null; }));
  await p.click(".ct-form >> text=Casa de amigos");
  await p.locator(".ct-form").screenshot({ path: join(out, `form-friends-${theme}.png`) });
  await p.click(".ct-form >> text=Hotel");
  await p.click(".ct-form >> text=Otro");
  await p.fill(".ct-form .ct-input-other", "Toallas de playa");
  await p.press(".ct-form .ct-input-other", "Enter");
  await p.fill(".ct-form .ct-picker input", "Machiya Gion");
  await p.fill(".ct-form .ct-grid-price input", "640");
  await p.selectOption(".ct-form .ct-grid-price select", "¥");
  await p.locator(".ct-form").screenshot({ path: join(out, `form-lodging2-${theme}.png`) });
  await p.click(".ct-form >> text=Guardar");
  let md = await p.evaluate(() => window.__saved || "");
  ok("alojamiento: moneda, incluye otro, sin hora", /- \*\*Machiya Gion\*\* · alojamiento · ¥640/.test(md) && /Incluye: toallas de playa|Incluye: Toallas de playa/.test(md));
  /* la portada: sellada; el lápiz la desbloquea */
  ok("portada sellada (los colores, siempre)", await p.evaluate(() => !document.querySelector(".ct-ticket .ct-dest-add") && !!document.querySelector(".ct-ticket .ct-swatches")));
  await p.click(".ct-lock-btn");
  ok("portada desbloqueada", await p.evaluate(() => !!document.querySelector(".ct-ticket .ct-dest-add") && !!document.querySelector(".ct-ticket .ct-swatches")));
  await p.locator(".ct-ticket").screenshot({ path: join(out, `ticket-edit-${theme}.png`) });
  await p.click(".ct-lock-btn");
  /* + Documento en una reserva: solo la ventanita del documento */
  await p.locator(".ct-pass .ct-link-btn >> text=Documento").first().click();
  ok("documento: ventanita sola", await p.evaluate(() => !!document.querySelector(".ct-pass .ct-docform") && !document.querySelector(".ct-form:not(.ct-docform)")));
  await p.fill(".ct-pass .ct-docform input", "DNI");
  await p.click(".ct-pass .ct-docform >> text=Ana");
  await p.click(".ct-pass .ct-docform >> text=Wallet");
  await p.locator(".ct-pass").first().screenshot({ path: join(out, `doc-add-${theme}.png`) });
  await p.click(".ct-pass .ct-docform >> text=Guardar");
  md = await p.evaluate(() => window.__saved || "");
  ok("documento con varios sitios y su viajero", /DNI \(en papel · Wallet · para Ana\)/.test(md));
  /* la mochila: una sugerencia, con su viajero como etiqueta */
  await p.click(".ct-suggest .ct-pill >> nth=0");
  await p.locator(".ct-box >> nth=0").screenshot({ path: join(out, `bag-form-${theme}.png`) });
  await p.click(".ct-box .ct-docform >> text=Guardar");
  md = await p.evaluate(() => window.__saved || "");
  ok("mochila: DNI para Ana", /- DNI \(en papel · para Ana\)/.test(md));
  ok("mochila: la sugerencia ya no sale", await p.evaluate(() => ![...document.querySelectorAll(".ct-suggest .ct-pill")].some(b => /DNI/.test(b.textContent) && /A/.test(b.textContent) && b.querySelector(".ct-avatar")?.textContent === "A")));
  /* arrastrar un paso sin hora a otro día */
  await p.click("text=Añadir al lun 5 abr");
  await p.click(".ct-form >> text=Nota");
  await p.fill(".ct-form .ct-grid-time input[type=text]", "Comprar SIM");
  await p.click(".ct-form >> text=Guardar");
  await p.setViewportSize({ width: 1440, height: 4000 });
  await p.evaluate(() => window.scrollTo(0, 0));
  const g = p.locator(".ct-row:has-text('Comprar SIM') .ct-grip");
  const box = await g.boundingBox();
  const dest = await p.locator(".ct-row:has-text('Senso-ji')").boundingBox();
  await p.mouse.move(box.x + 10, box.y + 10);
  await p.mouse.down();
  await p.mouse.move(box.x + 10, dest.y + 5, { steps: 12 });
  await p.mouse.move(box.x + 12, dest.y + 6, { steps: 2 });
  await p.mouse.up();
  md = await p.evaluate(() => window.__saved || "");
  ok("arrastrar a otro día", /### Dom 4 abr[^#]*Comprar SIM[^#]*\[\[Senso-ji\]\]/.test(md));
  console.log(errs.length ? "ERRORES: " + errs.join(" | ") : "sin errores");
  await b2.close();
}
