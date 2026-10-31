/* La nota de un lugar, pintada: arriba la foto (o el color y el icono de su tipo), y debajo las secciones que tocan según
   el tipo (comer: qué pedir, reservar…; ver: entradas, qué no perderse…). Las secciones son «## Título» en el cuerpo de la
   nota: solo se escriben cuando las rellenas, y lo que no es de Cool Trip se queda tal cual. */
import { h } from "./dom";
import { t } from "./i18n";
import { button, icon } from "./ui";
import { catColor, catFamily, iconFor } from "./places";
import type { Family, PlaceInfo } from "./places";

export type SecKey = "order" | "book" | "hours" | "tickets" | "dontMiss" | "getThere" | "bestTime" | "stay" | "tips";
const SECS: Record<SecKey, { icon: string; es: string; en: string }> = {
  order: { icon: "chef-hat", es: "Qué pedir", en: "What to order" },
  book: { icon: "calendar-check", es: "Reservar", en: "Booking" },
  hours: { icon: "clock", es: "Horario", en: "Opening hours" },
  tickets: { icon: "ticket", es: "Entradas", en: "Tickets" },
  dontMiss: { icon: "star", es: "Qué no perderse", en: "Don't miss" },
  getThere: { icon: "route", es: "Cómo llegar", en: "Getting there" },
  bestTime: { icon: "sun", es: "Mejor momento", en: "Best time" },
  stay: { icon: "key-round", es: "Llegada y salida", en: "Check-in and out" },
  tips: { icon: "info", es: "Datos útiles", en: "Good to know" },
};
/* las secciones de cada grupo, en orden */
const BY_FAMILY: Record<Family, SecKey[]> = {
  eat: ["order", "book", "hours", "tips"],
  see: ["tickets", "dontMiss", "hours", "tips"],
  walk: ["getThere", "bestTime", "tips"],
  sleep: ["stay", "tips"],
  other: ["hours", "tips"],
};

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
const secOf = (doc: PlaceDoc, k: SecKey) => doc.secs.find(s => [SECS[k].es, SECS[k].en].map(low).includes(low(s.title)));
/* escribe una sección (vacía: se quita) */
export function setSection(doc: PlaceDoc, k: SecKey, text: string, lang: "es" | "en") {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd());
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const cur = secOf(doc, k);
  if (!lines.length) { if (cur) doc.secs.splice(doc.secs.indexOf(cur), 1); return; }
  if (cur) cur.lines = lines; else doc.secs.push({ title: SECS[k][lang], lines });
}

/* ---------- la vista ---------- */
export interface PlaceCtx {
  place: PlaceInfo; doc: PlaceDoc; phone: boolean; lang: "es" | "en";
  photo: string | null;                                   // la URL de la portada, si es una imagen
  trips: { name: string; dates: string; open(): void }[];  // los viajes que lo llevan en su plan
  mapsUrl: string;
  editing: SecKey | null;
  openUrl(url: string): void;
  edit(k: SecKey | null): void;                            // abrir o cerrar una sección para escribir
  saveSection(k: SecKey, text: string): void;
  setRating(n: number): void;
  setVisited(on: boolean): void;
  setPrice(): void;
}

/* las líneas de una sección: listas como lista, lo demás como párrafos */
function prose(lines: string[]): HTMLElement {
  const box = h("div", { cls: "ct-psec-text" });
  let ul: HTMLElement | null = null;
  for (const l of lines) {
    const li = /^\s*[-*]\s+(?:\[[ x]\]\s+)?(.*)$/.exec(l);
    if (li) { if (!ul) box.appendChild(ul = h("ul")); ul.appendChild(h("li", null, li[1])); continue; }
    ul = null;
    if (l.trim()) box.appendChild(h("p", null, l));
  }
  return box;
}

