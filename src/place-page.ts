/* La ficha de un lugar, pintada: arriba la foto (o el degradado del color de su tipo), sus propiedades como campos y, debajo,
   las secciones de su tipo (place-types.ts), cada una con su formato. Las secciones son «## Título» en el cuerpo de la nota:
   solo se escriben cuando las rellenas, y lo que no es de Cool Trip se queda tal cual. */
import { h } from "./dom";
import { t } from "./i18n";
import { CURRENCIES, priceNumber, priceValue, showPrice, withCurrency } from "./md";
import { button, icon, iconButton, pressable } from "./ui";
import { catColor, catParts, iconFor, placeTypes } from "./places";
import type { PlaceInfo, PlaceType } from "./places";
import { CLOSED, DAYS, HINTS, PRICE_KIND, SECS, TYPE_NAMES, secsFor } from "./place-types";
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
/* « · » separa las columnas; si lo escribes dentro de una («MADROÑO · Negroni»), se guarda con espacios duros y no parte la fila */
const row = (vals: string[]) => { const v = [...vals.map(x => x.trim().replace(/\s+·\s+/g, "\u00A0·\u00A0"))]; while (v.length > 1 && !v[v.length - 1]) v.pop(); return "- " + v.join(" · "); };
/* favoritos de la carta: «- ★ Negroni · 12 €» */
const STAR = /^★\s*/;
/* gratis: «free», «gratis», «0 €» */
export const isFree = (v: string) => /^(free|gratis|gratuit[oa]|0+([.,]0+)?(\s*\S{1,3})?)$/i.test(v.trim());

/* ---------- la vista ---------- */
export type PlaceProp = "category" | "city" | "price" | "location" | "photo" | "rating" | "visited" | "closed";
export interface PlaceCtx {
  place: PlaceInfo; doc: PlaceDoc; phone: boolean; lang: "es" | "en";
  photo: string | null;                                   // la URL de la portada, si es una imagen
  cover: string;                                          // la portada tal como está en la nota
  trips: { name: string; dates: string; open(): void }[];  // los viajes que lo llevan en su plan
  mapsUrl: string;
  currency: string;                                       // la moneda de sus precios (la de los que ya tiene o la de su país)
  countries: string[];                                    // para elegir el país
  today: number;                                          // 0 = lunes (para marcar el día en el horario)
  editing: string | null;                                 // «sección», «sección#n», «sección#new»
  openUrl(url: string): void;
  openLink(name: string): void;
  edit(id: string | null): void;
  setLines(k: SecKey, lines: string[], keep?: boolean, stay?: boolean): void;   // stay: la sección sigue abierta
  setProp(k: PlaceProp, v: string | number | boolean): void;
  ask(title: string, placeholder: string, value?: string): Promise<string | null>;
  pickPlace(): Promise<string | null>;                     // elegir una nota de lugar
  lookup(name: string): { category: string; photo: string | null } | null;
  locate(): void;                                         // buscar las coordenadas
  setCountry(country: string): void;                      // el país de su ciudad (va en los ajustes, no en la nota)
  setCurrency(cur: string): void;                         // cambia la moneda de todos sus precios
  cities: string[];                                       // las ciudades que ya usas (para escribirlas igual)
}
const L = (ctx: PlaceCtx, x: [string, string]) => x[ctx.lang === "en" ? 1 : 0];

