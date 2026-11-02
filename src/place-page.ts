/* La ficha de un lugar, pintada: arriba la foto (o el degradado del color de su tipo), sus propiedades como campos y, debajo,
   las secciones de su tipo (place-types.ts), cada una con su formato. Las secciones son «## Título» en el cuerpo de la nota:
   solo se escriben cuando las rellenas, y lo que no es de Cool Trip se queda tal cual. */
import { h } from "./dom";
import { t } from "./i18n";
import { priceValue } from "./md";
import { button, icon, iconButton } from "./ui";
import { catColor, iconFor, placeType } from "./places";
import type { PlaceInfo, PlaceType } from "./places";
import { CLOSED, DAYS, HINTS, PRICE_KIND, SECS, TYPE_NAMES, TYPE_SECS } from "./place-types";
import type { SecDef, SecKey } from "./place-types";
export type { SecKey } from "./place-types";

/* ---------- el Markdown de la nota ---------- */
export interface PlaceDoc { fm: string; intro: string[]; secs: { title: string; lines: string[] }[] }
const low = (s: string) => s.trim().toLowerCase();
export function parsePlace(text: string): PlaceDoc {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
  const fm = m ? m[0] : "", lines = text.slice(fm.length).split(/\r?\n/);
  const doc: PlaceDoc = { fm, intro: [], secs: [] };
  for (const line of lines) {
    const hd = /^##\s+(.+?)\s*$/.exec(line);
    if (hd && !line.startsWith("###")) { doc.secs.push({ title: hd[1], lines: [] }); continue; }
    (doc.secs.length ? doc.secs[doc.secs.length - 1].lines : doc.intro).push(line);
  }
  const trim = (l: string[]) => { while (l.length && !l[l.length - 1].trim()) l.pop(); while (l.length && !l[0].trim()) l.shift(); return l; };
  trim(doc.intro);
  for (const s of doc.secs) trim(s.lines);
  return doc;
}
export function serializePlace(doc: PlaceDoc): string {
  const out: string[] = [];
  if (doc.intro.length) out.push(...doc.intro, "");
  for (const s of doc.secs) out.push(`## ${s.title}`, ...s.lines, "");
  return doc.fm + (doc.fm && out.length && !doc.fm.endsWith("\n") ? "\n" : "") + out.join("\n").replace(/\n+$/, "\n");
}
const def = (k: SecKey): SecDef => SECS[k];
const titles = (k: SecKey) => def(k).title.map(low);
const secOf = (doc: PlaceDoc, k: SecKey) => doc.secs.find(s => titles(k).includes(low(s.title)));
export const linesOf = (doc: PlaceDoc, k: SecKey) => secOf(doc, k)?.lines ?? [];
/* escribe una sección (sin líneas se quita, salvo si se pide que se quede: un opcional recién marcado) */
export function setSection(doc: PlaceDoc, k: SecKey, lines: string[], lang: "es" | "en", keep = false) {
  const ls = lines.map(l => l.trimEnd());
  while (ls.length && !ls[ls.length - 1].trim()) ls.pop();
  const cur = secOf(doc, k);
  if (!ls.length && !keep) { if (cur) doc.secs.splice(doc.secs.indexOf(cur), 1); return; }
  if (cur) cur.lines = ls; else doc.secs.push({ title: def(k).title[lang === "en" ? 1 : 0], lines: ls });
}
/* los elementos «- x» de una sección */
const bullet = (l: string) => /^\s*[-*]\s+(.*)$/.exec(l)?.[1] ?? null;
const items = (lines: string[]) => lines.map(bullet).filter((x): x is string => x != null);
const cells = (x: string) => x.split(" · ").map(c => c.trim());
const row = (vals: string[]) => { const v = [...vals.map(x => x.trim())]; while (v.length > 1 && !v[v.length - 1]) v.pop(); return "- " + v.join(" · "); };

