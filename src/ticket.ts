/* La portada del viaje: la tarjeta de embarque. La misma en «Nuevo viaje» (create) y arriba de la nota (note). */
import { Platform } from "obsidian";
import { append, h } from "./dom";
import { t } from "./i18n";
import { dayNum, diffDays, isIso, longDate, spanLabel, todayIso, weekday, dayLabel } from "./dates";
import { balanceNights, citiesOfDay, nightsTotal, redate, tripDates } from "./md";
import type { Trip } from "./types";
import { PALETTE, accentOf, avatar, barcode, button, coverHex, destHex, icon, iconButton, imageAccent, kicker, label, miniPerson, notchH, notchV, paletteId, paperPlane, personChip, plain, useAccent } from "./ui";

export interface TicketCtx {
  mode: "create" | "note";
  phone: boolean;
  trip: Trip;
  path: string;                                  // «Viajes / 2027 - Japón.md»
  expanded?: boolean;                            // en el móvil, la portada de la nota desplegada para editarla
  locked?: boolean;                              // la portada de la nota, sellada (se desbloquea con el lápiz)
  changed(): void;                               // tras cada cambio: repintar (y guardar, en la nota)
  prompt(title: string, placeholder: string, value?: string): Promise<string | null>;
  promptDest(city: string, country: string, fallbackCountry: string): Promise<{ city: string; country: string } | null>;
  rename?(name: string): void;                   // cambiar el nombre de la nota
  create?(): void;
  toggleExpanded?(): void;
  jump?(date: string): void;
  coverSrc?(cover: string): string | null;       // la URL de una portada con imagen
}

const INK = "#141414";
/* se puede editar: siempre en «Nuevo viaje»; en la nota, solo con la portada desbloqueada */
const editable = (ctx: TicketCtx) => ctx.mode === "create" || !ctx.locked;
const fit = (names: string[], width: number, max: number) => {
  const longest = Math.max(4, ...names.map(n => n.length));
  return Math.max(28, Math.min(max, Math.floor(width / (longest * 0.66 * names.length + (names.length - 1) * 1.6))));
};

/* ---------- acciones sobre el viaje (las comparten escritorio y móvil) ---------- */
function addDest(ctx: TicketCtx) {
  const tr = ctx.trip;
  void ctx.promptDest("", "", tr.dests[tr.dests.length - 1]?.country || "").then(v => {
    if (!v) return;
    tr.dests.push({ city: v.city, country: v.country, nights: 0, travelers: [...tr.travelers] });
    if (tr.dests.length > 1) {                                  // el nuevo se queda con la mitad de las noches del anterior
      const prev = tr.dests[tr.dests.length - 2], half = Math.floor(prev.nights / 2);
      prev.nights -= half; tr.dests[tr.dests.length - 1].nights = half;
    }
    balanceNights(tr);
    ctx.changed();
  });
}
function editDest(ctx: TicketCtx, i: number) {
  const d = ctx.trip.dests[i];
  void ctx.promptDest(d.city, d.country, d.country).then(v => {
    if (!v) return;
    d.city = v.city; d.country = v.country;
    ctx.changed();
  });
}
function removeDest(ctx: TicketCtx, i: number) {
  const tr = ctx.trip, [gone] = tr.dests.splice(i, 1);
  const to = tr.dests[Math.max(0, i - 1)];
  if (to && gone) to.nights += gone.nights;
  balanceNights(tr);
  ctx.changed();
}
function stepNights(ctx: TicketCtx, i: number, by: number) {
  const ds = ctx.trip.dests, d = ds[i];
  if (!d || ds.length < 2) return;
  const j = i < ds.length - 1 ? i + 1 : i - 1;             // la noche se la quita (o se la da) al vecino
  if (by > 0 && ds[j].nights <= 0) return;
  if (by < 0 && d.nights <= 0) return;
  d.nights += by; ds[j].nights -= by;
  ctx.changed();
}
function toggleDestTraveler(ctx: TicketCtx, i: number, name: string) {
  const d = ctx.trip.dests[i], k = d.travelers.indexOf(name);
  if (k >= 0) d.travelers.splice(k, 1); else d.travelers.push(name);
  ctx.changed();
}
function addTraveler(ctx: TicketCtx) {
  void ctx.prompt(t("addTraveler"), t("new.travelerPh")).then(v => {
    const name = (v || "").trim();
    if (!name || ctx.trip.travelers.includes(name)) return;
    ctx.trip.travelers.push(name);
    for (const d of ctx.trip.dests) d.travelers.push(name);
    ctx.changed();
  });
}
function removeTraveler(ctx: TicketCtx, name: string) {
  const tr = ctx.trip;
  tr.travelers = tr.travelers.filter(x => x !== name);
  for (const d of tr.dests) d.travelers = d.travelers.filter(x => x !== name);
  ctx.changed();
}
function setDates(ctx: TicketCtx, start: string, end: string) {
  if (!isIso(start)) return;
  if (!isIso(end) || end < start) end = start;
  if (ctx.mode === "note") redate(ctx.trip, start, end);
  else { ctx.trip.start = start; ctx.trip.end = end; balanceNights(ctx.trip); }
  ctx.changed();
}