/* el precio que se calcula solo: la media de la carta, o la entrada más barata */
function autoPrice(ctx: PlaceCtx, type: PlaceType, secs: SecKey[]): string {
  const kind = PRICE_KIND(type);
  const k = secs.find(x => def(x).fmt === "rows" && (def(x).cols || []).some(c => /precio|price/i.test(c[0])));
  if (!kind || !k) return "";
  const col = (def(k).cols || []).findIndex(c => /precio|price/i.test(c[0]));
  const ps = items(linesOf(ctx.doc, k)).map(x => cells(x.replace(STAR, ""))[col] || "").filter(p => priceValue(p) > 0);
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
/* el lápiz de las secciones que se abren al tocarlas (se ve al pasar por encima; en el móvil, siempre) */
const pen = () => icon("pencil", "ct-ico ct-psec-pen");
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
  return pressable(h("section", { cls: cls + (lines.length ? "" : " is-empty") }, head(ctx, k, pen()), body), () => ctx.edit(k), `${t("edit")}: ${L(ctx, def(k).title)}`);
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

/* filas: nombre · precio · nota (las columnas de la sección), una por cosa; en la carta, con su ★ de favorito */
function rowsSec(ctx: PlaceCtx, k: SecKey, type: PlaceType, extra?: HTMLElement | null): HTMLElement {
  const cols = def(k).cols || [], lines = linesOf(ctx.doc, k), list = items(lines), fav = !!def(k).fav;
  const pc = cols.findIndex(c => /precio|price/i.test(c[0]));
  const write = (l: string[]) => ctx.setLines(k, l.map(x => "- " + x));
  const editor = (i: number | null) => {
    const vals = i == null ? [] : cells(list[i].replace(STAR, ""));
    const ins = cols.map((c, ci) => {
      const x = h("input", { cls: "ct-pin", attr: { type: "text", placeholder: ci === pc ? `${L(ctx, c)} (${ctx.currency})` : L(ctx, c) } });
      x.value = (ci === pc ? priceNumber(vals[ci] || "") || vals[ci] : vals[ci]) || ""; return x;
    });
    window.setTimeout(() => ins[0]?.focus(), 0);
    /* el precio se escribe solo con el número: la moneda es la del lugar */
    const val = (x: HTMLInputElement, ci: number) => ci === pc && /^\d[\d.,]*$/.test(x.value.trim()) ? withCurrency(x.value, ctx.currency) : x.value;
    const save = () => {
      const next = [...list], r = row(ins.map(val));
      if (r.replace(/[-·\s]/g, "")) { const line = (i != null && STAR.test(list[i]) ? "★ " : "") + r.slice(2); if (i == null) next.push(line); else next[i] = line; }
      write(next);
    };
    for (const x of ins) x.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); save(); } });
    return h("div", { cls: "ct-prow is-editing" }, h("div", { cls: "ct-prow-ins", attr: { style: `--n: ${cols.length}` } }, ins),
      foot(ctx, save, i == null ? undefined : () => write(list.filter((_, j) => j !== i))));
  };
  const rows = list.map((x, i) => {
    if (ctx.editing === `${k}#${i}`) return editor(i);
    const on = STAR.test(x), c = cells(x.replace(STAR, "")), rest = c.slice(1).filter((_, j) => j + 1 !== pc && c[j + 1]);
    const free = pc > 0 && !!c[pc] && isFree(c[pc]);
    const r = button([h("span", { cls: "ct-prow-main" }, h("b", null, c[0] || "—"), rest.length ? h("span", { cls: "ct-sub" }, rest.join(" · ")) : null),
      pc > 0 && c[pc] ? h("span", { cls: "ct-prow-price" + (free ? " is-free" : "") }, free ? t("pl.free") : c[pc]) : null], "ct-prow", () => ctx.edit(`${k}#${i}`));
    if (!fav) return r;
    const star = iconButton("star", t(on ? "pl.unfav" : "pl.fav"), () => write(list.map((y, j) => j === i ? (on ? y.replace(STAR, "") : "★ " + y) : y)), "ct-ibtn ct-pfav" + (on ? " is-on" : ""));
    star.setAttribute("aria-pressed", String(on));
    return h("div", { cls: "ct-prow-line" }, star, r);
  });
  const empty = !list.length && ctx.editing !== `${k}#new` ? h("span", { cls: "ct-psec-empty" }, hintOf(ctx, k, type)) : null;
  return h("section", { cls: "ct-psec is-rows" + (list.length ? "" : " is-empty") }, head(ctx, k, extra), empty, rows,
    ctx.editing === `${k}#new` ? editor(null) : addBtn(t("pl.add"), () => ctx.edit(`${k}#new`)));
}