/* ---------- la vista ---------- */
export type PlaceProp = "category" | "city" | "price" | "location" | "photo" | "rating" | "visited";
export interface PlaceCtx {
  place: PlaceInfo; doc: PlaceDoc; phone: boolean; lang: "es" | "en";
  photo: string | null;                                   // la URL de la portada, si es una imagen
  cover: string;                                          // la portada tal como está en la nota
  trips: { name: string; dates: string; open(): void }[];  // los viajes que lo llevan en su plan
  mapsUrl: string;
  today: number;                                          // 0 = lunes (para marcar el día en el horario)
  editing: string | null;                                 // «sección», «sección#n», «sección#new»
  openUrl(url: string): void;
  openLink(name: string): void;
  edit(id: string | null): void;
  setLines(k: SecKey, lines: string[], keep?: boolean): void;
  setProp(k: PlaceProp, v: string | number | boolean): void;
  ask(title: string, placeholder: string, value?: string): Promise<string | null>;
  pickPlace(): Promise<string | null>;                     // elegir una nota de lugar
  lookup(name: string): { category: string; photo: string | null } | null;
  locate(): void;                                         // buscar las coordenadas
}
const L = (ctx: PlaceCtx, x: [string, string]) => x[ctx.lang === "en" ? 1 : 0];

/* el precio que se calcula solo: la media de la carta, o la entrada más barata */
function autoPrice(ctx: PlaceCtx, type: PlaceType): string {
  const kind = PRICE_KIND(type);
  const k = (TYPE_SECS[type] || []).find(x => def(x).fmt === "rows" && (def(x).cols || []).some(c => /precio|price/i.test(c[0])));
  if (!kind || !k) return "";
  const col = (def(k).cols || []).findIndex(c => /precio|price/i.test(c[0]));
  const ps = items(linesOf(ctx.doc, k)).map(x => cells(x)[col] || "").filter(p => priceValue(p) > 0);
  if (!ps.length) return "";
  const unit = ps[0].replace(/[\d.,\s]/g, "").trim(), vals = ps.map(priceValue);
  const n = kind === "avg" ? vals.reduce((a, b) => a + b, 0) / vals.length : Math.min(...vals);
  const num = new Intl.NumberFormat(ctx.lang, { maximumFractionDigits: vals.every(Number.isInteger) ? 0 : 2 }).format(n);
  return /^[$£¥€]/.test(ps[0].trim()) ? unit + num : `${num} ${unit}`.trim();
}

/* ---------- cada formato ---------- */
function head(ctx: PlaceCtx, k: SecKey, extra?: HTMLElement | null): HTMLElement {
  return h("span", { cls: "ct-psec-head" }, icon(def(k).icon), h("span", null, L(ctx, def(k).title)), extra ? h("span", { cls: "ct-grow" }) : null, extra);
}
const hintOf = (ctx: PlaceCtx, k: SecKey, type: PlaceType) => { const x = HINTS[type]?.[k] || def(k).hint; return x ? L(ctx, x) : ""; };
const addBtn = (label: string, on: () => void) => button([icon("plus"), label], "ct-padd", on);

function textSec(ctx: PlaceCtx, k: SecKey, type: PlaceType): HTMLElement {
  const lines = linesOf(ctx.doc, k), post = def(k).fmt === "postit";
  const cls = "ct-psec is-" + def(k).fmt + (post ? " is-wide" : "");
  if (ctx.editing === k) {
    const ta = h("textarea", { cls: "ct-psec-input", attr: { rows: "4", placeholder: hintOf(ctx, k, type) } });
    ta.value = lines.join("\n");
    window.setTimeout(() => ta.focus(), 0);
    return h("section", { cls: cls + " is-editing" }, head(ctx, k), ta, foot(ctx, () => ctx.setLines(k, ta.value.split("\n"))));
  }
  const body = lines.length ? prose(lines) : h("span", { cls: "ct-psec-empty" }, hintOf(ctx, k, type));
  const el = h("section", { cls: cls + (lines.length ? "" : " is-empty"), attr: { role: "button", tabindex: "0" } }, head(ctx, k), body);
  el.addEventListener("click", () => ctx.edit(k));
  return el;
}
function foot(ctx: PlaceCtx, save: () => void, remove?: () => void): HTMLElement {
  return h("div", { cls: "ct-psec-foot" }, remove ? button(t("pl.remove"), "ct-link-btn is-danger", remove) : null, h("span", { cls: "ct-grow" }),
    button(t("f.cancel"), "ct-link-btn", () => ctx.edit(null)), button(t("f.save"), "ct-btn-primary is-small", save));
}
function prose(lines: string[]): HTMLElement {
  const box = h("div", { cls: "ct-psec-text" });
  let ul: HTMLElement | null = null;
  for (const l of lines) {
    const li = bullet(l);
    if (li != null) { if (!ul) box.appendChild(ul = h("ul")); ul.appendChild(h("li", null, li.replace(/^\[[ x]\]\s+/, ""))); continue; }
    ul = null;
    if (l.trim()) box.appendChild(h("p", null, l));
  }
  return box;
}

