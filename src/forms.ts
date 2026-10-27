/* Los formularios del plan: añadir o editar un paso en su sitio (sin ventanas flotantes). Cada campo cambia el
   borrador (FormState.draft) y «Guardar» lo escribe en la nota. */
import { append, h } from "./dom";
import { t, vocab } from "./i18n";
import { dayLabel, isIso, normTime } from "./dates";
import { citiesOfDay, field, joinWhen, lineFor, newItem, setField, splitWhen } from "./md";
import { iconFor } from "./places";
import type { PlaceInfo } from "./places";
import type { FormState, PlanCtx } from "./plan";
import { docButton, kindIcon, routeOf } from "./plan";
import type { Doc, Item, Kind, Where } from "./types";
import { isTransport, TRANSPORT } from "./types";
import { button, icon, iconButton, label, personChip } from "./ui";

export interface FormCtx extends PlanCtx {
  places(): PlaceInfo[];
  createPlace(name: string, city: string, country: string): Promise<string>;     // devuelve el nombre de la nota
  saveForm(f: FormState): void;
  deleteForm(f: FormState): void;
}

const KINDS: { k: Kind; key: string }[] = [
  { k: "place", key: "add.place" }, { k: "meal", key: "add.meal" }, { k: "flight", key: "add.transport" }, { k: "lodging", key: "add.lodging" },
  { k: "ticket", key: "add.ticket" }, { k: "rest", key: "add.rest" }, { k: "note", key: "add.note" },
];
const ROOMS = ["single", "double", "twin", "triple", "family", "suite", "apartment", "house", "dorm"];
const BEDS = ["double", "single", "bunk", "sofa", "futon"];
const INCLUDES = ["breakfast", "wifi", "kitchen", "washer", "parking"];