/* horario: los siete días, cada uno con sus turnos («13:00–16:00, 20:00–23:30») o «cerrado» */
interface DayHours { closed: boolean; shifts: [string, string][]; raw: string | null }
const TIME = /^(\d{1,2})(?:[:.h](\d{2}))?$/;
const hhmm = (x: string) => { const m = TIME.exec(x.trim()); return m && +m[1] < 25 ? `${m[1].padStart(2, "0")}:${m[2] || "00"}` : null; };
const short = (x: string) => x.replace(/^0(\d)/, "$1");
export function readDay(v: string, closedWords: string[]): DayHours {
  if (!v.trim()) return { closed: false, shifts: [], raw: null };
  if (closedWords.includes(low(v))) return { closed: true, shifts: [], raw: null };
  const shifts: [string, string][] = [];
  for (const part of v.split(/\s*[,;]\s*|\s+(?:y|and)\s+/)) {
    const m = /^(.+?)\s*[–—-]\s*(.+)$/.exec(part.trim()), a = m && hhmm(m[1]), b = m && hhmm(m[2]);
    if (!a || !b) return { closed: false, shifts: [], raw: v };      // lo que no son horas («24 h», «con cita») se queda como texto
    shifts.push([a, b]);
  }
  return { closed: false, shifts, raw: null };
}
export function writeDay(d: DayHours, closedWord: string): string {
  if (d.closed) return closedWord;
  if (d.raw != null) return d.raw.trim();
  return d.shifts.filter(([a, b]) => a && b).map(([a, b]) => `${short(a)}–${short(b)}`).join(", ");
}
function hoursSec(ctx: PlaceCtx, k: SecKey): HTMLElement {
  const byDay = new Map<number, string>();
  for (const x of items(linesOf(ctx.doc, k))) {
    const m = /^([^:]+):\s*(.*)$/.exec(x);
    const d = m ? DAYS.findIndex(dd => dd.map(low).includes(low(m[1]))) : -1;
    if (d >= 0 && m) byDay.set(d, m[2]);
  }
  const closedWords = CLOSED.map(low);
  const closed = (v: string) => closedWords.includes(low(v));
  if (ctx.editing === k) {
    /* cada día: su apertura y su cierre (y más turnos si los tiene), o cerrado */
    const days: DayHours[] = DAYS.map((_, i) => { const d = readDay(byDay.get(i) || "", closedWords); if (!d.closed && d.raw == null && !d.shifts.length) d.shifts = [["", ""]]; return d; });
    const rows = DAYS.map(() => h("div", { cls: "ct-pday" }));
    const time = (v: string, label: string, set: (x: string) => void) => {
      const x = h("input", { cls: "ct-pin ct-ptime", attr: { type: "time", "aria-label": label } });
      x.value = v; x.addEventListener("change", () => set(x.value)); return x;
    };
    const paint = (i: number) => {
      const d = days[i], el = rows[i];
      el.empty();
      const shut = h("input", { cls: "ct-tick", attr: { type: "checkbox" } });
      shut.checked = d.closed;
      shut.addEventListener("change", () => { d.closed = shut.checked; if (!d.closed && !d.shifts.length && d.raw == null) d.shifts = [["", ""]]; paint(i); });
      const body = d.closed ? h("span")
        : d.raw != null ? (() => { const x = h("input", { cls: "ct-pin", attr: { type: "text", "aria-label": L(ctx, DAYS[i]) } }); x.value = d.raw; x.addEventListener("change", () => { d.raw = x.value; }); return x; })()
        : h("div", { cls: "ct-pshifts" }, d.shifts.map((sh, j) => h("span", { cls: "ct-pshift" },
            time(sh[0], `${L(ctx, DAYS[i])} · ${t("pl.opens")}`, v => { sh[0] = v; }), h("span", { cls: "ct-sub" }, "–"),
            time(sh[1], `${L(ctx, DAYS[i])} · ${t("pl.closes")}`, v => { sh[1] = v; }),
            iconButton("x", t("pl.remove"), () => { d.shifts.splice(j, 1); paint(i); }, "ct-ibtn ct-ppack-x"))),
          button([icon("plus"), d.shifts.length ? t("pl.addShift") : t("pl.addHours")], "ct-padd", () => { d.shifts.push(["", ""]); paint(i); }));
      el.append(h("span", { cls: "ct-pday-name" }, L(ctx, DAYS[i])), body, h("label", { cls: "ct-pday-shut" }, shut, t("pl.closed")));
    };
    DAYS.forEach((_, i) => paint(i));
    /* el horario del lunes, en los días que aún no tienen */
    const same = button(t("pl.sameAll"), "ct-link-btn", () => {
      const a = days[0];
      days.forEach((d, i) => { if (i && !d.closed && d.raw == null && !d.shifts.some(([x, y]) => x || y)) { days[i] = { closed: a.closed, raw: a.raw, shifts: a.shifts.map(([x, y]) => [x, y] as [string, string]) }; paint(i); } });
    });
    const save = () => ctx.setLines(k, days.map((d, i) => { const v = writeDay(d, L(ctx, CLOSED)); return v ? `- ${L(ctx, DAYS[i])}: ${v}` : ""; }).filter(Boolean));
    return h("section", { cls: "ct-psec is-hours is-editing" }, head(ctx, k), h("div", { cls: "ct-pdays" }, rows),
      h("div", { cls: "ct-psec-foot is-left" }, same), foot(ctx, save));
  }
  const el = h("section", { cls: "ct-psec is-hours" + (byDay.size ? "" : " is-empty") }, head(ctx, k, pen()),
    byDay.size ? h("div", { cls: "ct-phours" }, DAYS.map((d, i) => {
      const v = byDay.get(i) || "";
      return h("span", { cls: "ct-phour" + (i === ctx.today ? " is-today" : "") + (closed(v) ? " is-closed" : "") },
        h("span", null, L(ctx, d)), h("b", null, v ? (closed(v) ? t("pl.closed") : v) : "—"));
    })) : h("span", { cls: "ct-psec-empty" }, t("pl.hoursHint")));
  return pressable(el, () => ctx.edit(k), `${t("edit")}: ${L(ctx, def(k).title)}`);
}