/* filas: nombre · precio · nota (las columnas de la sección), una por cosa */
function rowsSec(ctx: PlaceCtx, k: SecKey, type: PlaceType, extra?: HTMLElement | null): HTMLElement {
  const cols = def(k).cols || [], lines = linesOf(ctx.doc, k), list = items(lines);
  const pc = cols.findIndex(c => /precio|price/i.test(c[0]));
  const editor = (i: number | null) => {
    const vals = i == null ? [] : cells(list[i]);
    const ins = cols.map((c, ci) => { const x = h("input", { cls: "ct-pin", attr: { type: "text", placeholder: L(ctx, c) } }); x.value = vals[ci] || ""; return x; });
    window.setTimeout(() => ins[0]?.focus(), 0);
    const save = () => { const next = [...list]; const r = row(ins.map(x => x.value)); if (r.replace(/[-·\s]/g, "")) { if (i == null) next.push(r.slice(2)); else next[i] = r.slice(2); } ctx.setLines(k, next.map(x => "- " + x)); };
    for (const x of ins) x.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); save(); } });
    return h("div", { cls: "ct-prow is-editing" }, h("div", { cls: "ct-prow-ins", attr: { style: `--n: ${cols.length}` } }, ins),
      foot(ctx, save, i == null ? undefined : () => ctx.setLines(k, list.filter((_, j) => j !== i).map(x => "- " + x))));
  };
  const rows = list.map((x, i) => {
    if (ctx.editing === `${k}#${i}`) return editor(i);
    const c = cells(x), rest = c.slice(1).filter((_, j) => j + 1 !== pc && c[j + 1]);
    const r = button([h("span", { cls: "ct-prow-main" }, h("b", null, c[0] || "—"), rest.length ? h("span", { cls: "ct-sub" }, rest.join(" · ")) : null),
      pc > 0 && c[pc] ? h("span", { cls: "ct-prow-price" }, c[pc]) : null], "ct-prow", () => ctx.edit(`${k}#${i}`));
    return r;
  });
  const empty = !list.length && ctx.editing !== `${k}#new` ? h("span", { cls: "ct-psec-empty" }, hintOf(ctx, k, type)) : null;
  return h("section", { cls: "ct-psec is-rows" + (list.length ? "" : " is-empty") }, head(ctx, k, extra), empty, rows,
    ctx.editing === `${k}#new` ? editor(null) : addBtn(t("pl.add"), () => ctx.edit(`${k}#new`)));
}

