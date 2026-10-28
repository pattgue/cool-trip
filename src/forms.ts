/* Los formularios del plan: añadir o editar un paso en su sitio (sin ventanas flotantes). Cada campo cambia el
   borrador (FormState.draft) y «Guardar» lo escribe en la nota. */
import { append, h } from "./dom";
import { t, vocab } from "./i18n";
import { addDays, dayLabel, isIso, normTime } from "./dates";
import { CURRENCIES, citiesOfDay, currencyOf, field, joinWhen, lineFor, newItem, priceNumber, setField, splitWhen, withCurrency } from "./md";
import { iconFor } from "./places";
import type { PlaceInfo } from "./places";
import type { FormState, LodgingType, PlanCtx } from "./plan";
import { LODGING_TYPES, kindIcon, lodgingType, routeOf } from "./plan";
import { blankDoc, docButton, docForm } from "./docs";
import type { Doc, Item, Kind } from "./types";
import { isTransport, TRANSPORT } from "./types";
import { button, icon, iconButton, label, personChip } from "./ui";

export interface FormCtx extends PlanCtx {
  places(): PlaceInfo[];
  createPlace(name: string, city: string, country: string): Promise<string>;     // devuelve el nombre de la nota
  saveForm(f: FormState): void;
  deleteForm(f: FormState): void;
}
/* lo que la vista guarda del formulario entre repintados */
export interface FormExtra { docDraft?: Doc | null }

const KINDS: { k: Kind; key: string }[] = [
  { k: "place", key: "add.place" }, { k: "meal", key: "add.meal" }, { k: "flight", key: "add.transport" }, { k: "lodging", key: "add.lodging" },
  { k: "ticket", key: "add.ticket" }, { k: "rest", key: "add.rest" }, { k: "note", key: "add.note" },
];
/* lo que tiene sentido en cada tipo de alojamiento */
const ROOMS: Record<LodgingType, string[]> = {
  hotel: ["single", "double", "twin", "triple", "family", "suite"],
  hostel: ["dorm", "private", "double", "twin", "family"],
  apartment: ["apartment", "house", "private"],
  friends: [], camping: [],
};
const BEDS = ["double", "single", "bunk", "sofa", "futon"];
const INCLUDES: Record<LodgingType, string[]> = {
  hotel: ["breakfast", "wifi", "parking", "aircon"],
  hostel: ["breakfast", "wifi", "kitchen", "lockers", "towels"],
  apartment: ["wifi", "kitchen", "washer", "parking", "aircon"],
  friends: [],
  camping: ["electricity", "showers", "wifi", "parking"],
};
const ALL_INCLUDES = [...new Set(Object.values(INCLUDES).flat())];
type CarMode = "own" | "rental" | "shared";
export function carMode(it: Item): CarMode {
  const v = field(it, "mode").toLowerCase();
  return /alquil|rental|rent/.test(v) ? "rental" : /compart|shared|blabla|carpool/.test(v) ? "shared" : "own";
}

/* ---------- campos ---------- */
const lab = (text: string, ...inner: (HTMLElement | null)[]) => h("label", { cls: "ct-f" }, label(text), ...inner);
function input(value: string, onInput: (v: string) => void, attr: Record<string, string> = {}): HTMLInputElement {
  const el = h("input", { cls: "ct-input", attr: { type: "text", value, ...attr } });
  el.addEventListener("input", () => onInput(el.value));
  return el;
}
function dateInput(value: string, onInput: (v: string) => void, attr: Record<string, string> = {}): HTMLInputElement {
  const el = h("input", { cls: "ct-input", attr: { type: "date", value, ...attr } });
  el.addEventListener("change", () => onInput(el.value));
  return el;
}
function timeInput(value: string, onInput: (v: string) => void): HTMLInputElement {
  const el = h("input", { cls: "ct-input ct-input-time", attr: { type: "time", value } });
  el.addEventListener("change", () => onInput(normTime(el.value)));
  return el;
}
function select(value: string, options: [string, string][], onInput: (v: string) => void, allowFree = true): HTMLSelectElement {
  const el = h("select", { cls: "ct-input ct-select" });
  const known = options.some(o => o[0] === value);
  if (allowFree && value && !known) el.appendChild(h("option", { attr: { value } }, value));
  el.appendChild(h("option", { attr: { value: "" } }, "—"));
  for (const [v, text] of options) el.appendChild(h("option", { attr: { value: v } }, text));
  el.value = value;
  el.addEventListener("change", () => onInput(el.value));
  return el;
}
function seg(options: [string, string][], value: string, onPick: (v: string) => void): HTMLElement {
  return h("span", { cls: "ct-seg", attr: { role: "radiogroup" } }, options.map(([v, text]) =>
    button(text, "ct-pill" + (v === value ? " is-solid" : ""), () => onPick(v), { role: "radio", "aria-checked": String(v === value) })));
}
const fieldInput = (d: Item, key: string, attr: Record<string, string> = {}) => input(field(d, key), v => setField(d, key, v, lineFor(d.kind, key)), attr);