/* un campo de fecha: se ve el texto bonito y encima, invisible, el selector de fecha del sistema */
function dateField(ctx: TicketCtx, lbl: string, value: string, set: (v: string) => void, size: "lg" | "md" | "sm"): HTMLElement {
  if (!editable(ctx)) return staticField(lbl, value ? (size === "lg" ? longDate(value) : dayLabel(value)) : "—", size);
  const tap = Platform.isMobile;
  const input = h("input", { cls: "ct-date-input" + (tap ? " is-tap" : ""), attr: tap ? { type: "date", value, "aria-label": lbl } : { type: "date", value, tabindex: "-1", "aria-hidden": "true" } });
  let last = value;
  const pick = () => { if (input.value && input.value !== last) { last = input.value; set(input.value); } };
  input.addEventListener("change", pick);
  input.addEventListener("blur", pick);
  const text = value ? (size === "lg" ? longDate(value) : dayLabel(value)) : "—";
  const open = () => {
    try { input.showPicker(); } catch { input.focus(); input.click(); }
  };
  const field = button([label(lbl), h("span", { cls: "ct-field-value" }, text, icon("calendar"))],
    `ct-field ct-field-btn ct-field-${size} is-input`, open, { "aria-label": `${lbl}: ${text}` });
  return h("span", { cls: "ct-field-wrap" }, field, input);
}
const staticField = (lbl: string, value: string | Node, size: "lg" | "md" | "sm") =>
  h("span", { cls: `ct-field ct-field-${size}` }, label(lbl), h("span", { cls: "ct-field-value" }, value));

function countdown(tr: Trip, big: boolean): HTMLElement {
  const today = todayIso();
  let n = "", txt = "";
  if (isIso(tr.start) && today < tr.start) { n = String(diffDays(today, tr.start)); txt = t("days.to"); }
  else if (isIso(tr.start) && isIso(tr.end) && today <= tr.end) { n = String(diffDays(tr.start, today) + 1); txt = t("days.during", { m: tripDates(tr).length }); }
  else if (isIso(tr.end)) { txt = t("trip.done"); }
  return h("div", { cls: "ct-countdown" + (big ? " is-big" : "") },
    n ? h("span", { cls: "ct-countdown-n" }, n) : null,
    h("span", { cls: "ct-countdown-t" }, ...txt.split("\n").flatMap((s, i) => i ? [h("br"), s] : [s])));
}