/* horario: los siete días, cada uno con su hora o «cerrado» */
function hoursSec(ctx: PlaceCtx, k: SecKey): HTMLElement {
  const byDay = new Map<number, string>();
  for (const x of items(linesOf(ctx.doc, k))) {
    const m = /^([^:]+):\s*(.*)$/.exec(x);
    const d = m ? DAYS.findIndex(dd => dd.map(low).includes(low(m[1]))) : -1;
    if (d >= 0 && m) byDay.set(d, m[2]);
  }
  const closed = (v: string) => CLOSED.map(low).includes(low(v));
  if (ctx.editing === k) {
    const ins = DAYS.map((d, i) => { const x = h("input", { cls: "ct-pin", attr: { type: "text", placeholder: i ? "" : "9:00–20:00", "aria-label": L(ctx, d) } }); x.value = byDay.get(i) || ""; return x; });
    window.setTimeout(() => ins[0].focus(), 0);
    const same = button(t("pl.sameAll"), "ct-link-btn", () => { for (const x of ins.slice(1)) if (!x.value.trim()) x.value = ins[0].value; });
    const save = () => ctx.setLines(k, ins.map((x, i) => x.value.trim() ? `- ${L(ctx, DAYS[i])}: ${x.value.trim()}` : "").filter(Boolean));
    return h("section", { cls: "ct-psec is-hours is-editing" }, head(ctx, k),
      h("div", { cls: "ct-phours" }, DAYS.map((d, i) => h("label", { cls: "ct-phour" }, h("span", null, L(ctx, d)), ins[i]))),
      h("div", { cls: "ct-psec-foot is-left" }, same, h("span", { cls: "ct-sub" }, t("pl.closedHint", { c: L(ctx, CLOSED) }))),
      foot(ctx, save));
  }
  const el = h("section", { cls: "ct-psec is-hours" + (byDay.size ? "" : " is-empty"), attr: { role: "button", tabindex: "0" } }, head(ctx, k),
    byDay.size ? h("div", { cls: "ct-phours" }, DAYS.map((d, i) => {
      const v = byDay.get(i) || "";
      return h("span", { cls: "ct-phour" + (i === ctx.today ? " is-today" : "") + (closed(v) ? " is-closed" : "") },
        h("span", null, L(ctx, d)), h("b", null, v ? (closed(v) ? t("pl.closed") : v) : "—"));
    })) : h("span", { cls: "ct-psec-empty" }, t("pl.hoursHint")));
  el.addEventListener("click", () => ctx.edit(k));
  return el;
}

/* etiquetas: pastillas que se marcan (las sugeridas del tipo y las tuyas) */
function tagsSec(ctx: PlaceCtx, k: SecKey): HTMLElement {
  const on = items(linesOf(ctx.doc, k)), sug = (def(k).tags || []).map(x => L(ctx, x));
  const all = [...sug, ...on.filter(x => !sug.map(low).includes(low(x)))];
  const has = (x: string) => on.map(low).includes(low(x));
  const toggle = (x: string) => ctx.setLines(k, (has(x) ? on.filter(y => low(y) !== low(x)) : [...on, x]).map(y => "- " + y));
  return h("section", { cls: "ct-psec is-tags" }, head(ctx, k),
    h("div", { cls: "ct-ptags" }, all.map(x => button([has(x) ? icon("check") : null, x], "ct-ptag" + (has(x) ? " is-on" : ""), () => toggle(x), { "aria-pressed": String(has(x)) })),
      button([icon("plus"), t("pl.other")], "ct-ptag is-new", () => void ctx.ask(L(ctx, def(k).title), t("pl.newTag")).then(v => { if (v?.trim() && !has(v)) toggle(v.trim()); }))));
}

/* datos: campos con nombre fijo («Distancia: 12 km») */
function specsSec(ctx: PlaceCtx, k: SecKey): HTMLElement {
  const fields = def(k).fields || [], list = items(linesOf(ctx.doc, k));
  const val = (f: [string, string]) => { const x = list.find(y => f.map(low).some(n => low(y).startsWith(n + ":"))); return x ? x.slice(x.indexOf(":") + 1).trim() : ""; };
  const vals = fields.map(val);
  const save = (i: number, v: string) => ctx.setLines(k, fields.map((f, j) => { const x = j === i ? v.trim() : vals[j]; return x ? `- ${L(ctx, f)}: ${x}` : ""; }).filter(Boolean));
  return h("section", { cls: "ct-psec is-specs" }, head(ctx, k), h("div", { cls: "ct-pspecs" }, fields.map((f, i) => {
    if (ctx.editing === `${k}#${i}`) {
      const x = h("input", { cls: "ct-pin", attr: { type: "text", placeholder: L(ctx, f) } });
      x.value = vals[i];
      window.setTimeout(() => x.focus(), 0);
      x.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); save(i, x.value); } else if (ev.key === "Escape") ctx.edit(null); });
      x.addEventListener("blur", () => save(i, x.value));
      return h("label", { cls: "ct-pspec is-editing" }, h("span", null, L(ctx, f)), x);
    }
    return button([h("span", null, L(ctx, f)), vals[i] ? h("b", null, vals[i]) : h("span", { cls: "ct-psec-empty" }, t("pl.add"))], "ct-pspec", () => ctx.edit(`${k}#${i}`));
  })));
}