/* etiquetas: se ven las que tiene; «+ Añadir» abre las sugeridas del tipo (y una propia), y en ese modo se quitan con la ✕ */
function tagsSec(ctx: PlaceCtx, k: SecKey): HTMLElement {
  const on = items(linesOf(ctx.doc, k)), open = ctx.editing === k;
  const has = (x: string) => on.map(low).includes(low(x));
  const write = (l: string[]) => ctx.setLines(k, l.map(y => "- " + y), false, open);
  const mine = on.map((x, i) => h("span", { cls: "ct-ptag is-on" }, x,
    open ? iconButton("x", t("pl.remove"), () => write(on.filter((_, j) => j !== i)), "ct-ptag-x") : null));
  if (!open) return h("section", { cls: "ct-psec is-tags" + (on.length ? "" : " is-empty") }, head(ctx, k),
    on.length ? h("div", { cls: "ct-ptags" }, mine) : null, addBtn(t("pl.add"), () => ctx.edit(k)));
  const sug = (def(k).tags || []).map(x => L(ctx, x)).filter(x => !has(x));
  const inp = h("input", { cls: "ct-pin ct-padd-in", attr: { type: "text", placeholder: t("pl.newTag") } });
  inp.addEventListener("keydown", ev => { if (ev.key === "Enter" && inp.value.trim() && !has(inp.value)) { ev.preventDefault(); write([...on, inp.value.trim()]); } });
  window.setTimeout(() => inp.focus(), 0);
  return h("section", { cls: "ct-psec is-tags is-editing" }, head(ctx, k),
    on.length ? h("div", { cls: "ct-ptags" }, mine) : null,
    sug.length ? h("div", { cls: "ct-ptags is-sug" }, h("span", { cls: "ct-sub" }, t("pl.suggested")),
      sug.map(x => button([icon("plus"), x], "ct-ptag", () => write([...on, x])))) : null,
    inp, h("div", { cls: "ct-psec-foot" }, h("span", { cls: "ct-grow" }), button(t("pl.done"), "ct-btn-primary is-small", () => ctx.edit(null))));
}

