/* El plan del viaje: una línea continua, día tras día. Pinta los pasos escritos en la nota y los que calcula
   el plugin (llegadas, check-outs, desayunos incluidos y huecos: comidas, alojamiento, transporte). */
import type { App, TFile } from "obsidian";
import { h } from "./dom";
import { t, vocab } from "./i18n";
import { addDays, dayLabel, dayNum, diffDays, isIso, monthShort, range, spanLabel, weekday } from "./dates";
import { citiesOfDay, field, fmtMoney, joinWhen, showPrice, tripCurrency, lineFor, newItem, priceValue, setField, splitWhen } from "./md";
import { catColor, iconFor, mapsUrl, placeInfo, resolve } from "./places";
import type { PlaceInfo } from "./places";
import { docButton, docForm } from "./docs";
import type { Day, Doc, Item, Kind, Settings, Trip } from "./types";
import { isTransport } from "./types";
import { accentOf, button, destHex, faces, icon, iconButton, label, notchH, notchV, useAccent } from "./ui";

/* un formulario abierto: en qué día, qué paso (o -1 si es nuevo) y en qué hueco se abrió («at») */
export interface FormState { day: number; index: number; draft: Item; isNew: boolean; at?: string; target?: number }
export interface DocAdd { key: string; draft: Doc; index?: number }            // index: el documento que se edita (sin él, uno nuevo)
export interface PlanCtx {
  app: App; s: Settings; trip: Trip; file: TFile; phone: boolean;
  form: FormState | null;
  collapsed: Set<string>;
  docAdd: DocAdd | null;                          // la ventanita de «+ Documento» de una reserva
  setDocAdd(d: DocAdd | null, redraw?: boolean): void;
  commit(): void;
  rerender(): void;
  openForm(f: FormState | null): void;
  renderForm(f: FormState): HTMLElement;
  openLink(link: string): void;
  openDoc(d: Doc): void;
  openUrl(url: string): void;
  move(fromDay: number, fromIndex: number, toDay: number, toIndex: number): void;
  src?(cover: string): string | null;             // la URL de la foto de un lugar
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
  return { from: a.date || dayDate, to: b.date || (isLodging ? "" : a.date || dayDate), fromTime: a.time || (isLodging ? "" : it.time), toTime: b.time, fromAt: a.at, toAt: b.at };
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
/* ¿hay un transporte en marcha a esa hora? (para no sugerir comidas en pleno vuelo) */
function busyAt(tr: Trip, date: string, time: string): boolean {
  const at = `${date} ${time}`;
  for (const d of tr.days) for (const it of d.items) if (isTransport(it.kind)) {
    const w = itemDates(it, d.date, tr.start);
    if (!w.fromTime) continue;
    const a = `${w.from} ${w.fromTime}`;
    const b = w.toTime ? `${w.to || w.from} ${w.toTime}` : `${w.from} ${addHour(w.fromTime)}`;
    if (a <= at && at <= b) return true;
  }
  return false;
}
const addHour = (tm: string) => { const [hh, mm] = tm.split(":").map(Number); return `${String(Math.min(23, hh + 1)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`; };

type Row =
  | { r: "item"; item: Item; index: number; time: string }
  | { r: "mini"; time: string; title: string; sub: string }
  | { r: "breakfast"; time: string; span: LodgingSpan }
  | { r: "meal"; time: string; meal: MealKey }
  | { r: "lodging"; time: string; city: string; from: string; to: string }
  | { r: "arrive"; time: string; item: Item }
  | { r: "transport"; time: string; which: "out" | "back" | "change"; from?: string; to?: string };
const rowKey = (row: Row): string => row.r === "meal" ? `meal:${row.meal}` : row.r === "lodging" ? `lodging:${row.city}` : row.r === "transport" ? `transport:${row.which}`
  : row.r === "arrive" ? `arrive:${row.item.link || row.item.title}` : row.r === "breakfast" ? "meal:breakfast" : "";

function rowsOf(tr: Trip, di: number, spans: LodgingSpan[]): Row[] {
  const day = tr.days[di], date = day.date;
  const written: Row[] = [];
  /* el alojamiento no tiene hora propia: va donde está en la nota, tras el transporte que te lleva (también si llega de otro día) */
  let last = "00:00";
  for (const d of tr.days) for (const it of d.items) if (isTransport(it.kind) && d.date !== date) {
    const w = itemDates(it, d.date, tr.start);
    if (w.to === date && w.toTime > last) last = w.toTime;
  }
  const arrivals = last;
  day.items.forEach((item, index) => {
    const tm = item.kind === "lodging" ? "" : item.time;
    if (tm) last = tm;
    written.push({ r: "item", item, index, time: tm || (item.kind === "lodging" ? (last > arrivals ? last : arrivals) : last) });
  });
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
  /* llegar al alojamiento: un paso aparte, con la hora a la que vayas tú (no la del check-in) */
  for (const w of written) {
    if (w.r !== "item" || w.item.kind !== "lodging") continue;
    const name = w.item.link || w.item.title;
    const there = day.items.some(i => i.kind === "rest" && (i.link || i.place) === name);
    if (!there && itemDates(w.item, date, tr.start).from === date) extra.push({ r: "arrive", time: w.time, item: w.item });
  }
  /* comidas: el desayuno incluido como paso; las que faltan, como huecos (menos si vas de viaje a esa hora) */
  const has = (k: MealKey) => day.items.some(i => i.kind === "meal" && mealKeyOf(i.title) === k);
  const span = date > tr.start ? sleptAt(spans, addDays(date, -1)) : null;
  if (!has("breakfast") && date > tr.start && !busyAt(tr, date, MEAL_TIME.breakfast)) {
    if (span?.includesBreakfast) extra.push({ r: "breakfast", time: MEAL_TIME.breakfast, span });
    else extra.push({ r: "meal", time: MEAL_TIME.breakfast, meal: "breakfast" });
  }
  for (const k of ["lunch", "dinner"] as MealKey[]) if (!has(k) && !busyAt(tr, date, MEAL_TIME[k])) extra.push({ r: "meal", time: MEAL_TIME[k], meal: k });
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
  /* transporte: de ida, de vuelta y el día que cambias de ciudad */
  const leaves = day.items.some(i => isTransport(i.kind));
  const cs = citiesOfDay(tr, date);
  if (date === tr.start && !leaves) extra.push({ r: "transport", time: "00:00", which: "out", to: tr.dests[0]?.city });
  else if (cs.length > 1 && !leaves) extra.push({ r: "transport", time: "11:30", which: "change", from: cs[0].city, to: cs[cs.length - 1].city });
  if (date === tr.end && date !== tr.start && !leaves) extra.push({ r: "transport", time: "23:59", which: "back", from: tr.dests[tr.dests.length - 1]?.city });

  /* se mezclan por hora (a igual hora, primero lo escrito) */
  const out: Row[] = [];
  const rest = [...extra].sort((a, b) => a.time.localeCompare(b.time));
  for (const w of written) {
    const stay = w.r === "item" && w.item.kind === "lodging";          // el alojamiento, después de llegar
    while (rest.length && (rest[0].time < w.time || (stay && rest[0].r === "mini" && rest[0].time === w.time))) out.push(rest.shift()!);
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
function rowEl(node: HTMLElement, content: HTMLElement | null, top = false, cls = ""): HTMLElement {
  return h("div", { cls: "ct-row" + (top ? " is-top" : "") + (cls ? " " + cls : "") }, h("span", { cls: "ct-node" }, node), h("div", { cls: "ct-row-body" }, content));
}
const timeEl = (time: string) => h("span", { cls: "ct-time" }, time || "");
function check(done: boolean, onToggle: () => void): HTMLElement {
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
function mapButton(ctx: PlanCtx, name: string, info: PlaceInfo | null, date: string, cls = "ct-map"): HTMLElement {
  const url = mapsUrl(ctx.s.maps.app, name, info?.city || cityOfDay(ctx, date), info?.loc || null);
  return iconButton("map-pin", t("map"), () => ctx.openUrl(url), cls);
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

/* los documentos de una reserva; «+ Documento» abre una ventanita solo para eso */
function docsBlock(ctx: PlanCtx, it: Item, key: string, inline: boolean): HTMLElement {
  const adding = ctx.docAdd?.key === key ? ctx.docAdd : null;
  const editing = adding?.index;
  return h("div", { cls: "ct-docs" + (inline ? " is-inline" : "") },
    it.docs.map((d, i) => editing === i && adding ? docForm({
      s: ctx.s, travelers: ctx.trip.travelers, draft: adding.draft, small: true,
      onCancel: () => ctx.setDocAdd(null),
      onSave: nd => { it.docs[i] = nd; ctx.setDocAdd(null, false); ctx.commit(); },
    }) : h("div", { cls: "ct-doc-edit-row" }, docButton(ctx, d, ctx.trip.travelers),
      h("span", { cls: "ct-doc-acts ct-hover" },
        iconButton("pencil", t("edit"), () => ctx.setDocAdd({ key, index: i, draft: { ...d, also: [...d.also], para: [...d.para] } }), "ct-ibtn ct-ibtn-sm"),
        iconButton("x", t("remove"), () => { it.docs.splice(i, 1); ctx.commit(); }, "ct-ibtn ct-ibtn-sm")))),
    adding && editing === undefined ? docForm({
      s: ctx.s, travelers: ctx.trip.travelers, draft: adding.draft, small: true, title: t("doc.new"),
      bag: ctx.trip.mochila.filter(m => !it.docs.some(x => x.name === m.name)),
      onCancel: () => ctx.setDocAdd(null),
      onSave: d => { it.docs.push(d); ctx.setDocAdd(null, false); ctx.commit(); },
    }) : button([icon("plus"), h("span", null, t("doc.add"))], "ct-link-btn", () =>
      ctx.setDocAdd({ key, draft: { name: "", where: "paper", url: "", also: [], para: [] } })));
}
function details(pairs: [string, string][]): HTMLElement | null {
  const ok = pairs.filter(p => p[1]);
  if (!ok.length) return null;
  return h("div", { cls: "ct-details" }, ok.map(([k, v]) => h("span", { cls: "ct-detail" }, label(k), h("span", { cls: "ct-detail-v" }, v))));
}
function kindRow(ctx: PlanCtx, text: string, it: Item, di: number, index: number): HTMLElement {
  return h("div", { cls: "ct-kind-row" }, h("span", { cls: "ct-kind" }, text), h("span", { cls: "ct-grow" }),
    faces(peopleLabel(ctx, it), ctx.trip.travelers), editBtn(ctx, di, index, it));
}
const itemKey = (di: number, index: number, it: Item) => `${di}:${index}:${it.kind}:${it.title}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/* contraer y desplegar: fuera de la tarjeta, en la línea, bajo el icono que la sujeta */
function foldBtn(ctx: PlanCtx, key: string): HTMLElement {
  const open = !ctx.collapsed.has(key);
  return iconButton(open ? "chevron-down" : "chevron-up", t(open ? "collapse" : "expand"), () => {
    if (open) ctx.collapsed.add(key); else ctx.collapsed.delete(key);
    ctx.rerender();
  }, "ct-fold");
}
function collapsedCard(ctx: PlanCtx, key: string, time: string, title: string, sub: string, price: string): HTMLElement {
  const card = h("article", { cls: "ct-card ct-card-collapsed", attr: { role: "button", tabindex: "0", "aria-label": `${t("expand")}: ${title}` } }, timeEl(time),
    h("span", { cls: "ct-collapsed-main" }, h("span", { cls: "ct-collapsed-title" }, title), h("span", { cls: "ct-sub" }, sub)),
    price ? h("span", { cls: "ct-price" }, price) : null);
  const open = () => { ctx.collapsed.delete(key); ctx.rerender(); };
  card.addEventListener("click", ev => { if (!(ev.target as HTMLElement).closest("a, button")) open(); });
  card.addEventListener("keydown", ev => { if (ev.key === "Enter") open(); });
  return card;
}
/* lo que se apunta de cada transporte (el coche, según sea tuyo, de alquiler o compartido) */
export function transportDetails(it: Item): [string, string][] {
  const k = it.kind;
  const base: [string, string][] = k === "car"
    ? [[t("f.carMode"), field(it, "mode")], [t("f.company"), field(it, "company")], [t("f.driver"), field(it, "driver")]]
    : [[t("f.code." + k), field(it, "code")], ...(k === "train" ? [[t("f.car"), field(it, "car")]] as [string, string][] : []),
      ...(k === "boat" ? [[t("f.cabin"), field(it, "cabin")]] as [string, string][] : []), [t("f.seats"), field(it, "seats")],
      ...(k === "flight" ? [[t("f.luggage"), field(it, "luggage")]] as [string, string][] : [])];
  return [...base, [t("f.booking"), field(it, "booking")], [t("f.text"), field(it, "note")]];
}

/* ---------- reservas ---------- */
function transportCard(ctx: PlanCtx, it: Item, di: number, index: number, key: string): HTMLElement {
  const tr = ctx.trip, date = tr.days[di].date;
  const w = itemDates(it, date, tr.start), r = routeOf(it);
  const code = it.kind === "car" ? field(it, "mode") : field(it, "code");
  const kindText = t("k." + it.kind) + (code ? " · " + code : "");
  if (ctx.collapsed.has(key)) return collapsedCard(ctx, key, it.time, `${r.from} → ${r.to}`,
    [kindText, w.toTime ? `→ ${w.toTime}` : "", it.docs.length ? plural(it.docs.length, t("f.docName").toLowerCase(), t("f.docs").toLowerCase()) : ""].filter(Boolean).join(" · "), money(ctx, it.price));
  const plus = w.to && w.from && w.to > w.from ? ` +${diffDays(w.from, w.to)}` : "";
  const end = (code: string, time: string, sub: string, right: boolean) => h("span", { cls: "ct-end" + (right ? " is-right" : "") },
    h("span", { cls: "ct-end-code" }, code || "—"), h("span", { cls: "ct-end-time" }, time + (right ? plus : "")), h("span", { cls: "ct-sub" }, sub));
  const route = h("div", { cls: "ct-route-big" },
    end(r.from, w.fromTime, [w.from ? dayLabel(w.from) : "", w.fromAt].filter(Boolean).join(" · "), false),
    h("span", { cls: "ct-route-mid" }, h("span", { cls: "ct-route-dash" }), icon(transportIcon[it.kind] || "plane"), h("span", { cls: "ct-route-dash" })),
    end(r.to, w.toTime, [w.to && w.to !== w.from ? dayLabel(w.to) : w.to ? dayLabel(w.to) : "", w.toAt].filter(Boolean).join(" · "), true));
  const main = h("div", { cls: "ct-card-main" }, kindRow(ctx, kindText, it, di, index), route, details(transportDetails(it).filter(([, v]) => v !== code)));
  const n = peopleLabel(ctx, it).length;
  const stub = h("div", { cls: "ct-card-stub" },
    h("div", { cls: "ct-stub-price" }, h("span", { cls: "ct-price-big" }, money(ctx, it.price) || "—"), h("span", { cls: "ct-sub" }, n ? plural(n, t("ticket.one"), t("ticket.many")) : "")),
    label(t("f.docs")), docsBlock(ctx, it, key, false));
  return h("article", { cls: "ct-card ct-pass" }, main, ctx.phone ? notchH() : notchV(), stub);
}
/* una reserva de transporte tal como sale en el plan (la vista previa de los ajustes) */
export function bookingCard(ctx: PlanCtx, di: number, index: number): HTMLElement {
  const it = ctx.trip.days[di].items[index];
  return transportCard(ctx, it, di, index, itemKey(di, index, it));
}
/* los códigos de salida y llegada encogen (los dos igual) hasta caber cada uno en su mitad; se llama tras pintar y al cambiar el ancho */
export function fitRoutes(root: HTMLElement) {
  const MAX = 50, MIN = 14;
  root.querySelectorAll<HTMLElement>(".ct-route-big").forEach(route => {
    route.setCssProps({ "--ct-code-size": MAX + "px" });
    let ratio = 1;
    route.querySelectorAll<HTMLElement>(".ct-end-code").forEach(c => {
      const room = (c.parentElement as HTMLElement).clientWidth, need = c.scrollWidth;
      if (room > 0 && need > room) ratio = Math.min(ratio, room / need);
    });
    route.setCssProps({ "--ct-code-size": Math.max(MIN, Math.floor(MAX * ratio)) + "px" });
  });
}
function docsRow(ctx: PlanCtx, it: Item, key: string, sub: string): HTMLElement {
  return h("div", { cls: "ct-docs-row" },
    h("span", { cls: "ct-docs-price" }, h("span", { cls: "ct-price-big" }, money(ctx, it.price) || "—"), h("span", { cls: "ct-sub" }, sub)),
    docsBlock(ctx, it, key, true));
}
export const LODGING_TYPES = ["hotel", "hostel", "apartment", "friends", "camping"] as const;
export type LodgingType = typeof LODGING_TYPES[number];
/* el tipo de alojamiento, escrito en cualquiera de los dos idiomas */
export function lodgingType(it: Item): LodgingType {
  const v = field(it, "type").toLowerCase();
  if (/hostal|albergue|hostel/.test(v)) return "hostel";
  if (/apartamento|apartment|airbnb|piso|flat/.test(v)) return "apartment";
  if (/amig|famil|friend|casa de|home/.test(v)) return "friends";
  if (/camping|campsite/.test(v)) return "camping";
  return "hotel";
}
function lodgingCard(ctx: PlanCtx, it: Item, di: number, index: number, key: string, color: string): HTMLElement {
  const tr = ctx.trip, date = tr.days[di].date, w = itemDates(it, date, tr.start);
  const nights = w.to ? Math.max(0, diffDays(w.from, w.to)) : 0;
  const type = lodgingType(it), friends = type === "friends";
  const name = it.link || it.title, info = placeOf(ctx, it.link);
  const span = (d: string) => d ? `${weekday(d)} ${dayNum(d)}`.toUpperCase() : "?";
  const cities = citiesOfDay(tr, w.from);
  const city = info?.city || cities.map(c => c.city).pop() || "";
  if (ctx.collapsed.has(key)) return collapsedCard(ctx, key, "", name,
    [t("lt." + type), plural(nights, t("night"), t("nights")), w.fromTime ? t("checkin.from", { t: w.fromTime }) : ""].filter(Boolean).join(" · "), money(ctx, it.price));
  const tag = h("div", { cls: "ct-key-tag" }, h("span", { cls: "ct-key-hole" }), h("span", { cls: "ct-grow" }),
    h("span", { cls: "ct-key-nights" }, h("b", null, String(nights || "–")), h("span", null, (nights === 1 ? t("night") : t("nights")).toUpperCase())),
    h("span", { cls: "ct-key-dates" }, `${span(w.from)} → ${span(w.to)}`));
  const io = (k: string, time: string, d: string) => h("span", { cls: "ct-io" }, h("span", { cls: "ct-kind" }, k), h("span", { cls: "ct-io-time" }, time || "—"), h("span", { cls: "ct-sub" }, d ? dayLabel(d) : ""));
  const address = field(it, "address");
  const mapTarget = friends && address ? address : name;
  const extraBits = type === "apartment" ? [[t("f.keys"), field(it, "keys")]] : type === "camping" ? [[t("f.pitch"), field(it, "pitch")]] : [];
  const body = h("div", { cls: "ct-card-main" },
    kindRow(ctx, t("lt." + type), it, di, index),
    h("div", { cls: "ct-name-row" }, h("span", { cls: "ct-name-col" }, placeLink(ctx, name, it.link, "ct-place-link is-big"),
      h("span", { cls: "ct-sub" }, (friends ? [address] : [info?.category, city]).filter(Boolean).join(" · "))),
      mapButton(ctx, mapTarget, friends ? null : info, w.from, "ct-map is-tinted")),
    h("div", { cls: "ct-io-row" }, io(t("f.checkin").toUpperCase(), w.fromTime, w.from), io(t("f.checkout").toUpperCase(), w.toTime, w.to)),
    details([[t("f.room"), field(it, "room")], [t("f.beds").split(" ")[0], field(it, "beds")], [t("f.bath"), field(it, "bath")], [t("f.includes"), field(it, "includes")],
      [t("f.booking"), field(it, "booking")], ...extraBits as [string, string][], [t("f.text"), field(it, "note")]]),
    friends && !it.price && !it.docs.length ? null : docsRow(ctx, it, key, plural(nights, t("night"), t("nights"))));
  const card = h("article", { cls: "ct-card ct-key" }, tag, body);
  card.setCssProps({ "--ct-key": color });
  return card;
}
function ticketCard(ctx: PlanCtx, it: Item, di: number, index: number, key: string, color: string): HTMLElement {
  const date = ctx.trip.days[di].date;
  const name = it.link || it.title, info = placeOf(ctx, it.link);
  if (ctx.collapsed.has(key)) return collapsedCard(ctx, key, it.time, name, t("k.ticket"), money(ctx, it.price));
  const strip = h("div", { cls: "ct-admit", attr: { "aria-hidden": "true" } }, h("span", null, t("k.ticket").toUpperCase()), h("span", { cls: "ct-admit-name" }, name.toUpperCase()));
  const body = h("div", { cls: "ct-card-main" },
    kindRow(ctx, t("k.ticket"), it, di, index),
    h("div", { cls: "ct-name-row" }, h("span", { cls: "ct-name-col" }, placeLink(ctx, name, it.link, "ct-place-link is-big"),
      h("span", { cls: "ct-sub" }, [info?.category, info?.city].filter(Boolean).join(" · "))), mapButton(ctx, name, info, date, "ct-map is-tinted")),
    details([[t("f.time"), it.time], [t("f.tickets"), field(it, "tickets")], [t("f.text"), field(it, "note")]]),
    docsRow(ctx, it, key, (() => { const n = peopleLabel(ctx, it).length; return n ? plural(n, t("k.ticket").toLowerCase(), t("f.tickets").toLowerCase()) : ""; })()));
  const card = h("article", { cls: "ct-card ct-admission" }, strip, body, h("span", { cls: "ct-notch-l" }), h("span", { cls: "ct-notch-r" }));
  card.setCssProps({ "--ct-key": color });
  /* el nombre del lugar cabe entero en la banda: se achica la letra y, si aun así no cabe, va en dos líneas */
  const nm = strip.lastElementChild as HTMLElement;
  window.requestAnimationFrame(() => {
    const over = () => nm.scrollHeight > nm.clientHeight + 1 || nm.scrollWidth > nm.clientWidth + 1;
    for (let fs = 11; over() && fs > 7.5; fs -= 0.5) nm.setCssProps({ "--ct-admit-fs": fs - 0.5 + "px" });
    if (over()) nm.addClass("is-wrap");
  });
  return card;
}

/* ---------- mover pasos: se arrastran por el asa (ratón o dedo) a otro sitio del mismo día o de otro ---------- */
function grip(ctx: PlanCtx, di: number, index: number): HTMLElement {
  const g = button(icon("grip-vertical"), "ct-grip", undefined, { "aria-label": t("move"), title: t("move") });
  g.addEventListener("pointerdown", ev => startDrag(ctx, ev, di, index, g));
  return g;
}
function startDrag(ctx: PlanCtx, ev: PointerEvent, di: number, index: number, handle: HTMLElement) {
  const row = handle.closest<HTMLElement>(".ct-row");
  const root = handle.closest<HTMLElement>(".ct-days");
  const scroller = handle.closest<HTMLElement>(".ct-view") || document.scrollingElement as HTMLElement | null;
  if (!row || !root) return;
  ev.preventDefault();
  handle.setPointerCapture(ev.pointerId);
  const rect = row.getBoundingClientRect(), dy = ev.clientY - rect.top, base = root.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;              // una copia que sigue al dedo, dentro de la lista de días
  ghost.addClass("ct-drag-ghost");
  ghost.setCssProps({ "--ct-ghost-w": rect.width + "px", "--ct-ghost-x": rect.left - base.left + "px", "--ct-ghost-y": rect.top - base.top + "px" });
  root.appendChild(ghost);
  row.addClass("is-dragging");
  const line = h("div", { cls: "ct-drop-line" });
  let target: { day: number; index: number } | null = null, raf = 0, lastY = ev.clientY;
  const place = (x: number, y: number) => {
    ghost.setCssProps({ "--ct-ghost-y": y - dy - root.getBoundingClientRect().top + "px" });
    const under = root.ownerDocument.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
    if (!under || under === row) return;
    const day = Number(under.dataset.day), idx = Number(under.dataset.index), r = under.getBoundingClientRect();
    const after = under.dataset.drop === "item" && y > r.top + r.height / 2;
    target = { day, index: idx + (after ? 1 : 0) };
    if (after) under.after(line); else under.before(line);
  };
  const scroll = () => {                                     // cerca del borde, la vista se desplaza sola
    if (!scroller) return;
    const b = scroller.getBoundingClientRect();
    const v = lastY < b.top + 60 ? -12 : lastY > b.bottom - 60 ? 12 : 0;
    if (v) scroller.scrollTop += v;
    raf = window.requestAnimationFrame(scroll);
  };
  raf = window.requestAnimationFrame(scroll);
  const move = (e: PointerEvent) => { lastY = e.clientY; place(e.clientX, e.clientY); };
  const end = () => {
    window.cancelAnimationFrame(raf);
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    ghost.remove(); line.remove(); row.removeClass("is-dragging");
    if (target && !(target.day === di && (target.index === index || target.index === index + 1))) ctx.move(di, index, target.day, target.index);
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
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
  const key = itemKey(di, index, it);
  const card = (ico: string, el: HTMLElement) => {
    const r = rowEl(h("span", { cls: "ct-node-stack" }, nodeIcon(ico, color), foldBtn(ctx, key)), h("div", { cls: "ct-card-wrap" }, el), true, "is-card");
    if (it.unpaid) r.addClass("is-unpaid");
    return dropTarget(r, di, index);
  };
  if (isTransport(it.kind)) return card(transportIcon[it.kind], transportCard(ctx, it, di, index, key));
  if (it.kind === "lodging") return card("bed-double", lodgingCard(ctx, it, di, index, key, color));
  if (it.kind === "ticket") return card("ticket", ticketCard(ctx, it, di, index, key, color));
  const priceSub = ctx.phone && it.price ? ` · ${money(ctx, it.price)}` : "";
  const handle = it.time ? h("span", { cls: "ct-grip-gap" }) : grip(ctx, di, index);   // lo que tiene hora se coloca solo
  let out: HTMLElement;
  if (it.kind === "place") {
    /* sin entrada: una tarjeta sencilla con su foto (o el color y el icono de su tipo) */
    const info = placeOf(ctx, it.link), name = it.link || it.title, src = info?.photo ? ctx.src?.(info.photo) : null;
    const main = h("span", { cls: "ct-name-col" }, placeLink(ctx, name, it.link),
      h("span", { cls: "ct-sub" }, [info?.category, info?.city].filter(Boolean).join(" · ") + priceSub));
    const thumb = h("span", { cls: "ct-pthumb", attr: { "aria-hidden": "true" } }, src ? h("img", { attr: { src, alt: "" } }) : icon(iconFor(info?.category || "")));
    thumb.setCssProps({ "--ct-cat": catColor(info?.category || "") });
    out = rowEl(check(it.done, toggle), stepLine(ctx, it.time, thumb, main, money(ctx, it.price),
      [mapButton(ctx, name, info, date, "ct-map is-tinted"), editBtn(ctx, di, index, it), handle]));
    out.addClass("is-pcard");
    out.setCssProps({ "--ct-key": color });
  } else if (it.kind === "meal") {
    const info = placeOf(ctx, it.link);
    const where = it.link ? placeLink(ctx, it.link, it.link, "ct-place-link is-small") : it.place ? h("span", { cls: "ct-sub-strong" }, it.place) : null;
    const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-step-title" }, it.title),
      h("span", { cls: "ct-meal-sub" }, where, h("span", { cls: "ct-sub" }, [...it.extra, info?.city].filter(Boolean).join(" · ") + priceSub)));
    out = rowEl(check(it.done, toggle), stepLine(ctx, it.time, bubble("utensils"), main, money(ctx, it.price),
      [it.link ? mapButton(ctx, it.link, info, date) : h("span", { cls: "ct-map-gap" }), editBtn(ctx, di, index, it), handle]));
  } else if (it.kind === "rest") {
    const info = placeOf(ctx, it.link);
    const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-step-title" }, it.title),
      it.link ? placeLink(ctx, it.link, it.link, "ct-place-link is-muted") : it.place ? h("span", { cls: "ct-sub" }, it.place) : null);
    out = rowEl(nodeIcon("bed-double", color, true), stepLine(ctx, it.time, null, main, money(ctx, it.price),
      [it.link || it.place ? mapButton(ctx, it.link || it.place, info, date) : h("span", { cls: "ct-map-gap" }), editBtn(ctx, di, index, it), handle]));
  } else {
    /* nota */
    const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-note-text" }, it.title), it.extra.length ? h("span", { cls: "ct-sub" }, it.extra.join(" · ")) : null);
    out = rowEl(it.check ? check(it.done, toggle) : dot(), stepLine(ctx, it.time, bubble("sticky-note"), main, money(ctx, it.price), [editBtn(ctx, di, index, it), handle]));
  }
  if (it.unpaid) out.addClass("is-unpaid");
  return dropTarget(out, di, index);
}
function dropTarget(el: HTMLElement, di: number, index: number, kind = "item"): HTMLElement {
  el.dataset.drop = kind; el.dataset.day = String(di); el.dataset.index = String(index);
  return el;
}

/* ---------- huecos: lo que falta, con un botón sutil para añadirlo ---------- */
const mealTitle = (k: MealKey) => vocab().meals[k];
function slot(title: string, ico: string, actions: HTMLElement[], cls = ""): HTMLElement {
  return h("div", { cls: "ct-slot" + (cls ? " " + cls : "") }, h("span", { cls: "ct-slot-title" }, icon(ico), h("span", { cls: "ct-slot-text" }, title)), ...actions);
}
const slotPill = (text: string, ico: string | null, onClick: () => void) => button([ico ? icon(ico) : null, h("span", { cls: "ct-slot-pill-text" }, text)], "ct-slot-pill", onClick, { "aria-label": text });
function mealSlot(ctx: PlanCtx, di: number, meal: MealKey, at: string): HTMLElement {
  const day = ctx.trip.days[di];
  const openMeal = () => ctx.openForm({ day: di, index: -1, isNew: true, at, draft: newItem("meal", { title: mealTitle(meal) }) });
  const addNow = (place: string) => { day.items.push(newItem("meal", { title: mealTitle(meal), place })); ctx.commit(); };
  return rowEl(h("span", { cls: "ct-node-dashed is-small" }), slot(t("meal." + meal), "utensils", [
    slotPill(t("f.where.restaurant"), "map-pin", openMeal),
    slotPill(t("f.where.home"), "home", () => addNow(vocab().home)),
    slotPill(t("f.where.snack"), "cookie", () => addNow(t("f.where.snack").toLowerCase()))], "is-meal"));
}
function breakfastRow(ctx: PlanCtx, di: number, span: LodgingSpan, time: string): HTMLElement {
  const day = ctx.trip.days[di], hotel = span.item.link || span.item.title, info = placeOf(ctx, span.item.link);
  const make = (done: boolean) => {
    day.items.unshift(newItem("meal", { title: mealTitle("breakfast"), time, link: span.item.link, place: span.item.link ? "" : hotel, done, extra: [vocab().included] }));
    ctx.commit();
  };
  const main = h("span", { cls: "ct-name-col" }, h("span", { cls: "ct-step-title" }, mealTitle("breakfast")),
    h("span", { cls: "ct-meal-sub" }, placeLink(ctx, hotel, span.item.link, "ct-place-link is-small"), h("span", { cls: "ct-sub" }, t("meal.included"))));
  return rowEl(check(false, () => make(true)), stepLine(ctx, time, bubble("utensils"), main, "",
    [mapButton(ctx, hotel, info, day.date), iconButton("pencil", t("edit"), () => ctx.openForm({ day: di, index: -1, isNew: true, at: "meal:breakfast",
      draft: newItem("meal", { title: mealTitle("breakfast"), time, link: span.item.link, extra: [vocab().included] }) }), "ct-ibtn ct-ibtn-sm"), h("span", { cls: "ct-grip-gap" })]));
}
function lodgingSlot(ctx: PlanCtx, di: number, row: Extract<Row, { r: "lodging" }>, at: string): HTMLElement {
  const draft = newItem("lodging");
  setField(draft, "checkin", joinWhen(row.from, "", ""), lineFor("lodging", "checkin"));
  setField(draft, "checkout", joinWhen(row.to, "", ""), lineFor("lodging", "checkout"));
  return rowEl(h("span", { cls: "ct-node-dashed" }, icon("bed-double")),
    slot(t("slot.lodging", { c: row.city }), "bed-double", [slotPill(t("add.lodging"), "plus", () => ctx.openForm({ day: di, index: -1, isNew: true, at, draft }))]));
}
function arriveSlot(ctx: PlanCtx, di: number, it: Item, at: string): HTMLElement {
  const name = it.link || it.title;
  const draft = newItem("rest", { title: t("rest.arrive"), link: it.link, place: it.link ? "" : it.title });
  return rowEl(h("span", { cls: "ct-node-dashed is-small" }),
    slot(t("slot.arrive", { p: name }), "key-round", [slotPill(t("slot.arriveBtn"), "clock", () => ctx.openForm({ day: di, index: -1, isNew: true, at, draft }))]));
}
function transportSlot(ctx: PlanCtx, di: number, row: Extract<Row, { r: "transport" }>, at: string): HTMLElement {
  const title = row.which === "change" ? t("slot.change", { a: row.from || "", b: row.to || "" }) : t(row.which === "out" ? "slot.out" : "slot.back");
  const kind: Kind = row.which === "change" ? "train" : "flight";
  const draft = newItem(kind, { title: row.which === "change" ? `${vocab().kinds[kind as "train"]} ${row.from} → ${row.to}` : "" });
  return rowEl(h("span", { cls: "ct-node-dashed" }, icon("plane")),
    slot(title, kindIcon(kind), [slotPill(t("add.transport"), "plus", () => ctx.openForm({ day: di, index: -1, isNew: true, at, draft }))]));
}
function miniRow(ctx: PlanCtx, row: Extract<Row, { r: "mini" }>): HTMLElement {
  return rowEl(dot(), h("div", { cls: "ct-step ct-mini" }, ctx.phone ? null : timeEl(row.time),
    h("span", { cls: "ct-name-col" }, ctx.phone ? h("span", { cls: "ct-time-sm" }, row.time) : null, h("span", { cls: "ct-mini-title" }, row.title), h("span", { cls: "ct-sub" }, row.sub))));
}

/* ---------- un día ---------- */
function dayTotal(ctx: PlanCtx, d: Day): string {
  const items = d.items.filter(i => i.price);
  if (!items.length) return "";
  return fmtMoney(items.reduce((a, i) => a + priceValue(i.price), 0), tripCurrency(ctx.trip));
}
const money = (ctx: PlanCtx, price: string) => showPrice(price, tripCurrency(ctx.trip));
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
    h("span", { cls: "ct-day-total" }, dayTotal(ctx, day)));
  const body: HTMLElement[] = [];
  const f = ctx.form && ctx.form.day === di ? ctx.form : null;
  const formRow = (node: HTMLElement) => rowEl(node, ctx.renderForm(f!), true);
  for (const row of rows) {
    const at = rowKey(row);
    if (f && f.isNew && at && f.at === at) { body.push(formRow(h("span", { cls: "ct-node-add" }, icon("plus")))); continue; }   // el formulario, en el hueco que lo abrió
    if (row.r === "item") {
      if (f && !f.isNew && f.index === row.index) { body.push(formRow(nodeIcon(kindIcon(row.item.kind), "var(--ct-strong)", true))); continue; }
      body.push(itemRow(ctx, di, row));
    } else if (row.r === "mini") body.push(miniRow(ctx, row));
    else if (row.r === "breakfast") body.push(breakfastRow(ctx, di, row.span, row.time));
    else if (row.r === "meal") body.push(mealSlot(ctx, di, row.meal, at));
    else if (row.r === "lodging") body.push(lodgingSlot(ctx, di, row, at));
    else if (row.r === "arrive") body.push(arriveSlot(ctx, di, row.item, at));
    else if (row.r === "transport") body.push(transportSlot(ctx, di, row, at));
  }
  for (const raw of day.raw) if (!/^###/.test(raw)) body.push(rowEl(dot(), h("div", { cls: "ct-raw" }, raw)));
  const inPlace = f && f.isNew && f.at && rows.some(r => rowKey(r) === f.at);
  if (f && f.isNew && !inPlace) body.push(formRow(h("span", { cls: "ct-node-add" }, icon("plus"))));
  else body.push(dropTarget(rowEl(h("span", { cls: "ct-node-add" }, icon("plus")),
    button([t("add.to", { d: isIso(date) ? dayLabel(date).toLowerCase() : "" })], "ct-add-btn",
      () => ctx.openForm({ day: di, index: -1, isNew: true, draft: newItem("place") }))), di, day.items.length, "end"));
  const sec = h("section", { cls: "ct-day" + (empty ? " is-empty" : ""), attr: { "data-date": date || "" } }, head, body);
  return sec;
}

export function plan(ctx: PlanCtx): HTMLElement {
  const tr = ctx.trip, spans = lodgings(tr);
  useAccent(accentOf(tr.cover, tr.accent));
  const total = range(tr.start, tr.end).length;
  return h("div", { cls: "ct-plan" },
    h("div", { cls: "ct-plan-head" }, h("div", { cls: "ct-h-big", attr: { role: "heading", "aria-level": "2" } }, t("plan")),
      h("span", { cls: "ct-sub ct-nowrap" }, total ? t("plan.days", { a: spanLabel(tr.start, tr.end), n: total }) : "")),
    h("div", { cls: "ct-days" }, tr.days.map((_, di) => dayEl(ctx, di, spans))));
}