/* lo que hay que llevar: como la maleta del viaje (se tacha lo que ya va) */
function packSec(ctx: PlaceCtx, k: SecKey): HTMLElement {
  const list = items(linesOf(ctx.doc, k)).map(x => { const m = /^\[([ xX])\]\s+(.*)$/.exec(x); return m ? { done: m[1] !== " ", text: m[2] } : { done: false, text: x }; });
  const write = (l: typeof list) => ctx.setLines(k, l.map(x => `- [${x.done ? "x" : " "}] ${x.text}`));
  const inp = h("input", { cls: "ct-pin ct-padd-in", attr: { type: "text", placeholder: t("pl.bringPh") } });
  inp.addEventListener("keydown", ev => { if (ev.key === "Enter" && inp.value.trim()) { ev.preventDefault(); write([...list, { done: false, text: inp.value.trim() }]); } });
  return h("section", { cls: "ct-psec is-pack" }, head(ctx, k), h("div", { cls: "ct-ptags" }, list.map((x, i) =>
    h("span", { cls: "ct-ppack" + (x.done ? " is-done" : "") },
      button([icon(x.done ? "check" : "circle"), x.text], "ct-ppack-btn", () => write(list.map((y, j) => j === i ? { ...y, done: !y.done } : y)), { "aria-pressed": String(x.done) }),
      iconButton("x", t("pl.remove"), () => write(list.filter((_, j) => j !== i)), "ct-ppack-x")))), inp);
}

/* lugares enlazados: tarjetas con su foto o su tipo, que llevan a su ficha */
function linksSec(ctx: PlaceCtx, k: SecKey, type: PlaceType): HTMLElement {
  const list = items(linesOf(ctx.doc, k)).map(x => { const m = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\](?:\s*·\s*(.*))?$/.exec(x); return m ? { name: m[1], note: m[2] || "" } : { name: x, note: "" }; });
  const write = (l: typeof list) => ctx.setLines(k, l.map(x => `- [[${x.name}]]` + (x.note ? ` · ${x.note}` : "")));
  const cards = list.map((x, i) => {
    const info = ctx.lookup(x.name);
    const thumb = h("span", { cls: "ct-pthumb", attr: { "aria-hidden": "true" } }, info?.photo ? h("img", { attr: { src: info.photo, alt: "" } }) : icon(iconFor(info?.category || "")));
    thumb.setCssProps({ "--ct-cat": catColor(info?.category || "") });
    return h("span", { cls: "ct-plink" },
      button([thumb, h("span", { cls: "ct-prow-main" }, h("b", null, x.name), h("span", { cls: "ct-sub" }, [info?.category, x.note].filter(Boolean).join(" · ")))], "ct-plink-btn", () => ctx.openLink(x.name)),
      iconButton("x", t("pl.remove"), () => write(list.filter((_, j) => j !== i)), "ct-ppack-x"));
  });
  return h("section", { cls: "ct-psec is-links" + (list.length ? "" : " is-empty") }, head(ctx, k),
    list.length ? h("div", { cls: "ct-plinks" }, cards) : h("span", { cls: "ct-psec-empty" }, hintOf(ctx, k, type)),
    addBtn(t("pl.addPlace"), () => void ctx.pickPlace().then(n => { if (n && !list.some(x => x.name === n)) write([...list, { name: n, note: "" }]); })));
}