function swatches(ctx: TicketCtx): HTMLElement {
  const tr = ctx.trip, cur = paletteId(tr.cover);
  const box = h("div", { cls: "ct-swatches", attr: { role: "radiogroup", "aria-label": t("new.cover") } });
  for (const p of PALETTE) {
    const b = button(null, "ct-swatch" + (cur === p.id ? " is-on" : ""), () => { tr.cover = t("palette." + p.id).toLowerCase(); tr.accent = ""; ctx.changed(); },
      { role: "radio", "aria-checked": String(cur === p.id), "aria-label": t("palette." + p.id) });
    b.setCssProps({ "--ct-swatch": p.hex });
    box.appendChild(b);
  }
  const img = button(icon("image"), "ct-swatch ct-swatch-img" + (cur ? "" : " is-on"), () => {
    void ctx.prompt(t("coverImage"), t("new.imagePh"), cur ? "" : tr.cover).then(v => {
      if (!v) return;
      tr.accent = accentOf(tr.cover, tr.accent);                 // si la imagen no deja leer su color, se queda el último
      tr.cover = v.trim();
      ctx.changed();
      const src = ctx.coverSrc?.(tr.cover);
      if (src) void imageAccent(src).then(id => { if (id && id !== tr.accent && tr.cover === v.trim()) { tr.accent = id; ctx.changed(); } });
    });
  }, { role: "radio", "aria-checked": String(!cur), "aria-label": t("coverImage") });
  const src = !cur ? ctx.coverSrc?.(tr.cover) : null;
  if (src) { img.addClass("has-image"); img.setCssProps({ "--ct-cover-img": `url("${src.replace(/"/g, "%22")}")` }); }
  box.appendChild(img);
  return box;
}

function strip(ctx: TicketCtx): HTMLElement {
  const tr = ctx.trip;
  const box = h("div", { cls: "ct-strip" });
  for (const date of tripDates(tr)) {
    const cs = citiesOfDay(tr, date).map(d => tr.dests.indexOf(d));
    const cell = button([h("span", { cls: "ct-strip-wd" }, weekday(date)), h("span", { cls: "ct-strip-n" }, String(dayNum(date)))], "ct-strip-day",
      ctx.jump ? () => ctx.jump!(date) : undefined, { "aria-label": dayLabel(date) });
    if (cs.length > 1) cell.setCssProps({ "--ct-day-a": destHex(cs[0]), "--ct-day-b": destHex(cs[1]) });
    else cell.setCssProps({ "--ct-day-a": destHex(Math.max(0, cs[0])), "--ct-day-b": destHex(Math.max(0, cs[0])) });
    box.appendChild(cell);
  }
  return box;
}

function stepper(ctx: TicketCtx, i: number): HTMLElement {
  return h("span", { cls: "ct-stepper" },
    iconButton("minus", t("remove"), () => stepNights(ctx, i, -1), "ct-stepbtn"),
    h("span", { cls: "ct-step-n" }, String(ctx.trip.dests[i].nights)),
    iconButton("plus", t("addDest"), () => stepNights(ctx, i, 1), "ct-stepbtn"));
}
function destRows(ctx: TicketCtx, big: boolean): HTMLElement {
  const tr = ctx.trip;
  const box = h("div", { cls: "ct-dest-rows" + (big ? " is-big" : "") });
  let acc = 0;
  tr.dests.forEach((d, i) => {
    const a = isIso(tr.start) ? tripDates(tr)[acc] : "", b = isIso(tr.start) ? tripDates(tr)[Math.min(acc + d.nights, tripDates(tr).length - 1)] : "";
    acc += d.nights;
    const sw = h("span", { cls: "ct-dest-sw" }); sw.setCssProps({ "--ct-sw": destHex(i) });
    const edit = editable(ctx);
    const people = edit ? tr.travelers.map((p, k) => big ? personChip(p, k, d.travelers.includes(p), () => toggleDestTraveler(ctx, i, p))
      : miniPerson(p, k, d.travelers.includes(p), () => toggleDestTraveler(ctx, i, p)))
      : d.travelers.map(p => h("span", { cls: "ct-mini-person is-on is-static" }, avatar(p, Math.max(0, tr.travelers.indexOf(p)), "ct-avatar ct-avatar-xs"), h("span", null, p)));
    const cityText = d.country && !big ? `${d.city} · ${d.country}` : d.city;      /* en el móvil, como en el diseño: solo la ciudad */
    box.appendChild(h("div", { cls: "ct-dest-row" },
      h("div", { cls: "ct-dest-top" }, sw,
        h("span", { cls: "ct-dest-name" }, edit ? button(cityText, "ct-dest-city", () => editDest(ctx, i), { "aria-label": `${t("edit")} ${d.city}` }) : h("span", { cls: "ct-dest-city" }, cityText),
          h("span", { cls: "ct-dest-dates" }, [a && b ? spanLabel(a, b) : "", t("nights")].filter(Boolean).join(" · "))),
        edit && tr.dests.length > 1 ? stepper(ctx, i) : h("span", { cls: "ct-step-n" }, String(d.nights)),
        edit ? iconButton("x", t("removeDest"), () => removeDest(ctx, i), "ct-ibtn ct-ibtn-sm") : null),
      people.length ? h("div", { cls: "ct-dest-people" }, people) : null));
  });
  return box;
}

