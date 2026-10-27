/* El plan del viaje: una línea continua, día tras día. Pinta los pasos escritos en la nota y los que calcula
   el plugin (llegadas, check-outs, desayunos incluidos y huecos: comidas, alojamiento, transporte). */
import type { App, TFile } from "obsidian";
import { h } from "./dom";
import { t, vocab } from "./i18n";
import { addDays, dayLabel, dayNum, diffDays, isIso, monthShort, range, spanLabel, weekday } from "./dates";
import { citiesOfDay, field, fmtMoney, currencyOf, newItem, priceValue, splitWhen } from "./md";
import { cloudName, iconFor, mapsUrl, placeInfo, resolve } from "./places";
import type { PlaceInfo } from "./places";
import type { Day, Doc, Item, Kind, Settings, Trip } from "./types";
import { isTransport } from "./types";
import { button, destHex, faces, icon, iconButton, label, notchH, notchV } from "./ui";

export interface FormState { day: number; index: number; draft: Item; isNew: boolean }
export interface PlanCtx {
  app: App; s: Settings; trip: Trip; file: TFile; phone: boolean;
  form: FormState | null;
  collapsed: Set<string>;
  commit(): void;
  rerender(): void;
  openForm(f: FormState | null): void;
  renderForm(f: FormState): HTMLElement;
  openLink(link: string): void;
  openDoc(d: Doc): void;
  openUrl(url: string): void;
}