/* lista: una cosa por línea */
function listSec(ctx: PlaceCtx, k: SecKey, type: PlaceType): HTMLElement {
  const list = items(linesOf(ctx.doc, k));
  const write = (l: string[]) => ctx.setLines(k, l.filter(x => x.trim()).map(x => "- " + x.trim()));
  const inp = h("input", { cls: "ct-pin ct-padd-in", attr: { type: "text", placeholder: list.length ? t("pl.listPh") : hintOf(ctx, k, type) } });
  inp.addEventListener("keydown", ev => { if (ev.key === "Enter" && inp.value.trim()) { ev.preventDefault(); write([...list, inp.value]); } });
  return h("section", { cls: "ct-psec is-list" }, head(ctx, k), list.length ? h("ul", { cls: "ct-plist" }, list.map((x, i) => {
    if (ctx.editing === `${k}#${i}`) {
      const e = h("input", { cls: "ct-pin", attr: { type: "text" } });
      e.value = x;
      window.setTimeout(() => e.focus(), 0);
      const done = () => write(list.map((y, j) => j === i ? e.value : y));
      e.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); done(); } else if (ev.key === "Escape") ctx.edit(null); });
      e.addEventListener("blur", done);
      return h("li", null, e);
    }
    return h("li", null, button(x, "ct-plist-btn", () => ctx.edit(`${k}#${i}`)));
  })) : null, inp);
}

function section(ctx: PlaceCtx, k: SecKey, type: PlaceType): HTMLElement | null {
  const d = def(k);
  /* opcional (el menú del día): sale cuando se marca */
  if (d.optional && !secOf(ctx.doc, k)) {
    const box = h("input", { cls: "ct-tick", attr: { type: "checkbox" } });
    box.addEventListener("change", () => ctx.setLines(k, [], true));
    return h("label", { cls: "ct-popt" }, box, t("pl.has", { s: L(ctx, d.title).toLowerCase() }));
  }
  const off = d.optional ? (() => { const b = h("input", { cls: "ct-tick", attr: { type: "checkbox", "aria-label": t("pl.has", { s: L(ctx, d.title).toLowerCase() }) } }); b.checked = true;
    b.addEventListener("click", ev => ev.stopPropagation()); b.addEventListener("change", () => ctx.setLines(k, [])); return b; })() : null;
  switch (d.fmt) {
    case "rows": return rowsSec(ctx, k, type, off);
    case "hours": return hoursSec(ctx, k);
    case "tags": return tagsSec(ctx, k);
    case "specs": return specsSec(ctx, k);
    case "pack": return packSec(ctx, k);
    case "links": return linksSec(ctx, k, type);
    case "list": return listSec(ctx, k, type);
    default: return textSec(ctx, k, type);
  }
}