function travelersBox(ctx: TicketCtx): HTMLElement {
  const tr = ctx.trip;
  if (!editable(ctx)) return h("div", { cls: "ct-people" }, tr.travelers.map((p, k) =>
    h("span", { cls: "ct-person is-on is-static" }, avatar(p, k), h("span", null, p))));
  return h("div", { cls: "ct-people" },
    tr.travelers.map((p, k) => {
      const chip = personChip(p, k, true, () => removeTraveler(ctx, p));
      chip.setAttribute("aria-label", `${t("remove")} ${p}`);
      return chip;
    }),
    iconButton("plus", t("addTraveler"), () => addTraveler(ctx), "ct-person-add"));
}
function noteName(ctx: TicketCtx, big: boolean): HTMLElement {
  const name = h("span", { cls: "ct-note-name" + (big ? " is-big" : "") }, ctx.trip.name || "—");
  const el = h("span", { cls: "ct-note" }, label(t("new.note")), name, h("span", { cls: "ct-note-path" }, ctx.path));
  if (ctx.rename && editable(ctx)) {
    name.addClass("is-editable");
    name.setAttribute("role", "button"); name.setAttribute("tabindex", "0");
    const go = () => void ctx.prompt(t("new.note"), t("new.note"), ctx.trip.name).then(v => { if (v && v.trim() && v.trim() !== ctx.trip.name) ctx.rename!(v.trim()); });
    name.addEventListener("click", go);
    name.addEventListener("keydown", ev => { if (ev.key === "Enter") go(); });
  }
  return el;
}
function coverStyle(ctx: TicketCtx, el: HTMLElement) {
  el.setCssProps({ "--ct-cover": coverHex(ctx.trip.cover, ctx.trip.accent) });
  if (paletteId(ctx.trip.cover)) return;
  const src = ctx.coverSrc?.(ctx.trip.cover);
  if (src) { el.addClass("has-image"); el.setCssProps({ "--ct-cover-img": `url("${src.replace(/"/g, "%22")}")` }); }
}
const destBtn = (ctx: TicketCtx, small: boolean) => !editable(ctx) ? null :
  button([icon("plus"), h("span", null, t("addDest"))], "ct-dest-add" + (small ? " is-small" : ""), () => addDest(ctx));