/* ---------- lo que se calcula ---------- */
type MealKey = "breakfast" | "lunch" | "dinner";
const MEAL_TIME: Record<MealKey, string> = { breakfast: "08:00", lunch: "13:30", dinner: "20:30" };
const mealKeyOf = (title: string): MealKey | "snack" | null => {
  const s = title.toLowerCase();
  for (const v of [vocab(), { meals: { breakfast: "Desayuno", lunch: "Comida", dinner: "Cena", snack: "Picar algo" } }, { meals: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" } }])
    for (const [k, m] of Object.entries(v.meals)) if (s === m.toLowerCase()) return k as MealKey | "snack";
  return null;
};
export function itemDates(it: Item, dayDate: string, near: string): { from: string; to: string; fromTime: string; toTime: string; fromAt: string; toAt: string } {
  const isLodging = it.kind === "lodging";
  const a = splitWhen(field(it, isLodging ? "checkin" : "depart"), near), b = splitWhen(field(it, isLodging ? "checkout" : "arrive"), near);
  return { from: a.date || dayDate, to: b.date || (isLodging ? "" : a.date || dayDate), fromTime: a.time || it.time, toTime: b.time, fromAt: a.at, toAt: b.at };
}
interface LodgingSpan { item: Item; from: string; to: string; toTime: string; includesBreakfast: boolean }
export function lodgings(tr: Trip): LodgingSpan[] {
  const out: LodgingSpan[] = [];
  for (const d of tr.days) for (const it of d.items) if (it.kind === "lodging") {
    const w = itemDates(it, d.date, tr.start);
    const to = w.to || addDays(w.from, 1);
    out.push({ item: it, from: w.from, to, toTime: w.toTime, includesBreakfast: /desayuno|breakfast/i.test(field(it, "includes")) });
  }
  return out;
}
const sleptAt = (spans: LodgingSpan[], night: string) => spans.find(l => l.from <= night && night < l.to) || null;

type Row =
  | { r: "item"; item: Item; index: number; time: string }
  | { r: "mini"; time: string; title: string; sub: string }
  | { r: "breakfast"; time: string; span: LodgingSpan }
  | { r: "meal"; time: string; meal: MealKey }
  | { r: "lodging"; time: string; city: string; from: string; to: string }
  | { r: "transport"; time: string; which: "out" | "back" };

function rowsOf(tr: Trip, di: number, spans: LodgingSpan[]): Row[] {
  const day = tr.days[di], date = day.date;
  const written: Row[] = [];
  let last = "00:00";
  day.items.forEach((item, index) => { if (item.time) last = item.time; written.push({ r: "item", item, index, time: item.time || last }); });
  if (!isIso(date) || date < tr.start || date > tr.end) return written;
  const extra: Row[] = [];
  /* llegadas de transportes que salieron otro día, y check-outs */
  for (const d of tr.days) for (const it of d.items) {
    if (isTransport(it.kind)) {
      const w = itemDates(it, d.date, tr.start);
      if (w.to === date && w.from !== date && w.toTime) extra.push({ r: "mini", time: w.toTime, title: t("arrive.at", { p: routeOf(it).to || w.toAt }), sub: it.title });
    }
  }
  for (const l of spans) if (l.to === date && l.toTime) extra.push({ r: "mini", time: l.toTime, title: t("checkout"), sub: l.item.link || l.item.title });
  /* comidas: el desayuno incluido como paso; las que faltan, como huecos */
  const has = (k: MealKey) => day.items.some(i => i.kind === "meal" && mealKeyOf(i.title) === k);
  const transit = day.items.some(i => isTransport(i.kind)) && (date === tr.start || date === tr.end);
  const prevNight = addDays(date, -1);
  const span = date > tr.start ? sleptAt(spans, prevNight) : null;
  if (!has("breakfast")) {
    if (span?.includesBreakfast) extra.push({ r: "breakfast", time: MEAL_TIME.breakfast, span });
    else if (date > tr.start && !transit) extra.push({ r: "meal", time: MEAL_TIME.breakfast, meal: "breakfast" });
  }
  if (!transit) for (const k of ["lunch", "dinner"] as MealKey[]) if (!has(k)) extra.push({ r: "meal", time: MEAL_TIME[k], meal: k });
  /* alojamiento que falta: el primer día de cada destino sin ninguna noche cubierta */
  let acc = 0;
  for (const dest of tr.dests) {
    const first = addDays(tr.start, acc), nights = dest.nights;
    acc += nights;
    if (nights > 0 && first === date) {
      const covered = Array.from({ length: nights }, (_, i) => addDays(first, i)).some(n => sleptAt(spans, n));
      if (!covered) extra.push({ r: "lodging", time: "15:00", city: dest.city, from: first, to: addDays(first, nights) });
    }
  }
  /* transporte de ida y de vuelta */
  const anyTransport = (d: Day) => d.items.some(i => isTransport(i.kind));
  if (date === tr.start && !anyTransport(day)) extra.push({ r: "transport", time: "00:00", which: "out" });
  if (date === tr.end && date !== tr.start && !anyTransport(day)) extra.push({ r: "transport", time: "23:59", which: "back" });

  /* se mezclan por hora (a igual hora, primero lo escrito) */
  const out: Row[] = [];
  const rest = [...extra].sort((a, b) => a.time.localeCompare(b.time));
  for (const w of written) {
    while (rest.length && rest[0].time < w.time) out.push(rest.shift()!);
    out.push(w);
  }
  out.push(...rest);
  return out;
}

/* «Vuelo MAD → NRT» → MAD, NRT */
export function routeOf(it: Item): { from: string; to: string } {
  const words = it.title.split(/\s+/);
  const rest = words.slice(1).join(" ");
  const m = /^(.*?)\s*(?:→|->|–|—|-|>)\s*(.*)$/.exec(rest);
  return m ? { from: m[1].trim(), to: m[2].trim() } : { from: rest, to: "" };
}
const transportIcon: Record<string, string> = { flight: "plane", train: "train-front", bus: "bus", car: "car", boat: "ship" };
export const kindIcon = (k: Kind) => isTransport(k) ? transportIcon[k] : k === "lodging" ? "bed-double" : k === "ticket" ? "ticket" : k === "meal" ? "utensils" : k === "rest" ? "bed-double" : k === "note" ? "sticky-note" : "map-pin";

/* ---------- piezas ---------- */
function rowEl(ctx: PlanCtx, node: HTMLElement, content: HTMLElement | null, top = false, cls = ""): HTMLElement {
  return h("div", { cls: "ct-row" + (top ? " is-top" : "") + (cls ? " " + cls : "") }, h("span", { cls: "ct-node" }, node), h("div", { cls: "ct-row-body" }, content));
}
const timeEl = (time: string) => h("span", { cls: "ct-time" }, time || "");
function check(ctx: PlanCtx, done: boolean, onToggle: () => void): HTMLElement {
  return button(done ? icon("check") : null, "ct-check" + (done ? " is-done" : ""), onToggle, { role: "checkbox", "aria-checked": String(done), "aria-label": t("done") });
}
function nodeIcon(name: string, color: string, small = false): HTMLElement {
  const el = h("span", { cls: "ct-node-icon" + (small ? " is-small" : "") }, icon(name));
  el.setCssProps({ "--ct-node": color });
  return el;
}
const dot = () => h("span", { cls: "ct-dot" });
const bubble = (name: string) => h("span", { cls: "ct-bubble" }, icon(name));

function placeOf(ctx: PlanCtx, link: string): PlaceInfo | null {
  if (!link) return null;
  const f = resolve(ctx.app, link, ctx.file.path);
  return f ? placeInfo(ctx.app, ctx.s, f) : null;
}
function cityOfDay(ctx: PlanCtx, date: string): string {
  const cs = isIso(date) ? citiesOfDay(ctx.trip, date) : [];
  return cs.length ? cs[cs.length - 1].city : "";
}
function mapButton(ctx: PlanCtx, name: string, info: PlaceInfo | null, date: string): HTMLElement {
  const url = mapsUrl(ctx.s.maps.app, name, info?.city || cityOfDay(ctx, date), info?.loc || null);
  return iconButton("map-pin", t("map"), () => ctx.openUrl(url), "ct-map");
}
function placeLink(ctx: PlanCtx, name: string, link: string, cls = "ct-place-link"): HTMLElement {
  if (!link) return h("span", { cls: cls + " is-plain" }, name);
  const a = h("a", { cls, attr: { href: "#", "data-href": link } }, h("span", null, name), icon("arrow-up-right", "ct-ico ct-ico-xs"));
  a.addEventListener("click", ev => { ev.preventDefault(); ctx.openLink(link); });
  return a;
}
const editBtn = (ctx: PlanCtx, di: number, index: number, item: Item) =>
  iconButton("pencil", t("edit"), () => ctx.openForm({ day: di, index, draft: structuredClone(item), isNew: false }), "ct-ibtn ct-ibtn-sm");
const peopleLabel = (ctx: PlanCtx, it: Item) => it.para.length ? it.para : ctx.trip.travelers;

/* documentos: botones finos de una línea */
export function docButton(ctx: Pick<PlanCtx, "openDoc">, d: Doc): HTMLElement {
  const paper = d.where === "paper";
  const where = paper ? null : d.where === "cloud" ? (cloudName(d.url) || t("w.cloud")) : t("w." + d.where);
  const b = button([icon(d.where === "wallet" ? "wallet" : paper ? "file-text" : d.where === "vault" ? "file" : "file-text"),
    h("span", { cls: "ct-doc-name" }, d.name),
    paper ? h("span", { cls: "ct-paper-tag" }, icon("file-text"), t("paper")) : h("span", { cls: "ct-doc-where" }, where),
    paper ? null : icon("arrow-up-right", "ct-ico ct-ico-xs")], "ct-doc" + (paper ? " is-paper" : ""), () => ctx.openDoc(d));
  return b;
}
function docsBlock(ctx: PlanCtx, it: Item, di: number, index: number, inline: boolean): HTMLElement {
  return h("div", { cls: "ct-docs" + (inline ? " is-inline" : "") },
    it.docs.map(d => docButton(ctx, d)),
    button([icon("plus"), h("span", null, t("doc.add"))], "ct-link-btn", () => ctx.openForm({ day: di, index, draft: structuredClone(it), isNew: false })));
}
function details(pairs: [string, string][]): HTMLElement | null {
  const ok = pairs.filter(p => p[1]);
  if (!ok.length) return null;
  return h("div", { cls: "ct-details" }, ok.map(([k, v]) => h("span", { cls: "ct-detail" }, label(k), h("span", { cls: "ct-detail-v" }, v))));
}
function kindRow(ctx: PlanCtx, text: string, it: Item, di: number, index: number, key: string): HTMLElement {
  const open = !ctx.collapsed.has(key);
  return h("div", { cls: "ct-kind-row" }, h("span", { cls: "ct-kind" }, text), h("span", { cls: "ct-grow" }),
    faces(peopleLabel(ctx, it), ctx.trip.travelers), editBtn(ctx, di, index, it),
    iconButton(open ? "chevron-down" : "chevron-right", t(open ? "collapse" : "expand"), () => {
      if (open) ctx.collapsed.add(key); else ctx.collapsed.delete(key);
      ctx.rerender();
    }, "ct-ibtn ct-ibtn-sm"));
}
const itemKey = (di: number, index: number, it: Item) => `${di}:${index}:${it.kind}:${it.title}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ---------- reservas ---------- */
function transportCard(ctx: PlanCtx, it: Item, di: number, index: number): HTMLElement {
  const tr = ctx.trip, date = tr.days[di].date;
  const w = itemDates(it, date, tr.start), r = routeOf(it);
  const key = itemKey(di, index, it);
  const kindText = t("k." + it.kind) + (field(it, "code") ? " · " + field(it, "code") : "");
  if (ctx.collapsed.has(key)) {
    return h("article", { cls: "ct-card ct-card-collapsed" }, timeEl(it.time),
      h("span", { cls: "ct-collapsed-main" }, h("span", { cls: "ct-collapsed-title" }, `${r.from} → ${r.to}`),
        h("span", { cls: "ct-sub" }, [kindText, w.toTime ? `→ ${w.toTime}` : "", it.docs.length ? plural(it.docs.length, t("f.docName").toLowerCase(), t("f.docs").toLowerCase()) : ""].filter(Boolean).join(" · "))),
      it.price ? h("span", { cls: "ct-price" }, it.price) : null,
      iconButton("chevron-right", t("expand"), () => { ctx.collapsed.delete(key); ctx.rerender(); }, "ct-ibtn ct-ibtn-sm"));
  }
  const end = (code: string, time: string, sub: string, right: boolean) => h("span", { cls: "ct-end" + (right ? " is-right" : "") },
    h("span", { cls: "ct-end-code" }, code || "—"), h("span", { cls: "ct-end-time" }, time + (right && w.to && w.to !== w.from ? ` +${diffDays(w.from, w.to)}` : "")), h("span", { cls: "ct-sub" }, sub));
  const route = h("div", { cls: "ct-route-big" },
    end(r.from, w.fromTime, [w.from ? dayLabel(w.from) : "", w.fromAt].filter(Boolean).join(" · "), false),
    h("span", { cls: "ct-route-mid" }, h("span", { cls: "ct-route-dash" }), icon(transportIcon[it.kind] || "plane"), h("span", { cls: "ct-route-dash" })),
    end(r.to, w.toTime, [w.to ? dayLabel(w.to) : "", w.toAt].filter(Boolean).join(" · "), true));
  const main = h("div", { cls: "ct-card-main" }, kindRow(ctx, kindText, it, di, index, key), route,
    details([[t("f.seats"), field(it, "seats")], [t("f.car"), field(it, "car")], [t("f.luggage"), field(it, "luggage")], [t("f.text"), field(it, "note")]]));
  const n = peopleLabel(ctx, it).length;
  const stub = h("div", { cls: "ct-card-stub" },
    h("div", { cls: "ct-stub-price" }, h("span", { cls: "ct-price-big" }, it.price || "—"), h("span", { cls: "ct-sub" }, n ? plural(n, t("ticket.one"), t("ticket.many")) : "")),
    label(t("f.docs")), docsBlock(ctx, it, di, index, false));
  return h("article", { cls: "ct-card ct-pass" }, main, ctx.phone ? notchH() : notchV(), stub);
}
function docsRow(ctx: PlanCtx, it: Item, di: number, index: number, sub: string): HTMLElement {
  return h("div", { cls: "ct-docs-row" },
    h("span", { cls: "ct-docs-price" }, h("span", { cls: "ct-price-big" }, it.price || "—"), h("span", { cls: "ct-sub" }, sub)),
    docsBlock(ctx, it, di, index, true));
}
function lodgingCard(ctx: PlanCtx, it: Item, di: number, index: number): HTMLElement {
  const tr = ctx.trip, date = tr.days[di].date, w = itemDates(it, date, tr.start);
  const key = itemKey(di, index, it);
  const nights = w.to ? Math.max(0, diffDays(w.from, w.to)) : 0;
  const name = it.link || it.title, info = placeOf(ctx, it.link);
  const span = (d: string) => d ? `${weekday(d)} ${dayNum(d)}`.toUpperCase() : "?";
  const tag = h("div", { cls: "ct-key-tag" }, h("span", { cls: "ct-key-hole" }), h("span", { cls: "ct-grow" }),
    h("span", { cls: "ct-key-nights" }, h("b", null, String(nights || "–")), h("span", null, (nights === 1 ? t("night") : t("nights")).toUpperCase())),
    h("span", { cls: "ct-key-dates" }, `${span(w.from)} → ${span(w.to)}`));
  const cities = citiesOfDay(tr, w.from);
  tag.setCssProps({ "--ct-key": destHex(Math.max(0, tr.dests.indexOf(cities[cities.length - 1]))) });
  if (ctx.collapsed.has(key)) {
    return h("article", { cls: "ct-card ct-card-collapsed" }, timeEl(it.time),
      h("span", { cls: "ct-collapsed-main" }, h("span", { cls: "ct-collapsed-title" }, name), h("span", { cls: "ct-sub" }, `${t("k.lodging")} · ${plural(nights, t("night"), t("nights"))}`)),
      it.price ? h("span", { cls: "ct-price" }, it.price) : null,
      iconButton("chevron-right", t("expand"), () => { ctx.collapsed.delete(key); ctx.rerender(); }, "ct-ibtn ct-ibtn-sm"));
  }
  const io = (k: string, time: string, d: string) => h("span", { cls: "ct-io" }, h("span", { cls: "ct-kind" }, k), h("span", { cls: "ct-io-time" }, time || "—"), h("span", { cls: "ct-sub" }, d ? dayLabel(d) : ""));
  const body = h("div", { cls: "ct-card-main" },
    kindRow(ctx, t("k.lodging"), it, di, index, key),
    h("div", { cls: "ct-name-row" }, h("span", { cls: "ct-name-col" }, placeLink(ctx, name, it.link, "ct-place-link is-big"),
      h("span", { cls: "ct-sub" }, [info?.category, info?.city || cities.map(c => c.city).pop()].filter(Boolean).join(" · "))), mapButton(ctx, name, info, w.from)),
    h("div", { cls: "ct-io-row" }, io(t("f.checkin").toUpperCase(), w.fromTime, w.from), io(t("f.checkout").toUpperCase(), w.toTime, w.to)),
    details([[t("f.room"), field(it, "room")], [t("f.beds").split(" ")[0], field(it, "beds")], [t("f.bath"), field(it, "bath")], [t("f.includes"), field(it, "includes")]]),
    docsRow(ctx, it, di, index, plural(nights, t("night"), t("nights"))));
  return h("article", { cls: "ct-card ct-key" }, tag, body);
}
function ticketCard(ctx: PlanCtx, it: Item, di: number, index: number): HTMLElement {
  const date = ctx.trip.days[di].date, key = itemKey(di, index, it);
  const name = it.link || it.title, info = placeOf(ctx, it.link);
  if (ctx.collapsed.has(key)) {
    return h("article", { cls: "ct-card ct-card-collapsed" }, timeEl(it.time),
      h("span", { cls: "ct-collapsed-main" }, h("span", { cls: "ct-collapsed-title" }, name), h("span", { cls: "ct-sub" }, t("k.ticket"))),
      it.price ? h("span", { cls: "ct-price" }, it.price) : null,
      iconButton("chevron-right", t("expand"), () => { ctx.collapsed.delete(key); ctx.rerender(); }, "ct-ibtn ct-ibtn-sm"));
  }
  const strip = h("div", { cls: "ct-admit", attr: { "aria-hidden": "true" } }, h("span", null, `${t("k.ticket")} · ${t("k.ticket")}`.toUpperCase()));
  const body = h("div", { cls: "ct-card-main" },
    kindRow(ctx, t("k.ticket"), it, di, index, key),
    h("div", { cls: "ct-name-row" }, h("span", { cls: "ct-name-col" }, placeLink(ctx, name, it.link, "ct-place-link is-big"),
      h("span", { cls: "ct-sub" }, [info?.category, info?.city].filter(Boolean).join(" · "))), mapButton(ctx, name, info, date)),
    details([[t("f.time"), it.time], [t("f.tickets"), field(it, "tickets")], [t("f.text"), field(it, "note")]]),
    docsRow(ctx, it, di, index, (() => { const n = peopleLabel(ctx, it).length; return n ? plural(n, t("k.ticket").toLowerCase(), t("f.tickets").toLowerCase()) : ""; })()));
  return h("article", { cls: "ct-card ct-admission" }, strip, body, h("span", { cls: "ct-notch-l" }), h("span", { cls: "ct-notch-r" }));
}

/* ---------- pasos de una línea ---------- */
function stepLine(ctx: PlanCtx, time: string, lead: HTMLElement | null, main: HTMLElement, price: string, actions: HTMLElement[]): HTMLElement {
  if (ctx.phone) return h("div", { cls: "ct-step" }, h("span", { cls: "ct-step-col" }, time ? h("span", { cls: "ct-time-sm" }, time) : null,
    h("span", { cls: "ct-step-main" }, lead, main)), ...actions);
  return h("div", { cls: "ct-step" }, timeEl(time), lead, h("span", { cls: "ct-step-main" }, main), price ? h("span", { cls: "ct-price" }, price) : null, ...actions);
}
function itemRow(ctx: PlanCtx, di: number, row: Extract<Row, { r: "item" }>): HTMLElement {
  const { item: it, index } = row, tr = ctx.trip, date = tr.days[di].date;
  const toggle = () => { it.done = !it.done; if (!it.check) it.check = true; ctx.commit(); };
  const cityIdx = Math.max(0, tr.dests.indexOf(citiesOfDay(tr, isIso(date) ? date : tr.start).pop()!));
  const color = destHex(cityIdx);
  if (isTransport(it.kind)) return rowEl(ctx, nodeIcon(transportIcon[it.kind], color), h("div", { cls: "ct-card-wrap" }, transportCard(ctx, it, di, index)), true);
  if (it.kind === "lodging") return rowEl(ctx, nodeIcon("bed-double", color), h("div", { cls: "ct-card-wrap" }, lodgingCard(ctx, it, di, index)), true);
  if (it.kind === "ticket") return rowEl(ctx, nodeIcon("ticket", color), h("div", { cls: "ct-card-wrap" }, ticketCard(ctx, it, di, index)), true);
  const priceSub = ctx.phone && it.price ? ` · ${it.price}` : "";
  if (it.kind === "place") {
    const info = placeOf(ctx, it.link), name = it.link || it.title;
    const main = h("span", { cls: "ct-name-col" }, placeLink(ctx, name, it.link),
      h("span", { cls: "ct-sub" }, [info?.category, info?.city].filter(Boolean).join(" · ") + priceSub));
    return rowEl(ctx, check(ctx, it.done, toggle), stepLine(ctx, it.time, bubble(iconFor(info?.category || "")), main, it.price,
      [mapButton(ctx, name, info, date), editBtn(ctx, di, index, it)]));
  }
  if (it.kind === "meal") {
    const info = placeOf(ctx, it.link);
    const where = it.link ? placeLink(ctx, it.link, it.link, "ct-place-link is-small") : it.place ? h("span", { cls: "ct-sub-strong" }, it.place) : null;
    const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-step-title" }, it.title),
      h("span", { cls: "ct-meal-sub" }, where, h("span", { cls: "ct-sub" }, [...it.extra, info?.city].filter(Boolean).join(" · ") + priceSub)));
    return rowEl(ctx, check(ctx, it.done, toggle), stepLine(ctx, it.time, bubble("utensils"), main, it.price,
      [it.link ? mapButton(ctx, it.link, info, date) : h("span", { cls: "ct-map-gap" }), editBtn(ctx, di, index, it)]));
  }
  if (it.kind === "rest") {
    const info = placeOf(ctx, it.link);
    const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-step-title" }, it.title), it.link ? placeLink(ctx, it.link, it.link, "ct-place-link is-muted") : null);
    return rowEl(ctx, nodeIcon("bed-double", color, true), stepLine(ctx, it.time, null, main, it.price,
      [it.link ? mapButton(ctx, it.link, info, date) : h("span", { cls: "ct-map-gap" }), editBtn(ctx, di, index, it)]));
  }
  /* nota */
  const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-note-text" }, it.title), it.extra.length ? h("span", { cls: "ct-sub" }, it.extra.join(" · ")) : null);
  return rowEl(ctx, it.check ? check(ctx, it.done, toggle) : dot(), stepLine(ctx, it.time, bubble("sticky-note"), main, it.price, [editBtn(ctx, di, index, it)]));
}

const mealTitle = (k: MealKey) => vocab().meals[k];
function mealSlot(ctx: PlanCtx, di: number, meal: MealKey, compact: boolean): HTMLElement {
  const day = ctx.trip.days[di];
  const node = h("span", { cls: "ct-node-dashed" + (compact ? " is-small" : "") });
  const openMeal = (place: string) => ctx.openForm({ day: di, index: -1, isNew: true,
    draft: newItem("meal", { title: mealTitle(meal), place, time: meal === "breakfast" ? "" : "" }) });
  if (compact) {
    return rowEl(ctx, node, button([icon("utensils"), h("span", null, t("meal." + meal)), h("span", { cls: "ct-grow" }), icon("plus")], "ct-slot ct-slot-compact", () => openMeal("")));
  }
  const addNow = (place: string) => {
    day.items.push(newItem("meal", { title: mealTitle(meal), place }));
    ctx.commit();
  };
  return rowEl(ctx, node, h("div", { cls: "ct-slot" },
    h("span", { cls: "ct-slot-title" }, icon("utensils"), t("meal." + meal)),
    button([icon("map-pin"), t("f.where.restaurant")], "ct-pill", () => openMeal("")),
    button([icon("home"), t("f.where.home")], "ct-pill", () => addNow(vocab().home)),
    button(t("f.where.snack"), "ct-pill", () => addNow(t("f.where.snack").toLowerCase()))));
}
function breakfastRow(ctx: PlanCtx, di: number, span: LodgingSpan, time: string): HTMLElement {
  const day = ctx.trip.days[di], hotel = span.item.link || span.item.title, info = placeOf(ctx, span.item.link);
  const make = (done: boolean) => {
    day.items.unshift(newItem("meal", { title: mealTitle("breakfast"), time, link: span.item.link, place: span.item.link ? "" : hotel, done, extra: [vocab().included] }));
    ctx.commit();
  };
  const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-step-title" }, mealTitle("breakfast")),
    h("span", { cls: "ct-meal-sub" }, placeLink(ctx, hotel, span.item.link, "ct-place-link is-small"), h("span", { cls: "ct-sub" }, t("meal.included"))));
  return rowEl(ctx, check(ctx, false, () => make(true)), stepLine(ctx, time, bubble("utensils"), main, "",
    [mapButton(ctx, hotel, info, day.date), iconButton("pencil", t("edit"), () => ctx.openForm({ day: di, index: -1, isNew: true,
      draft: newItem("meal", { title: mealTitle("breakfast"), time, link: span.item.link, extra: [vocab().included] }) }), "ct-ibtn ct-ibtn-sm")]));
}
function lodgingSlot(ctx: PlanCtx, di: number, row: Extract<Row, { r: "lodging" }>): HTMLElement {
  const draft = newItem("lodging", { fields: [] });
  draft.fields.push({ k: "checkin", v: dayLabel(row.from).toLowerCase(), line: 0 }, { k: "checkout", v: dayLabel(row.to).toLowerCase(), line: 1 });
  return rowEl(ctx, h("span", { cls: "ct-node-dashed" }, icon("bed-double")),
    button([h("span", { cls: "ct-slot-title" }, icon("bed-double"), t("slot.lodging", { c: row.city })), h("span", { cls: "ct-grow" }),
      h("span", { cls: "ct-pill is-solid" }, icon("plus"), t("add.lodging"))], "ct-slot ct-slot-btn",
    () => ctx.openForm({ day: di, index: -1, isNew: true, draft })));
}
function transportSlot(ctx: PlanCtx, di: number, which: "out" | "back"): HTMLElement {
  return rowEl(ctx, h("span", { cls: "ct-node-dashed" }, icon("plane")),
    button([h("span", { cls: "ct-slot-title" }, icon("plane"), t(which === "out" ? "slot.out" : "slot.back")), h("span", { cls: "ct-grow" }),
      h("span", { cls: "ct-pill is-solid" }, icon("plus"), t("add.transport"))], "ct-slot ct-slot-btn",
    () => ctx.openForm({ day: di, index: -1, isNew: true, draft: newItem("flight") })));
}
function miniRow(ctx: PlanCtx, row: Extract<Row, { r: "mini" }>): HTMLElement {
  return rowEl(ctx, dot(), h("div", { cls: "ct-step ct-mini" }, ctx.phone ? null : timeEl(row.time),
    h("span", { cls: "ct-name-col" }, ctx.phone ? h("span", { cls: "ct-time-sm" }, row.time) : null, h("span", { cls: "ct-mini-title" }, row.title), h("span", { cls: "ct-sub" }, row.sub))));
}

/* ---------- un día ---------- */
function dayTotal(d: Day): string {
  const items = d.items.filter(i => i.price);
  if (!items.length) return "";
  return fmtMoney(items.reduce((a, i) => a + priceValue(i.price), 0), currencyOf(items[0].price));
}
function dayEl(ctx: PlanCtx, di: number, spans: LodgingSpan[]): HTMLElement {
  const tr = ctx.trip, day = tr.days[di], date = day.date;
  const inTrip = isIso(date) && date >= tr.start && date <= tr.end;
  const n = inTrip ? diffDays(tr.start, date) + 1 : 0, total = inTrip ? diffDays(tr.start, tr.end) + 1 : 0;
  const cs = inTrip ? citiesOfDay(tr, date) : [];
  const rows = rowsOf(tr, di, spans);
  const empty = !day.items.length;
  const sub = !inTrip ? t("day.out") : n === 1 ? t("day.first", { n: total }) : [t("day", { n }),
    cs.length > 1 ? t("day.change") : n === total ? t("day.back") : empty ? t("day.empty") : ""].filter(Boolean).join(" · ");
  const badge = h("span", { cls: "ct-badge" + (empty ? " is-small" : "") },
    h("span", { cls: "ct-badge-wd" }, isIso(date) ? weekday(date) : "?"), h("span", { cls: "ct-badge-n" }, isIso(date) ? String(dayNum(date)) : "?"));
  badge.setCssProps({ "--ct-day-a": destHex(Math.max(0, tr.dests.indexOf(cs[0]))), "--ct-day-b": destHex(Math.max(0, tr.dests.indexOf(cs[cs.length - 1]))) });
  const titleText = cs.length ? cs.map(c => c.city).join(" → ") : (isIso(date) ? `${dayNum(date)} ${monthShort(date)}` : "?");
  const head = h("div", { cls: "ct-day-head" }, h("span", { cls: "ct-node" }, badge),
    h("span", { cls: "ct-day-title" }, h("span", { cls: "ct-day-city" }, titleText), h("span", { cls: "ct-sub" }, sub)),
    h("span", { cls: "ct-day-total" }, dayTotal(day)));
  const body: HTMLElement[] = [];
  const formHere = ctx.form && ctx.form.day === di;
  for (const row of rows) {
    if (row.r === "item") {
      if (formHere && !ctx.form!.isNew && ctx.form!.index === row.index) { body.push(rowEl(ctx, nodeIcon(kindIcon(row.item.kind), "var(--ct-strong)", true), ctx.renderForm(ctx.form!), true)); continue; }
      body.push(itemRow(ctx, di, row));
    } else if (row.r === "mini") body.push(miniRow(ctx, row));
    else if (row.r === "breakfast") body.push(breakfastRow(ctx, di, row.span, row.time));
    else if (row.r === "meal") body.push(mealSlot(ctx, di, row.meal, empty));
    else if (row.r === "lodging") body.push(lodgingSlot(ctx, di, row));
    else if (row.r === "transport") body.push(transportSlot(ctx, di, row.which));
  }
  for (const raw of day.raw) if (!/^###/.test(raw)) body.push(rowEl(ctx, dot(), h("div", { cls: "ct-raw" }, raw)));
  if (formHere && ctx.form!.isNew) body.push(rowEl(ctx, h("span", { cls: "ct-node-add" }, icon("plus")), ctx.renderForm(ctx.form!), true));
  else body.push(rowEl(ctx, h("span", { cls: "ct-node-add" }, icon("plus")),
    button(t("add.to", { d: isIso(date) ? dayLabel(date).toLowerCase() : "" }), "ct-add-btn",
      () => ctx.openForm({ day: di, index: -1, isNew: true, draft: newItem("place") }))));
  const sec = h("section", { cls: "ct-day" + (empty ? " is-empty" : ""), attr: { "data-date": date || "" } }, head, body);
  return sec;
}

export function plan(ctx: PlanCtx): HTMLElement {
  const tr = ctx.trip, spans = lodgings(tr);
  const total = range(tr.start, tr.end).length;
  return h("div", { cls: "ct-plan" },
    h("div", { cls: "ct-plan-head" }, h("h2", { cls: "ct-h-big" }, t("plan")),
      h("span", { cls: "ct-sub" }, total ? t("plan.days", { a: spanLabel(tr.start, tr.end), n: total }) : "")),
    h("div", { cls: "ct-days" }, tr.days.map((_, di) => dayEl(ctx, di, spans))));
}