/* «sáb 3 abr · 11:50 · T4S» se edita por partes */
function whenParts(ctx: FormCtx, d: Item, key: string) {
  const near = ctx.trip.start;
  const get = () => splitWhen(field(d, key), near);
  const set = (part: "date" | "time" | "at", v: string) => {
    const w = get(); w[part] = v;
    setField(d, key, joinWhen(w.date, w.time, w.at), lineFor(d.kind, key));
    if (part === "time" && key === "depart") d.time = v;
  };
  return { get, set };
}
function paraChips(ctx: FormCtx, d: Item): HTMLElement {
  const all = ctx.trip.travelers;
  const on = (p: string) => !d.para.length || d.para.includes(p);
  const box = h("span", { cls: "ct-people" });
  const draw = () => {
    box.empty();
    all.forEach((p, i) => box.appendChild(personChip(p, i, on(p), () => {
      const cur = d.para.length ? [...d.para] : [...all];
      const k = cur.indexOf(p);
      if (k >= 0) cur.splice(k, 1); else cur.push(p);
      d.para = cur.length === all.length || !cur.length ? [] : all.filter(x => cur.includes(x));
      draw();
    })));
  };
  draw();
  return box;
}
/* el precio: el número y su moneda por separado (en la nota se escribe junto: «60 €», «$60») */
function priceField(ctx: FormCtx, d: Item, key: string): HTMLElement {
  const used = ctx.trip.days.flatMap(x => x.items).find(i => i.price)?.price;
  let cur = d.price ? currencyOf(d.price) : used ? currencyOf(used) : "€", num = priceNumber(d.price);
  const sync = () => { d.price = withCurrency(num, cur); };
  /* el precio y su moneda en una fila; «aún sin pagar» debajo */
  return h("div", { cls: "ct-price-f" }, lab(t(key), h("span", { cls: "ct-inline" },
    input(num, v => { num = v.replace(/[^\d.,]/g, ""); sync(); }, { placeholder: "0", inputmode: "decimal" }),
    select(cur, CURRENCIES.map(c => [c, c]), v => { cur = v || "€"; sync(); }, true))),
    h("label", { cls: "ct-unpaid" }, (() => { const c = h("input", { attr: { type: "checkbox" } }); c.checked = d.unpaid; c.addEventListener("change", () => { d.unpaid = c.checked; }); return c; })(), t("f.unpaid")));
}