/* datos: campos con nombre fijo («Teléfono: …»). Lo demás que haya escrito en la sección se ve debajo y se guarda igual */
const linkOf = (v: string): { url: string; icon: string } | null => {
  const x = v.trim();
  if (/^https?:\/\//i.test(x)) return { url: x, icon: "external-link" };
  if (/^www\./i.test(x)) return { url: "https://" + x, icon: "external-link" };
  if (/^[^@\s]+@[^@\s]+\.\w+$/.test(x)) return { url: "mailto:" + x, icon: "mail" };
  if (/^\+?[\d\s().-]{6,}$/.test(x) && (x.match(/\d/g) || []).length >= 6) return { url: "tel:" + x.replace(/[^\d+]/g, ""), icon: "phone" };
  return null;
};
function specsSec(ctx: PlaceCtx, k: SecKey): HTMLElement {
  const fields = def(k).fields || [], lines = linesOf(ctx.doc, k), list = items(lines);
  const isField = (y: string) => fields.some(f => f.map(low).some(n => low(y).startsWith(n + ":")));
  const other = lines.filter(l => l.trim() && !(bullet(l) != null && isField(bullet(l) as string)));
  const val = (f: [string, string]) => { const x = list.find(y => f.map(low).some(n => low(y).startsWith(n + ":"))); return x ? x.slice(x.indexOf(":") + 1).trim() : ""; };
  const vals = fields.map(val);
  const save = (i: number, v: string) => ctx.setLines(k, [...fields.map((f, j) => { const x = j === i ? v.trim() : vals[j]; return x ? `- ${L(ctx, f)}: ${x}` : ""; }).filter(Boolean), ...other]);
  return h("section", { cls: "ct-psec is-specs" }, head(ctx, k), h("div", { cls: "ct-pspecs" }, fields.map((f, i) => {
    if (ctx.editing === `${k}#${i}`) {
      const x = h("input", { cls: "ct-pin", attr: { type: "text", placeholder: L(ctx, f) } });
      x.value = vals[i];
      window.setTimeout(() => x.focus(), 0);
      x.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); save(i, x.value); } else if (ev.key === "Escape") ctx.edit(null); });
      x.addEventListener("blur", () => save(i, x.value));
      return h("label", { cls: "ct-pspec is-editing" }, h("span", null, L(ctx, f)), x);
    }
    const spec = button([h("span", null, L(ctx, f)), vals[i] ? h("b", null, vals[i]) : h("span", { cls: "ct-psec-empty" }, t("pl.add"))], "ct-pspec", () => ctx.edit(`${k}#${i}`));
    const link = vals[i] ? linkOf(vals[i]) : null;
    return link ? h("div", { cls: "ct-pspec-line" }, spec, iconButton(link.icon, t("pl.open"), () => ctx.openUrl(link.url), "ct-ibtn ct-ibtn-sm")) : spec;
  })), other.length ? prose(other) : null);
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