/* ---------- escritorio ---------- */
function desktop(ctx: TicketCtx): HTMLElement {
  const tr = ctx.trip, create = ctx.mode === "create";
  const names = tr.dests.map(d => d.city);
  const size = fit(names, create ? 760 : 600, 92);          // la portada de la nota es más estrecha
  const cities: HTMLElement[] = [];
  tr.dests.forEach((d, i) => {
    if (i) cities.push(h("span", { cls: "ct-route", attr: { "aria-hidden": "true" } }, h("span", { cls: "ct-route-line" }), h("span", { cls: "ct-route-plane" }, paperPlane()), h("span", { cls: "ct-route-line" })));
    const el = h("span", { cls: "ct-city" }, h("span", { cls: "ct-city-name" }, d.city),
      h("span", { cls: "ct-city-sub" }, [d.country, `${d.nights} ${d.nights === 1 ? t("night") : t("nights")}`].filter(Boolean).join(" · ")));
    el.setCssProps({ "--ct-city-size": size + "px" });
    cities.push(el);
  });
  if (!tr.dests.length) cities.push(h("span", { cls: "ct-city ct-city-empty" }, h("span", { cls: "ct-city-name" }, "?")));
  const header = h("div", { cls: "ct-cover" },
    h("div", { cls: "ct-cover-top" }, kicker(t("new.destinations")), destBtn(ctx, true)),
    h("div", { cls: "ct-cities" }, cities));
  coverStyle(ctx, header);
  const nights = nightsTotal(tr), days = tripDates(tr).length;
  const fields = h("div", { cls: "ct-fields" },
    dateField(ctx, t("new.depart"), tr.start, v => setDates(ctx, v, tr.end), "lg"),
    dateField(ctx, t("new.return"), tr.end, v => setDates(ctx, tr.start, v), "lg"),
    staticField(t("new.days"), days ? String(days) : "—", "lg"),
    staticField(t("new.nights"), days ? String(nights) : "—", "lg"));
  const reparto = tr.dests.length ? h("div", { cls: "ct-reparto" }, label(t("new.split")), days ? strip(ctx) : null, destRows(ctx, false)) : null;
  const main = h("div", { cls: "ct-ticket-main" }, header, h("div", { cls: "ct-ticket-body" }, fields, reparto));
  /* en la nota, el lápiz de arriba a la izquierda desbloquea la portada (y el ✓ la vuelve a sellar) */
  const lock = create ? null : iconButton(ctx.locked ? "pencil" : "check", t(ctx.locked ? "editCover" : "lockCover"), () => ctx.toggleExpanded?.(), "ct-band-btn" + (ctx.locked ? "" : " is-on"));
  const band = h("div", { cls: "ct-band" }, lock,
    h("span", { cls: "ct-band-text", attr: { "aria-hidden": "true" } }, t("band", { y: isIso(tr.start) ? tr.start.slice(0, 4) : "" })));
  const code = barcode(plain(tr.name).replace(/\W/g, "").toUpperCase() || "COOLTRIP",
    ["CT", isIso(tr.start) ? tr.start.slice(0, 4) : "", ...tr.dests.slice(0, 3).map(d => plain(d.city).slice(0, 3).toUpperCase())].filter(Boolean).join(" · "));
  const end = create
    ? [code, button([h("span", null, t("new.create")), icon("arrow-right")], "ct-btn-primary ct-btn-create", () => ctx.create?.())]
    : [countdown(tr, true), code];
  const stub = h("div", { cls: "ct-stub" },
    noteName(ctx, true),
    h("div", { cls: "ct-stub-block" }, label(t("new.travelers")), travelersBox(ctx)),
    editable(ctx) ? h("div", { cls: "ct-stub-block" }, label(t("new.cover")), swatches(ctx)) : null,
    h("span", { cls: "ct-grow" }), end);
  return h("div", { cls: "ct-ticket" + (create ? " is-create" : editable(ctx) ? " is-editing" : " is-locked") }, band, main, notchV(), stub);
}