/* el buscador de lugares: una nota tuya o una nueva */
function placePicker(ctx: FormCtx, d: Item, city: string, country: string, labelKey = "f.placeNote"): HTMLElement {
  const wrap = h("div", { cls: "ct-picker" });
  /* en una comida, el título es la comida («Comida», «Cena»): el restaurante va en el enlace o en el sitio */
  const meal = d.kind === "meal", typed = meal ? d.place.trim() : d.title;
  let query = d.link ? "" : typed;
  const field_ = input(d.link || typed, v => { query = v; d.link = ""; if (meal) d.place = v; else d.title = v; drawList(); }, { placeholder: t("f.placeNote"), autocomplete: "off" });
  const list = h("div", { cls: "ct-picker-list", attr: { role: "listbox" } });
  const pick = (name: string) => { d.link = name; if (meal) d.place = ""; else d.title = name; field_.value = name; query = ""; drawList(); };
  const drawList = () => {
    list.empty();
    const q = query.trim().toLowerCase();
    if (!q) { list.hidden = true; return; }
    const places = ctx.places().filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => Number(b.city.toLowerCase() === city.toLowerCase()) - Number(a.city.toLowerCase() === city.toLowerCase()) || a.name.localeCompare(b.name))
      .slice(0, 6);
    for (const p of places) list.appendChild(button([icon(iconFor(p.category)), h("span", { cls: "ct-name-col" },
      h("b", null, p.name), h("span", { cls: "ct-sub" }, [p.category, p.city].filter(Boolean).join(" · ")))], "ct-option", () => pick(p.name), { role: "option" }));
    const exact = places.some(p => p.name.toLowerCase() === q);
    if (!exact) list.appendChild(button([icon("plus"), h("span", null, t("f.create", { q: query.trim(), f: city || "—" }))], "ct-option", () => {
      void ctx.createPlace(query.trim(), city, country).then(name => { pick(name); });
    }, { role: "option" }));
    list.hidden = false;
  };
  field_.addEventListener("focus", drawList);
  wrap.append(field_, list);
  list.hidden = true;
  return lab(t(labelKey), wrap);
}

/* los documentos de una reserva: los que tiene y la ventanita para añadir otro */
function docsEditor(ctx: FormCtx, f: FormState & FormExtra): HTMLElement {
  const d = f.draft;
  const box = h("div", { cls: "ct-f ct-docs-edit" }, label(t("f.docs")));
  d.docs.forEach((doc, i) => box.appendChild(h("div", { cls: "ct-doc-edit-row" }, docButton(ctx, doc, ctx.trip.travelers),
    iconButton("x", t("remove"), () => { d.docs.splice(i, 1); ctx.rerender(); }, "ct-ibtn ct-ibtn-sm"))));
  if (f.docDraft) box.appendChild(docForm({
    s: ctx.s, travelers: ctx.trip.travelers, draft: f.docDraft, small: true,
    bag: ctx.trip.mochila.filter(m => !d.docs.some(x => x.name === m.name)),
    onCancel: () => { f.docDraft = null; ctx.rerender(); },
    onSave: doc => { d.docs.push(doc); f.docDraft = null; ctx.rerender(); },
  }));
  else box.appendChild(h("div", { cls: "ct-row-btns" },
    button([icon("plus"), t("f.addDoc")], "ct-pill is-dashed is-small", () => { f.docDraft = blankDoc("paper"); ctx.rerender(); })));
  return box;
}