export function placePage(ctx: PlaceCtx): HTMLElement {
  const p = ctx.place, fam = catFamily(p.category), color = catColor(p.category);
  /* la cabecera: la foto o el color del tipo, con su icono grande */
  const hero = h("header", { cls: "ct-phero" + (ctx.photo ? " has-photo" : "") },
    ctx.photo ? h("img", { cls: "ct-phero-img", attr: { src: ctx.photo, alt: "" } }) : h("span", { cls: "ct-phero-art", attr: { "aria-hidden": "true" } }, icon(iconFor(p.category))),
    h("div", { cls: "ct-phero-text" },
      h("span", { cls: "ct-phero-kind" }, icon(iconFor(p.category)), (p.category || t("pl.fam." + fam)).toUpperCase()),
      h("h1", { cls: "ct-phero-name" }, p.name),
      h("span", { cls: "ct-phero-where" }, [p.city, p.country].filter(Boolean).join(" · "))));
  hero.setCssProps({ "--ct-cat": color });
  /* estrellas, visitado y precio: tocar es escribir (y solo entonces se crea la propiedad) */
  const stars = h("span", { cls: "ct-pstars", attr: { role: "radiogroup", "aria-label": t("pl.rating") } },
    [1, 2, 3, 4, 5].map(n => button(icon("star"), "ct-pstar" + (n <= p.rating ? " is-on" : ""), () => ctx.setRating(n === p.rating ? 0 : n),
      { role: "radio", "aria-checked": String(n === p.rating), "aria-label": String(n) })));
  const seen = button([icon(p.visited ? "circle-check" : "circle"), t(p.visited ? "pl.visited" : "pl.toVisit")], "ct-pchip" + (p.visited ? " is-on" : ""),
    () => ctx.setVisited(!p.visited), { "aria-pressed": String(p.visited) });
  const price = button([icon(fam === "eat" ? "wallet" : "ticket"), p.price || t(fam === "eat" ? "pl.addPriceEat" : "pl.addPrice")], "ct-pchip" + (p.price ? "" : " is-empty"), () => ctx.setPrice());
  const maps = button([icon("map-pin"), t("pl.maps")], "ct-pmaps", () => ctx.openUrl(ctx.mapsUrl));
  maps.setCssProps({ "--ct-cat": color });
  const facts = h("div", { cls: "ct-pfacts" }, maps, seen, price, stars);

  /* las secciones de su tipo, y las tuyas («## …» que no son de Cool Trip) */
  const card = (k: SecKey) => {
    const s = secOf(ctx.doc, k), head = h("span", { cls: "ct-psec-head" }, icon(SECS[k].icon), SECS[k][ctx.lang]);
    if (ctx.editing === k) {
      const ta = h("textarea", { cls: "ct-psec-input", attr: { rows: "5", placeholder: t("pl.ph." + k) } });
      ta.value = s ? s.lines.join("\n") : "";
      window.setTimeout(() => ta.focus(), 0);
      return h("section", { cls: "ct-psec is-editing" }, head, ta, h("div", { cls: "ct-psec-foot" },
        button(t("f.cancel"), "ct-link-btn", () => ctx.edit(null)), button(t("f.save"), "ct-btn-primary", () => ctx.saveSection(k, ta.value))));
    }
    if (!s) return button([head, h("span", { cls: "ct-psec-empty" }, t("pl.ph." + k))], "ct-psec is-empty", () => ctx.edit(k));
    const el = h("section", { cls: "ct-psec" }, head, prose(s.lines));
    el.addEventListener("click", () => ctx.edit(k));
    return el;
  };
  const mine = new Set(Object.values(SECS).flatMap(x => [low(x.es), low(x.en)]));
  const own = ctx.doc.secs.filter(s => !mine.has(low(s.title)));
  const grid = h("div", { cls: "ct-psecs" }, BY_FAMILY[fam].map(card),
    own.map(s => h("section", { cls: "ct-psec is-own" }, h("span", { cls: "ct-psec-head" }, icon("text"), s.title), prose(s.lines))));
  const notes = ctx.doc.intro.length ? h("section", { cls: "ct-psec is-own is-wide" }, h("span", { cls: "ct-psec-head" }, icon("notebook-pen"), t("pl.notes")), prose(ctx.doc.intro)) : null;
  const trips = ctx.trips.length ? h("div", { cls: "ct-ptrips" }, h("span", { cls: "ct-label" }, t("pl.inTrips")),
    ctx.trips.map(x => button([icon("plane"), h("b", null, x.name), h("span", { cls: "ct-sub" }, x.dates)], "ct-ptrip", () => x.open()))) : null;
  return h("div", { cls: "ct-place" + (ctx.phone ? " is-phone" : "") }, hero, facts, grid, notes, trips);
}