/* ---------- la cabecera, abierta para editar ---------- */
function heroForm(ctx: PlaceCtx, type: PlaceType, priceLabel: string, auto: string): HTMLElement {
  const p = ctx.place;
  const lab = (label: string, el: HTMLElement, cls = "") => h("label", { cls: "ct-pfield" + cls }, h("span", { cls: "ct-label" }, label), el);
  const text = (k: PlaceProp, value: string, ph: string, list?: string, set: (v: string) => void = v => ctx.setProp(k, v)) => {
    const inp = h("input", { cls: "ct-pin", attr: { type: "text", placeholder: ph, "data-field": list === "ct-place-countries" ? "country" : k, ...(list ? { list } : {}) } });
    inp.value = value;
    inp.addEventListener("change", () => { if (inp.value.trim() !== value) set(inp.value.trim()); });
    inp.addEventListener("keydown", ev => { if (ev.key === "Enter") inp.blur(); });
    return inp;
  };
  /* el tipo: un desplegable por tipo (un bar que también es restaurante lleva dos); el primero da el icono y el color */
  const names = Object.values(TYPE_NAMES).map(n => L(ctx, n));
  const parts = catParts(p.category);
  const writeCat = (next: string[]) => ctx.setProp("category", next.map(x => x.trim()).filter(Boolean).join(", "));
  const typeSel = (cur: string, i: number) => {
    const sel = h("select", { cls: "ct-pin ct-psel", attr: { "aria-label": t("pl.f.category") } });
    const opts: [string, string][] = [["", i ? t("pl.f.removeType") : t("pl.f.noType")], ...names.map(n => [n, n] as [string, string])];
    if (cur && !names.some(n => low(n) === low(cur))) opts.splice(1, 0, [cur, cur]);
    opts.push(["\u0000", t("pl.f.otherType")]);
    for (const [v, l] of opts) { const o = h("option", { attr: { value: v } }, l); if (low(v) === low(cur) && (v || !cur)) o.selected = true; sel.appendChild(o); }
    const put = (v: string) => { const next = [...parts]; if (i < next.length) next[i] = v; else next.push(v); writeCat(next); };
    sel.addEventListener("change", () => {
      if (sel.value !== "\u0000") { put(sel.value); return; }
      void ctx.ask(t("pl.f.category"), t("pl.f.categoryPh"), cur).then(v => { if (v?.trim()) put(v.trim()); else sel.value = cur; });
    });
    return sel;
  };
  const sels = (parts.length ? parts : [""]).map((x, i) => typeSel(x, i));
  const more = parts.length ? (() => { const b = button([icon("plus"), t("pl.f.addType")], "ct-padd ct-padd-type", () => { const x = typeSel("", parts.length); b.replaceWith(x); x.focus(); }); return b; })() : null;
  const loc = p.loc ? `${p.loc[0]}, ${p.loc[1]}` : "";
  const cur = h("select", { cls: "ct-pin ct-pcur", attr: { "aria-label": t("pl.f.currency") } });
  for (const c of CURRENCIES) { const o = h("option", { attr: { value: c } }, c); if (c === ctx.currency) o.selected = true; cur.appendChild(o); }
  cur.addEventListener("change", () => ctx.setCurrency(cur.value));
  const countries = h("datalist", { attr: { id: "ct-place-countries" } }, ctx.countries.map(c => h("option", { attr: { value: c } })));
  const cities = h("datalist", { attr: { id: "ct-place-cities" } }, ctx.cities.map(c => h("option", { attr: { value: c } })));
  const shut = h("input", { cls: "ct-tick", attr: { type: "checkbox" } });
  shut.checked = p.closed;
  shut.addEventListener("change", () => ctx.setProp("closed", shut.checked));
  return h("div", { cls: "ct-phero-form" }, countries, cities,
    h("span", { cls: "ct-phero-kind" }, icon(iconFor(p.category)), p.name.toUpperCase()),
    h("div", { cls: "ct-pform-grid" },
      h("div", { cls: "ct-pfield is-types" }, h("span", { cls: "ct-label" }, t("pl.f.category")), h("div", { cls: "ct-ptypes" }, sels, more)),
      lab(priceLabel, h("span", { cls: "ct-pfield-in" }, text("price", priceNumber(p.price) || p.price, auto ? priceNumber(auto) : pricePh(type), undefined,
        v => ctx.setProp("price", /^\d[\d.,]*$/.test(v) ? withCurrency(v, ctx.currency) : v)), cur)),
      lab(t("pl.f.city"), text("city", p.city, "", "ct-place-cities")),
      lab(t("pl.f.country"), text("city", p.country, "", "ct-place-countries", v => ctx.setCountry(v))),
      lab(t("pl.f.loc"), h("span", { cls: "ct-pfield-in" }, text("location", loc, "41.39, 2.17"), button([icon("search"), t("pl.find")], "ct-pfind", () => ctx.locate()))),
      lab(t("pl.f.cover"), text("photo", ctx.cover, t("pl.f.coverPh")), " is-wide"),
      h("label", { cls: "ct-pfield is-wide ct-pshut" }, shut, h("span", null, h("b", null, t("pl.f.closed")), h("span", { cls: "ct-sub" }, t("pl.f.closedD"))))));
}
const pricePh = (type: PlaceType) => PRICE_KIND(type) === "avg" ? "€€" : "15";