/* ---------- la ficha entera ---------- */
export function placePage(ctx: PlaceCtx): HTMLElement {
  const p = ctx.place, type = placeType(p.category), color = catColor(p.category);
  const kindName = type === "other" ? "" : L(ctx, TYPE_NAMES[type]);
  /* la cabecera: la foto fundida en el color del tipo o, sin foto, un degradado de ese color con su icono grande */
  const hero = h("header", { cls: "ct-phero" + (ctx.photo ? " has-photo" : "") },
    ctx.photo ? h("img", { cls: "ct-phero-img", attr: { src: ctx.photo, alt: "" } }) : h("span", { cls: "ct-phero-art", attr: { "aria-hidden": "true" } }, icon(iconFor(p.category))),
    h("div", { cls: "ct-phero-text" },
      h("span", { cls: "ct-phero-kind" }, icon(iconFor(p.category)), (p.category || kindName || t("pl.fam.other")).toUpperCase()),
      h("h1", { cls: "ct-phero-name" }, p.name),
      h("span", { cls: "ct-phero-where" }, [p.city, p.country].filter(Boolean).join(" · "))));

  /* Maps, visitado y estrellas: tocar es escribir (y solo entonces se crea la propiedad) */
  const stars = h("span", { cls: "ct-pstars", attr: { role: "radiogroup", "aria-label": t("pl.rating") } },
    [1, 2, 3, 4, 5].map(n => button(icon("star"), "ct-pstar" + (n <= p.rating ? " is-on" : ""), () => ctx.setProp("rating", n === p.rating ? 0 : n),
      { role: "radio", "aria-checked": String(n === p.rating), "aria-label": String(n) })));
  const seen = button([icon(p.visited ? "circle-check" : "circle"), t(p.visited ? "pl.visited" : "pl.toVisit")], "ct-pchip" + (p.visited ? " is-on" : ""),
    () => ctx.setProp("visited", !p.visited), { "aria-pressed": String(p.visited) });
  const maps = button([icon("map-pin"), t("pl.maps")], "ct-pmaps", () => ctx.openUrl(ctx.mapsUrl));
  const facts = h("div", { cls: "ct-pfacts" }, maps, seen, stars);

  /* sus propiedades, como campos: se escribe solo la que rellenas */
  const kind = PRICE_KIND(type), auto = autoPrice(ctx, type);
  const field = (k: PlaceProp, label: string, value: string, ph: string, list?: string, after?: HTMLElement | null) => {
    const inp = h("input", { cls: "ct-pin", attr: { type: "text", placeholder: ph, ...(list ? { list } : {}), "aria-label": label } });
    inp.value = value;
    inp.addEventListener("change", () => { if (inp.value.trim() !== value) ctx.setProp(k, inp.value.trim()); });
    inp.addEventListener("keydown", ev => { if (ev.key === "Enter") inp.blur(); });
    return h("label", { cls: "ct-pfield is-" + k }, h("span", { cls: "ct-label" }, label), h("span", { cls: "ct-pfield-in" }, inp, after));
  };
  const loc = p.loc ? `${p.loc[0]}, ${p.loc[1]}` : "";
  const types = h("datalist", { attr: { id: "ct-place-types" } }, Object.values(TYPE_NAMES).map(n => h("option", { attr: { value: L(ctx, n) } })));
  const props = h("div", { cls: "ct-pprops" }, types,
    field("category", t("pl.f.category"), p.category, t("pl.f.categoryPh"), "ct-place-types"),
    field("city", t("pl.f.city"), p.city, ""),
    field("price", t(kind === "avg" ? "pl.f.priceAvg" : kind === "ticket" ? "pl.f.priceTicket" : "pl.f.price"), p.price, auto || (kind === "avg" ? "€€" : "15 €")),
    field("location", t("pl.f.loc"), loc, "41.39, 2.17", undefined, loc ? null : button([icon("search"), t("pl.find")], "ct-pfind", () => ctx.locate())),
    field("photo", t("pl.f.cover"), ctx.cover, t("pl.f.coverPh")));

  /* las secciones de su tipo, luego las tuyas («## …» que no son de Cool Trip) y, al final, el post-it de «Datos útiles» */
  const mine = new Set(Object.values(SECS).flatMap(x => (x.title as string[]).map(low)));
  const own = ctx.doc.secs.filter(s => !mine.has(low(s.title)));
  const grid = h("div", { cls: "ct-psecs" }, (TYPE_SECS[type] || TYPE_SECS.other).map(k => section(ctx, k, type)),
    own.map(s => h("section", { cls: "ct-psec is-own" }, h("span", { cls: "ct-psec-head" }, icon("text"), s.title), prose(s.lines))),
    ctx.doc.intro.length ? h("section", { cls: "ct-psec is-own is-wide" }, h("span", { cls: "ct-psec-head" }, icon("notebook-pen"), t("pl.notes")), prose(ctx.doc.intro)) : null,
    section(ctx, "tips", type));
  const trips = ctx.trips.length ? h("div", { cls: "ct-ptrips" }, h("span", { cls: "ct-label" }, t("pl.inTrips")),
    ctx.trips.map(x => button([icon("plane"), h("b", null, x.name), h("span", { cls: "ct-sub" }, x.dates)], "ct-ptrip", () => x.open()))) : null;
  const page = h("div", { cls: "ct-place" + (ctx.phone ? " is-phone" : "") }, hero, facts, props, grid, trips);
  page.setCssProps({ "--ct-cat": color });                 // el color del tipo, para los precios y las etiquetas marcadas
  return page;
}