/* ---------- transporte: lo que pide cada uno ---------- */
function transportFields(ctx: FormCtx, f: FormState): HTMLElement[] {
  const d = f.draft, r = routeOf(d), k = d.kind;
  const setTitle = (from: string, to: string) => { d.title = `${vocab().kinds[d.kind as "flight"]} ${from.trim()} → ${to.trim()}`.trim(); };
  let from = r.from, to = r.to;
  const dep = whenParts(ctx, d, "depart"), arr = whenParts(ctx, d, "arrive");
  /* la llegada empieza el mismo día que la salida (y nunca antes) */
  if (!arr.get().date && dep.get().date) arr.set("date", dep.get().date);
  const mode = k === "car" ? carMode(d) : null;
  const ph = (which: "from" | "to") => t(`ph.${k}.${which}`);
  const atLabel = (which: "depart" | "arrive") => k === "car" ? t(`f.car.${mode}.${which}`) : t(`f.at.${k}`);
  const showAt = !(k === "car" && mode === "own");
  const out: HTMLElement[] = [
    lab(t("f.kind"), seg(TRANSPORT.map(x => [x, t("k." + x)]), k, v => { d.kind = v as Kind; setTitle(from, to); ctx.rerender(); })),
  ];
  if (k === "car") out.push(lab(t("f.carMode"), seg((["own", "rental", "shared"] as CarMode[]).map(m => [m, t("car." + m)]), mode || "own",
    v => { setField(d, "mode", v === "own" ? "" : t("car." + v).toLowerCase(), lineFor(k, "mode")); ctx.rerender(); })));
  out.push(
    h("div", { cls: "ct-grid ct-grid-2" },
      lab(t("f.from"), input(from, v => { from = v; setTitle(from, to); }, { placeholder: ph("from") })),
      lab(t("f.to"), input(to, v => { to = v; setTitle(from, to); }, { placeholder: ph("to") }))),
    h("div", { cls: "ct-grid " + (showAt ? "ct-grid-3" : "ct-grid-2") },
      lab(t("f.departDay"), dateInput(dep.get().date, v => {
        const old = dep.get().date;
        dep.set("date", v);
        if (!arr.get().date || arr.get().date === old || arr.get().date < v) arr.set("date", v);
        ctx.rerender();
      })),
      lab(t("f.departTime"), timeInput(dep.get().time || d.time, v => dep.set("time", v))),
      showAt ? lab(atLabel("depart"), input(dep.get().at, v => dep.set("at", v))) : null),
    h("div", { cls: "ct-grid " + (showAt ? "ct-grid-3" : "ct-grid-2") },
      lab(t("f.arriveDay"), dateInput(arr.get().date, v => arr.set("date", v), dep.get().date ? { min: dep.get().date } : {})),
      lab(t("f.arriveTime"), timeInput(arr.get().time, v => arr.set("time", v))),
      showAt ? lab(atLabel("arrive"), input(arr.get().at, v => arr.set("at", v))) : null));
  /* los datos de la reserva, según el transporte */
  const cells: HTMLElement[] = [];
  if (k === "car") {
    if (mode === "rental") cells.push(lab(t("f.company"), fieldInput(d, "company", { placeholder: "Hertz, Sixt…" })), lab(t("f.booking"), fieldInput(d, "booking")));
    if (mode === "shared") cells.push(lab(t("f.platform"), fieldInput(d, "company", { placeholder: "BlaBlaCar" })), lab(t("f.driver"), fieldInput(d, "driver")),
      lab(t("f.booking"), fieldInput(d, "booking")));
  } else {
    cells.push(lab(t("f.code." + k), fieldInput(d, "code", { placeholder: t(`ph.${k}.code`) })));
    if (k === "train") cells.push(lab(t("f.car"), fieldInput(d, "car")));
    if (k === "boat") cells.push(lab(t("f.cabin"), fieldInput(d, "cabin")));
    if (k === "flight") cells.push(lab(t("f.luggage"), fieldInput(d, "luggage")));
    cells.push(lab(t("f.booking"), fieldInput(d, "booking")));
  }
  if (cells.length) out.push(h("div", { cls: "ct-grid ct-grid-" + Math.min(3, cells.length) }, cells));
  if (k !== "car") out.push(lab(t("f.seats"), fieldInput(d, "seats", { placeholder: ctx.trip.travelers.map((p, i) => `${p} ${12 + i}A`).join(" · ") })));
  return out;
}