/* ---------- la ficha entera ---------- */
export function placePage(ctx: PlaceCtx): HTMLElement {
  const p = ctx.place, types = placeTypes(p.category), type = types[0], color = catColor(p.category), secs = secsFor(types);
  const kindName = type === "other" ? "" : L(ctx, TYPE_NAMES[type]);
  const kind = PRICE_KIND(types.find(x => PRICE_KIND(x)) || type), auto = autoPrice(ctx, types.find(x => PRICE_KIND(x)) || type, secs);
  const priceLabel = t(kind === "avg" ? "pl.f.priceAvg" : kind === "ticket" ? "pl.f.priceTicket" : "pl.f.price");
  const price = p.price ? showPrice(p.price, ctx.currency) : auto;
  const editing = ctx.editing === "hero";
  /* la cabecera: la foto fundida en el color del tipo o, sin foto, un degradado de ese color con su icono grande. Como el billete
     del viaje: se ve fija y el lápiz la abre para editar el tipo, el sitio (ciudad, país y coordenadas), el precio y la foto */
  const art = ctx.photo ? h("img", { cls: "ct-phero-img", attr: { src: ctx.photo, alt: "" } }) : h("span", { cls: "ct-phero-art", attr: { "aria-hidden": "true" } }, icon(iconFor(p.category)));
  const lock = iconButton(editing ? "check" : "pencil", t(editing ? "pl.done" : "pl.edit"), () => ctx.edit(editing ? null : "hero"), "ct-lock-btn" + (editing ? " is-on" : ""));
  const hero = h("header", { cls: "ct-phero" + (ctx.photo ? " has-photo" : "") + (editing ? " is-editing" : "") + (p.closed ? " is-closed" : "") }, art, lock,
    editing ? heroForm(ctx, type, priceLabel, auto) : h("div", { cls: "ct-phero-text" },
      h("span", { cls: "ct-phero-kind" }, icon(iconFor(p.category)), (p.category || kindName || t("pl.fam.other")).toUpperCase()),
      h("h1", { cls: "ct-phero-name" }, p.name),
      h("span", { cls: "ct-phero-where" }, [p.city, p.country].filter(Boolean).join(" · ")),
      h("span", { cls: "ct-phero-tags" }, p.closed ? h("span", { cls: "ct-phero-closed" }, icon("ban"), t("pl.closedForever")) : null,
        price ? h("span", { cls: "ct-phero-price" + (isFree(price) ? " is-free" : "") }, `${priceLabel} · ${isFree(price) ? t("pl.free") : price}`) : null)));

  /* Maps, visitado y estrellas: tocar es escribir (y solo entonces se crea la propiedad) */
  const stars = h("span", { cls: "ct-pstars", attr: { role: "radiogroup", "aria-label": t("pl.rating") } },
    [1, 2, 3, 4, 5].map(n => button(icon("star"), "ct-pstar" + (n <= p.rating ? " is-on" : ""), () => ctx.setProp("rating", n === p.rating ? 0 : n),
      { role: "radio", "aria-checked": String(n === p.rating), "aria-label": `${n}/5` })));
  const seen = button([icon(p.visited ? "circle-check" : "circle"), t(p.visited ? "pl.visited" : "pl.toVisit")], "ct-pchip" + (p.visited ? " is-on" : ""),
    () => ctx.setProp("visited", !p.visited), { "aria-pressed": String(p.visited) });
  const maps = button([icon("map-pin"), t("pl.maps")], "ct-pmaps", () => ctx.openUrl(ctx.mapsUrl));
  const facts = h("div", { cls: "ct-pfacts" }, maps, seen, stars);

  /* las secciones de su tipo, luego las tuyas («## …» que no son de Cool Trip) y, al final, el post-it de «Datos útiles» */
  const mine = new Set(Object.values(SECS).flatMap(x => (x.title as string[]).map(low)));
  const own = ctx.doc.secs.filter(s => !mine.has(low(s.title)));
  /* las de Cool Trip que tiene escritas y no son de su tipo (si le cambias el tipo, no se pierden) */
  const shownTitles = new Set(secs.flatMap(titles));
  const kept = (Object.keys(SECS) as SecKey[]).filter(k => k !== "tips" && !secs.includes(k) && secOf(ctx.doc, k) && !titles(k).some(x => shownTitles.has(x)) && (shownTitles.add(titles(k)[0]), true));
  const grid = h("div", { cls: "ct-psecs" }, [...secs, ...kept].map(k => section(ctx, k, type)),
    own.map(s => h("section", { cls: "ct-psec is-own" }, h("span", { cls: "ct-psec-head" }, icon("text"), s.title), prose(s.lines))),
    ctx.doc.intro.length ? h("section", { cls: "ct-psec is-own is-wide" }, h("span", { cls: "ct-psec-head" }, icon("notebook-pen"), t("pl.notes")), prose(ctx.doc.intro)) : null,
    section(ctx, "tips", type));
  const trips = ctx.trips.length ? h("div", { cls: "ct-ptrips" }, h("span", { cls: "ct-label" }, t("pl.inTrips")),
    ctx.trips.map(x => button([icon("plane"), h("b", null, x.name), h("span", { cls: "ct-sub" }, x.dates)], "ct-ptrip", () => x.open()))) : null;
  const page = h("div", { cls: "ct-place" + (ctx.phone ? " is-phone" : "") }, hero, facts, grid, trips);
  page.setCssProps({ "--ct-cat": color });                 // el color del tipo, para los precios y las etiquetas marcadas
  return page;
}