/* ---------- móvil ---------- */
function phoneHeader(ctx: TicketCtx): HTMLElement {
  const tr = ctx.trip;
  const size = Math.min(64, Math.floor(330 / (Math.max(4, ...tr.dests.map(d => d.city.length)) * 0.66)));
  const header = h("div", { cls: "ct-cover ct-cover-phone" });
  coverStyle(ctx, header);
  header.setCssProps({ "--ct-city-size": size + "px" });
  const sub = (d: Trip["dests"][number]) => h("span", { cls: "ct-city-sub" }, [d.country, `${d.nights} ${d.nights === 1 ? t("night") : t("nights")}`].filter(Boolean).join(" · ").toUpperCase());
  if (!tr.dests.length) {
    append(header, [h("span", { cls: "ct-city-name" }, "?"), destBtn(ctx, true)]);
    return header;
  }
  tr.dests.forEach((d, i) => {
    const first = i === 0;
    if (!first) header.appendChild(h("div", { cls: "ct-bar-row" }, h("span", { cls: "ct-bar-line" }), i === 1 ? destBtn(ctx, true) : null));
    header.appendChild(h("div", { cls: "ct-city-stack" }, first ? null : sub(d), h("span", { cls: "ct-city-name" }, d.city), first ? sub(d) : null));
  });
  if (tr.dests.length === 1) append(header, [destBtn(ctx, true)]);
  return header;
}
function phone(ctx: TicketCtx): HTMLElement {
  const tr = ctx.trip, create = ctx.mode === "create";
  const header = phoneHeader(ctx);
  const days = tripDates(tr).length;
  const portada = h("div", { cls: "ct-stub-block" }, label(t("new.cover")), swatches(ctx));
  const bar = tr.dests.length > 1 && days ? h("div", { cls: "ct-split-bar" }, tr.dests.map((d, i) => {
    const seg = h("span", { cls: "ct-split-seg" }, h("b", null, d.city.toUpperCase()), h("span", null, `${d.nights} ${t("nights")}`));
    seg.setCssProps({ "--ct-seg": destHex(i), "--ct-grow": String(Math.max(1, d.nights)) });
    return seg;
  })) : null;
  const editor = h("div", { cls: "ct-phone-stub" },
    tr.dests.length ? h("div", { cls: "ct-stub-block" }, label(t("new.splitShort")), bar, destRows(ctx, true)) : null,
    h("div", { cls: "ct-stub-block" }, label(t("new.travelers")), travelersBox(ctx)),
    portada);
  if (create) {
    const body = h("div", { cls: "ct-phone-body" }, noteName(ctx, true),
      h("div", { cls: "ct-fields ct-fields-2" },
        dateField(ctx, t("new.depart"), tr.start, v => setDates(ctx, v, tr.end), "md"),
        dateField(ctx, t("new.return"), tr.end, v => setDates(ctx, tr.start, v), "md"),
        staticField(t("new.days"), days ? String(days) : "—", "md"),
        staticField(t("new.nights"), days ? String(nightsTotal(tr)) : "—", "md")));
    editor.appendChild(barcode(plain(tr.name).replace(/\W/g, "").toUpperCase() || "COOLTRIP",
      ["CT", isIso(tr.start) ? tr.start.slice(0, 4) : "", ...tr.dests.slice(0, 3).map(d => plain(d.city).slice(0, 3).toUpperCase())].filter(Boolean).join(" · ")));
    editor.appendChild(button([h("span", null, t("new.create")), icon("arrow-right")], "ct-btn-primary ct-btn-create", () => ctx.create?.()));
    return h("div", { cls: "ct-ticket ct-ticket-phone is-create" }, header, body, notchH(), editor);
  }
  /* nota: compacta; el lápiz despliega lo mismo que en «Nuevo viaje» */
  const cells = h("div", { cls: "ct-phone-cells" },
    dateField(ctx, t("new.depart"), tr.start, v => setDates(ctx, v, tr.end), "sm"),
    dateField(ctx, t("new.return"), tr.end, v => setDates(ctx, tr.start, v), "sm"),
    staticField(t("new.days"), days ? String(days) : "—", "sm"),
    staticField(t("new.travelers"), h("span", { cls: "ct-faces" }, tr.travelers.map((p, k) => avatar(p, k, "ct-avatar ct-avatar-face"))), "sm"),
    iconButton(ctx.expanded ? "chevron-down" : "pencil", t("editCover"), () => ctx.toggleExpanded?.(), "ct-ibtn ct-ibtn-sm"));
  const stub = h("div", { cls: "ct-phone-count" }, countdown(tr, true),
    barcode(plain(tr.name).replace(/\W/g, "").toUpperCase() || "COOLTRIP", ["CT", tr.start.slice(0, 4), ...tr.dests.slice(0, 3).map(d => plain(d.city).slice(0, 3).toUpperCase())].filter(Boolean).join(" · "), 46));
  return h("div", { cls: "ct-ticket ct-ticket-phone" }, header, cells, ctx.expanded ? h("div", { cls: "ct-phone-edit" }, noteName(ctx, true), editor) : null, notchH(), stub);
}

export function ticket(ctx: TicketCtx): HTMLElement {
  useAccent(accentOf(ctx.trip.cover, ctx.trip.accent));
  return ctx.phone ? phone(ctx) : desktop(ctx);
}
export { INK };