/* ---------- alojamiento: según sea un hotel, un hostal, un apartamento, casa de amigos o un camping ---------- */
function includesBox(ctx: FormCtx, d: Item, type: LodgingType): HTMLElement {
  const inc = field(d, "includes").split(/,\s*/).map(s => s.trim()).filter(Boolean);
  const has = (x: string) => inc.some(i => i.toLowerCase() === x.toLowerCase());
  const known = (x: string) => ALL_INCLUDES.some(k => t("inc." + k).toLowerCase() === x.toLowerCase());
  const save = () => setField(d, "includes", inc.join(", "), lineFor("lodging", "includes"));
  const box = h("span", { cls: "ct-people" });
  let adding = false;
  const draw = () => {
    box.empty();
    const keys = [...INCLUDES[type], ...ALL_INCLUDES.filter(k => !INCLUDES[type].includes(k) && has(t("inc." + k)))];
    for (const k of keys) {
      const lbl = t("inc." + k), on = has(lbl);
      box.appendChild(button([icon(on ? "check" : "plus"), lbl], "ct-pill is-small" + (on ? " is-on" : " is-dashed"), () => {
        if (on) inc.splice(inc.findIndex(i => i.toLowerCase() === lbl.toLowerCase()), 1); else inc.push(lbl.toLowerCase());
        save(); draw();
      }));
    }
    /* lo que hayas escrito tú («toallas de playa») */
    for (const x of inc.filter(i => !known(i))) box.appendChild(button([icon("check"), x, icon("x", "ct-ico ct-ico-xs")], "ct-pill is-small is-on", () => {
      inc.splice(inc.indexOf(x), 1); save(); draw();
    }, { "aria-label": `${t("remove")} ${x}` }));
    if (adding) {
      const other = h("input", { cls: "ct-input ct-input-other", attr: { type: "text", placeholder: t("f.otherPh") } });
      let done = false;
      const ok = () => { if (done) return; done = true; const v = other.value.trim(); if (v && !has(v)) { inc.push(v); save(); } adding = false; draw(); };
      other.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); ok(); } if (ev.key === "Escape") { done = true; adding = false; draw(); } });
      other.addEventListener("blur", ok);
      box.appendChild(other);
      window.setTimeout(() => other.focus(), 0);
    } else box.appendChild(button([icon("plus"), t("f.other")], "ct-pill is-small is-dashed", () => { adding = true; draw(); }));
  };
  draw();
  void ctx;
  return box;
}
function lodgingFields(ctx: FormCtx, f: FormState, city: string, country: string): HTMLElement[] {
  const d = f.draft, type = lodgingType(d);
  const ci = whenParts(ctx, d, "checkin"), co = whenParts(ctx, d, "checkout");
  const beds = /^(\d+)\s*(.*)$/.exec(field(d, "beds")) || ["", "", field(d, "beds")];
  let bedN = beds[1], bedType = beds[2];
  const setBeds = () => setField(d, "beds", [bedN, bedType].filter(Boolean).join(" "), lineFor("lodging", "beds"));
  const out: HTMLElement[] = [
    lab(t("f.lodgingType"), seg(LODGING_TYPES.map(x => [x, t("lt." + x)]), type, v => {
      setField(d, "type", v === "hotel" ? "" : t("lt." + v).toLowerCase(), lineFor("lodging", "type"));
      if (v === "friends") { d.link = ""; d.title = ""; }
      ctx.rerender();
    })),
  ];
  if (type === "friends") {
    out.push(h("div", { cls: "ct-grid ct-grid-2" },
      lab(t("f.friendsName"), input(d.title, v => { d.title = v; d.link = ""; }, { placeholder: t("f.friendsPh") })),
      lab(t("f.address"), fieldInput(d, "address", { placeholder: t("f.addressPh") }))));
  } else out.push(placePicker(ctx, d, city, country, "f.lodgingNote"));
  const fr = type === "friends";                     // en casa de amigos no hay check-in: llegas y te vas
  out.push(h("div", { cls: "ct-grid ct-grid-4" },
    lab(t(fr ? "f.arriveDay" : "f.checkinDay"), dateInput(ci.get().date, v => ci.set("date", v))),
    lab(t(fr ? "f.arriveTime" : "f.checkin"), timeInput(ci.get().time, v => ci.set("time", v))),
    lab(t(fr ? "f.departDay" : "f.checkoutDay"), dateInput(co.get().date, v => co.set("date", v), ci.get().date ? { min: addDays(ci.get().date, 1) } : {})),
    lab(t(fr ? "f.departTime" : "f.checkout"), timeInput(co.get().time, v => co.set("time", v)))));
  if (type === "friends") return out;
  const room = ROOMS[type].length ? lab(t("f.room"), select(field(d, "room"), ROOMS[type].map(k => [t("room." + k), t("room." + k)]), v => setField(d, "room", v, lineFor("lodging", "room")))) : null;
  const bedsEl = type === "camping" ? null : lab(t("f.beds"), h("span", { cls: "ct-inline" },
    input(bedN, v => { bedN = v.replace(/\D/g, ""); setBeds(); }, { inputmode: "numeric", class: "ct-input ct-input-num" }),
    select(bedType, BEDS.map(k => [t("bed." + k).toLowerCase(), t("bed." + k)]), v => { bedType = v; setBeds(); })));
  const bath = type === "camping" ? null : lab(t("f.bath"), seg([[t("bath.private").toLowerCase(), t("bath.private")], [t("bath.shared").toLowerCase(), t("bath.shared")]], field(d, "bath").toLowerCase(),
    v => { setField(d, "bath", v, lineFor("lodging", "bath")); ctx.rerender(); }));
  const pitch = type === "camping" ? lab(t("f.pitch"), fieldInput(d, "pitch", { placeholder: "B12" })) : null;
  const firstRow = ([room, bedsEl, bath, pitch] as (HTMLElement | null)[]).filter((x): x is HTMLElement => !!x);
  if (firstRow.length) out.push(h("div", { cls: "ct-grid ct-grid-" + firstRow.length }, firstRow));
  out.push(lab(t("f.includes"), includesBox(ctx, d, type)));
  out.push(h("div", { cls: "ct-grid ct-grid-2" },
    lab(t("f.booking"), fieldInput(d, "booking", { placeholder: "HB-48213" })),
    type === "apartment" ? lab(t("f.keys"), fieldInput(d, "keys", { placeholder: t("f.keysPh") })) : h("span")));
  return out;
}