/* ---------- campos ---------- */
const lab = (text: string, ...inner: (HTMLElement | null)[]) => h("label", { cls: "ct-f" }, label(text), ...inner);
function input(value: string, onInput: (v: string) => void, attr: Record<string, string> = {}): HTMLInputElement {
  const el = h("input", { cls: "ct-input", attr: { type: "text", value, ...attr } });
  el.addEventListener("input", () => onInput(el.value));
  return el;
}
function dateInput(value: string, onInput: (v: string) => void): HTMLInputElement {
  const el = h("input", { cls: "ct-input", attr: { type: "date", value } });
  el.addEventListener("change", () => onInput(el.value));
  return el;
}
function timeInput(value: string, onInput: (v: string) => void): HTMLInputElement {
  const el = h("input", { cls: "ct-input ct-input-time", attr: { type: "time", value } });
  el.addEventListener("change", () => onInput(normTime(el.value)));
  return el;
}
function select(value: string, options: [string, string][], onInput: (v: string) => void, allowFree = true): HTMLElement {
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

/* «sáb 3 abr · 11:50 · T4S» se edita por partes */
function whenParts(ctx: FormCtx, d: Item, key: string) {
  const near = ctx.trip.start;
  const get = () => splitWhen(field(d, key), near);
  const set = (part: "date" | "time" | "at", v: string) => {
    const w = get(); w[part] = v;
    setField(d, key, joinWhen(w.date, w.time, w.at), lineFor(d.kind, key));
    if (part === "time" && (key === "depart" || key === "checkin")) d.time = v;
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

/* el buscador de lugares: una nota tuya o una nueva */
function placePicker(ctx: FormCtx, d: Item, f: FormState, city: string, country: string, labelKey = "f.placeNote"): HTMLElement {
  const wrap = h("div", { cls: "ct-picker" });
  const field_ = input(d.link || d.title, v => { query = v; d.link = ""; d.title = v; drawList(); }, { placeholder: t("f.placeNote"), autocomplete: "off" });
  let query = d.link ? "" : d.title;
  const list = h("div", { cls: "ct-picker-list", attr: { role: "listbox" } });
  const pick = (name: string) => { d.link = name; d.title = name; field_.value = name; query = ""; drawList(); };
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
  void f;
  return lab(t(labelKey), wrap);
}

function docsEditor(ctx: FormCtx, f: FormState): HTMLElement {
  const d = f.draft;
  const box = h("div", { cls: "ct-f ct-docs-edit" }, label(t("f.docs")));
  d.docs.forEach((doc, i) => box.appendChild(h("div", { cls: "ct-doc-edit-row" }, docButton(ctx, doc),
    iconButton("x", t("remove"), () => { d.docs.splice(i, 1); ctx.rerender(); }, "ct-ibtn ct-ibtn-sm"))));
  const wheres: Where[] = (["cloud", "wallet", "device", "vault"] as Where[]).filter(w => ctx.s.files[w as "cloud"]);
  wheres.push("paper");
  let draftDoc: Doc = { name: "", where: wheres[0], url: "" };
  const sub = h("div", { cls: "ct-newdoc", attr: { hidden: "" } });
  const drawSub = () => {
    sub.empty();
    append(sub, [
      h("div", { cls: "ct-grid ct-grid-2" },
        lab(t("f.docName"), input(draftDoc.name, v => { draftDoc.name = v; })),
        lab(t("f.where"), seg(wheres.map(w => [w, t("w." + w)]), draftDoc.where, v => { draftDoc.where = v as Where; drawSub(); }))),
      draftDoc.where === "cloud" || draftDoc.where === "device"
        ? lab(t("f.link"), input(draftDoc.url, v => { draftDoc.url = v; }, { placeholder: draftDoc.where === "cloud" ? "https://…" : "file:///…" })) : null,
      draftDoc.where === "vault" ? lab(t("f.vaultPath"), input(draftDoc.url, v => { draftDoc.url = v; }, { placeholder: ctx.s.files.vaultFolder + "/…" })) : null,
      h("div", { cls: "ct-form-actions" }, button(t("f.save"), "ct-btn-primary is-small", () => {
        if (!draftDoc.name.trim()) return;
        d.docs.push({ ...draftDoc, name: draftDoc.name.trim(), url: draftDoc.url.trim() });
        draftDoc = { name: "", where: wheres[0], url: "" };
        ctx.rerender();
      }))]);
  };
  drawSub();
  const bag = ctx.trip.mochila.filter(m => !d.docs.some(x => x.name === m.name));
  const bagMenu = h("div", { cls: "ct-bag-menu", attr: { hidden: "" } }, bag.map(m => button(m.name, "ct-option", () => { d.docs.push({ ...m }); ctx.rerender(); })));
  box.append(
    h("div", { cls: "ct-row-btns" },
      bag.length ? button([icon("plus"), t("f.fromBag")], "ct-pill is-dashed", () => { bagMenu.toggleAttribute("hidden"); }) : null,
      button([icon("plus"), t("f.addDoc")], "ct-pill is-dashed", () => { sub.toggleAttribute("hidden"); })),
    bagMenu, sub);
  return box;
}

/* ---------- por tipo ---------- */
function transportFields(ctx: FormCtx, f: FormState): HTMLElement[] {
  const d = f.draft, r = routeOf(d);
  const setTitle = (from: string, to: string) => { d.title = `${vocab().kinds[d.kind as "flight"]} ${from.trim()} → ${to.trim()}`.trim(); };
  let from = r.from, to = r.to;
  const dep = whenParts(ctx, d, "depart"), arr = whenParts(ctx, d, "arrive");
  return [
    lab(t("f.kind"), seg(TRANSPORT.map(k => [k, t("k." + k)]), d.kind, v => { d.kind = v as Kind; setTitle(from, to); ctx.rerender(); })),
    h("div", { cls: "ct-grid ct-grid-2" },
      lab(t("f.from"), input(from, v => { from = v; setTitle(from, to); }, { placeholder: "MAD" })),
      lab(t("f.to"), input(to, v => { to = v; setTitle(from, to); }, { placeholder: "NRT" }))),
    h("div", { cls: "ct-grid ct-grid-3" },
      lab(t("f.departDay"), dateInput(dep.get().date, v => dep.set("date", v))),
      lab(t("f.departTime"), timeInput(dep.get().time || d.time, v => dep.set("time", v))),
      lab(t("f.departAt"), input(dep.get().at, v => dep.set("at", v)))),
    h("div", { cls: "ct-grid ct-grid-3" },
      lab(t("f.arriveDay"), dateInput(arr.get().date, v => arr.set("date", v))),
      lab(t("f.arriveTime"), timeInput(arr.get().time, v => arr.set("time", v))),
      lab(t("f.arriveAt"), input(arr.get().at, v => arr.set("at", v)))),
    h("div", { cls: "ct-grid ct-grid-3" },
      lab(t("f.code"), input(field(d, "code"), v => setField(d, "code", v, lineFor(d.kind, "code")))),
      lab(t("f.car"), input(field(d, "car"), v => setField(d, "car", v, lineFor(d.kind, "car")))),
      lab(t("f.luggage"), input(field(d, "luggage"), v => setField(d, "luggage", v, lineFor(d.kind, "luggage"))))),
    lab(t("f.seats"), input(field(d, "seats"), v => setField(d, "seats", v, lineFor(d.kind, "seats")), { placeholder: ctx.trip.travelers.map((p, i) => `${p} ${12 + i}A`).join(" · ") })),
  ];
}
function lodgingFields(ctx: FormCtx, f: FormState, city: string, country: string): HTMLElement[] {
  const d = f.draft;
  const ci = whenParts(ctx, d, "checkin"), co = whenParts(ctx, d, "checkout");
  const beds = /^(\d+)\s*(.*)$/.exec(field(d, "beds")) || ["", "", field(d, "beds")];
  let bedN = beds[1], bedType = beds[2];
  const setBeds = () => setField(d, "beds", [bedN, bedType].filter(Boolean).join(" "), lineFor("lodging", "beds"));
  const inc = new Set(field(d, "includes").split(/,\s*/).map(s => s.trim().toLowerCase()).filter(Boolean));
  const incLabel = (k: string) => t("inc." + k).toLowerCase();
  const incBox = h("span", { cls: "ct-people" });
  const drawInc = () => {
    incBox.empty();
    for (const k of INCLUDES) {
      const on = inc.has(incLabel(k));
      incBox.appendChild(button([icon(on ? "check" : "plus"), t("inc." + k)], "ct-pill" + (on ? " is-on" : " is-dashed"), () => {
        if (on) inc.delete(incLabel(k)); else inc.add(incLabel(k));
        setField(d, "includes", [...inc].join(", "), lineFor("lodging", "includes"));
        drawInc();
      }));
    }
  };
  drawInc();
  return [
    placePicker(ctx, d, f, city, country),
    h("div", { cls: "ct-grid ct-grid-4" },
      lab(t("f.checkinDay"), dateInput(ci.get().date, v => ci.set("date", v))),
      lab(t("f.checkin"), timeInput(ci.get().time || d.time, v => ci.set("time", v))),
      lab(t("f.checkoutDay"), dateInput(co.get().date, v => co.set("date", v))),
      lab(t("f.checkout"), timeInput(co.get().time, v => co.set("time", v)))),
    h("div", { cls: "ct-grid ct-grid-3" },
      lab(t("f.room"), select(field(d, "room"), ROOMS.map(k => [t("room." + k), t("room." + k)]), v => setField(d, "room", v, lineFor("lodging", "room")))),
      lab(t("f.beds"), h("span", { cls: "ct-inline" },
        input(bedN, v => { bedN = v.replace(/\D/g, ""); setBeds(); }, { inputmode: "numeric", class: "ct-input ct-input-num" }),
        select(bedType, BEDS.map(k => [t("bed." + k).toLowerCase(), t("bed." + k)]), v => { bedType = v; setBeds(); }))),
      lab(t("f.bath"), seg([[t("bath.private").toLowerCase(), t("bath.private")], [t("bath.shared").toLowerCase(), t("bath.shared")]], field(d, "bath").toLowerCase(),
        v => { setField(d, "bath", v, lineFor("lodging", "bath")); ctx.rerender(); }))),
    lab(t("f.includes"), incBox),
  ];
}

export function renderForm(ctx: FormCtx, f: FormState): HTMLElement {
  const d = f.draft, tr = ctx.trip, day = tr.days[f.day];
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
        f.draft = newItem(k, { time: keep });
        if (k === "rest") { f.draft.title = t("rest.back"); }
        if (k === "meal") f.draft.title = vocab().meals.lunch;
        ctx.rerender();
      });
    })));
  }
  if (f.isNew && isIso(date)) {                 /* lo nuevo empieza el día en que se añade */
    if (isTransport(d.kind) && !field(d, "depart")) setField(d, "depart", joinWhen(date, "", ""), lineFor(d.kind, "depart"));
    if (d.kind === "lodging" && !field(d, "checkin")) setField(d, "checkin", joinWhen(date, "", ""), lineFor("lodging", "checkin"));
  }
  const rows: (HTMLElement | null)[] = [];
  const timeRow = (key = "f.timeOpt") => lab(t(key), timeInput(d.time, v => { d.time = v; }));
  if (d.kind === "place") {
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow(), placePicker(ctx, d, f, city, country)));
  } else if (d.kind === "meal") {
    const isHome = d.place.toLowerCase() === vocab().home || d.place.toLowerCase() === "en casa" || d.place.toLowerCase() === "at home";
    const mode = d.link ? "restaurant" : isHome ? "home" : d.place ? "other" : "restaurant";
    rows.push(
      lab(t("f.meal"), seg(Object.entries(vocab().meals).map(([, m]) => [m, m]), d.title, v => { d.title = v; ctx.rerender(); })),
      h("div", { cls: "ct-grid ct-grid-time" }, timeRow(),
        lab(t("f.where"), seg([["restaurant", t("f.where.restaurant")], ["home", t("f.where.home")], ["other", t("f.placeName").split(" (")[0]]], mode, v => {
          if (v === "home") { d.link = ""; d.place = vocab().home; } else if (v === "other") { d.link = ""; d.place = d.place && !isHome ? d.place : " "; } else { d.place = ""; }
          ctx.rerender();
        }))),
      mode === "restaurant" ? placePicker(ctx, d, f, city, country) : null,
      mode === "other" ? lab(t("f.placeName"), input(d.place.trim(), v => { d.place = v; })) : null);
  } else if (isTransport(d.kind)) {
    rows.push(...transportFields(ctx, f));
  } else if (d.kind === "lodging") {
    rows.push(...lodgingFields(ctx, f, city, country));
  } else if (d.kind === "ticket") {
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow("f.time"), placePicker(ctx, d, f, city, country)),
      lab(t("f.tickets"), input(field(d, "tickets"), v => setField(d, "tickets", v, lineFor("ticket", "tickets")), { placeholder: "1 · adulto" })));
  } else if (d.kind === "rest") {
    const lodgingsHere = tr.days.flatMap(x => x.items).filter(i => i.kind === "lodging" && i.link);
    if (!d.link && lodgingsHere.length) d.link = lodgingsHere[lodgingsHere.length - 1].link;
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow(),
      lab(t("f.restTitle"), seg([[t("rest.back"), t("rest.back")], [t("rest.rest"), t("rest.rest")]], d.title, v => { d.title = v; ctx.rerender(); }))),
      lodgingsHere.length ? lab(t("k.lodging"), select(d.link, [...new Set(lodgingsHere.map(i => i.link))].map(l => [l, l]), v => { d.link = v; })) : null);
  } else {
    rows.push(h("div", { cls: "ct-grid ct-grid-time" }, timeRow(), lab(t("f.text"), input(d.title, v => { d.title = v; }))));
  }
  const money = d.kind === "note" || d.kind === "rest" ? null : h("div", { cls: "ct-grid ct-grid-price" },
    lab(d.kind === "lodging" ? t("f.priceTotal") : t("f.price"), input(d.price, v => { d.price = v; }, { placeholder: "0 €", inputmode: "decimal" })),
    tr.travelers.length > 1 ? lab(t("f.para"), paraChips(ctx, d)) : null);
  const docs = isTransport(d.kind) || d.kind === "lodging" || d.kind === "ticket" ? docsEditor(ctx, f) : null;
  form.append(...rows.filter((x): x is HTMLElement => !!x), ...(money ? [money] : []), ...(docs ? [docs] : []));
  form.appendChild(h("div", { cls: "ct-form-foot" },
    f.isNew ? null : button(t("f.delete"), "ct-link-btn", () => ctx.deleteForm(f)),
    h("span", { cls: "ct-grow" }),
    button(t("f.cancel"), "ct-btn-ghost", () => ctx.openForm(null)),
    h("button", { cls: "ct-btn-primary", attr: { type: "submit" } }, t("f.save"))));
  return form;
}