export function renderForm(ctx: FormCtx, f: FormState & FormExtra): HTMLElement {
  const d = f.draft, tr = ctx.trip, day = tr.days[f.target ?? f.day];
  const date = day?.date || tr.start;
  const cs = isIso(date) ? citiesOfDay(tr, date) : [];
  const dest = cs[cs.length - 1];
  const city = dest?.city || "", country = dest?.country || "";
  const title = f.isNew ? t("add.to", { d: isIso(date) ? dayLabel(date).toLowerCase() : "" }) : t("edit");
  const form = h("form", { cls: "ct-form", attr: { autocomplete: "off" } });
  form.addEventListener("submit", ev => { ev.preventDefault(); ctx.saveForm(f); });
  form.appendChild(h("div", { cls: "ct-form-head" }, h("span", { cls: "ct-form-title" }, title), h("span", { cls: "ct-grow" }),
    iconButton("x", t("close"), () => ctx.openForm(null), "ct-ibtn ct-ibtn-sm")));
  if (f.isNew) {
    form.appendChild(h("div", { cls: "ct-kinds" }, KINDS.map(({ k, key }) => {
      const on = k === d.kind || (k === "flight" && isTransport(d.kind));
      return button([icon(kindIcon(k)), t(key)], "ct-pill" + (on ? " is-solid" : ""), () => {
        if (on) return;
        const keep = d.time;
        f.draft = newItem(k, { time: k === "lodging" ? "" : keep });
        if (k === "rest") f.draft.title = t("rest.back");
        if (k === "meal") f.draft.title = vocab().meals.lunch;
        ctx.rerender();
      });
    })));
  }
  if (f.isNew && isIso(date)) {                 /* lo nuevo empieza el día en que se añade */
    if (isTransport(d.kind) && !field(d, "depart")) setField(d, "depart", joinWhen(date, d.time, ""), lineFor(d.kind, "depart"));
    if (d.kind === "lodging" && !field(d, "checkin")) setField(d, "checkin", joinWhen(date, "", ""), lineFor("lodging", "checkin"));
  }
  const rows: (HTMLElement | null)[] = [];
  const timeRow = (key = "f.timeOpt") => lab(t(key), timeInput(d.time, v => { d.time = v; }));
  if (d.kind === "place") {
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow(), placePicker(ctx, d, city, country)));
  } else if (d.kind === "meal") {
    const isHome = [vocab().home, "en casa", "at home"].includes(d.place.toLowerCase());
    const mode = d.link ? "restaurant" : isHome ? "home" : d.place ? "other" : "restaurant";
    rows.push(
      lab(t("f.meal"), seg(Object.entries(vocab().meals).map(([, m]) => [m, m]), d.title, v => { d.title = v; ctx.rerender(); })),
      h("div", { cls: "ct-grid ct-grid-time" }, timeRow(),
        lab(t("f.where"), seg([["restaurant", t("f.where.restaurant")], ["home", t("f.where.home")], ["other", t("f.placeName").split(" (")[0]]], mode, v => {
          if (v === "home") { d.link = ""; d.place = vocab().home; } else if (v === "other") { d.link = ""; d.place = d.place && !isHome ? d.place : " "; } else { d.place = ""; }
          ctx.rerender();
        }))),
      mode === "restaurant" ? placePicker(ctx, d, city, country) : null,
      mode === "other" ? lab(t("f.placeName"), input(d.place.trim(), v => { d.place = v; })) : null);
  } else if (isTransport(d.kind)) {
    rows.push(...transportFields(ctx, f));
  } else if (d.kind === "lodging") {
    rows.push(...lodgingFields(ctx, f, city, country));
  } else if (d.kind === "ticket") {
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow("f.time"), placePicker(ctx, d, city, country)),
      lab(t("f.tickets"), input(field(d, "tickets"), v => setField(d, "tickets", v, lineFor("ticket", "tickets")), { placeholder: "1 · adulto" })));
  } else if (d.kind === "rest") {
    /* llegar, volver o descansar en un alojamiento del viaje (con nota o sin ella, como la casa de unos amigos) */
    const stays = [...new Set(tr.days.flatMap(x => x.items).filter(i => i.kind === "lodging").map(i => i.link || i.title).filter(Boolean))];
    if (!d.link && !d.place.trim() && stays.length) { const last = tr.days.flatMap(x => x.items).filter(i => i.kind === "lodging").pop()!; d.link = last.link; d.place = last.link ? "" : last.title; }
    const restTitles = [t("rest.arrive"), t("rest.back"), t("rest.rest")];
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow(),
      lab(t("f.restTitle"), seg(restTitles.map(x => [x, x]), d.title, v => { d.title = v; ctx.rerender(); }))),
      stays.length ? lab(t("k.lodging"), select(d.link || d.place, stays.map(l => [l, l]), v => {
        const it = tr.days.flatMap(x => x.items).find(i => i.kind === "lodging" && (i.link || i.title) === v);
        d.link = it?.link || ""; d.place = it && !it.link ? it.title : "";
      })) : null);
  } else {
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow(), lab(t("f.text"), input(d.title, v => { d.title = v; }))));
  }
  /* el día: lo que no es una reserva se puede pasar a otro día desde aquí */
  if (!isTransport(d.kind) && d.kind !== "lodging" && tr.days.length > 1) {
    const cur = f.target ?? f.day;
    rows.push(lab(t("f.day"), select(String(cur), tr.days.map((x, i) => [String(i), isIso(x.date) ? dayLabel(x.date) : "?"] as [string, string]), v => {
      if (v !== "") { f.target = Number(v); ctx.rerender(); }
    }, false)));
  }
  const friends = d.kind === "lodging" && lodgingType(d) === "friends";
  const money = d.kind === "note" || d.kind === "rest" || friends ? null : h("div", { cls: "ct-grid ct-grid-price" },
    priceField(ctx, d, d.kind === "lodging" ? "f.priceTotal" : "f.price"),
    tr.travelers.length > 1 ? lab(t("f.para"), paraChips(ctx, d)) : null);
  const docs = (isTransport(d.kind) || d.kind === "lodging" || d.kind === "ticket") && !friends ? docsEditor(ctx, f) : null;
  append(form, [rows, money, docs]);
  form.appendChild(h("div", { cls: "ct-form-foot" },
    f.isNew ? null : button(t("f.delete"), "ct-link-btn", () => ctx.deleteForm(f)),
    h("span", { cls: "ct-grow" }),
    button(t("f.cancel"), "ct-btn-ghost", () => ctx.openForm(null)),
    h("button", { cls: "ct-btn-primary", attr: { type: "submit" } }, t("f.save"))));
  return form;
}
