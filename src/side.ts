/* El lateral de la nota: la mochila (documentos de siempre), por hacer y el coste del viaje. */
import { h } from "./dom";
import { t } from "./i18n";
import { addDays } from "./dates";
import { currencyOf, fmtMoney, priceValue } from "./md";
import { mapsUrl } from "./places";
import type { PlanCtx } from "./plan";
import { docButton, lodgings } from "./plan";
import type { Doc, Item, Where } from "./types";
import { isTransport } from "./types";
import { PALETTE, avatar, button, icon, iconButton, label } from "./ui";

export interface SideCtx extends PlanCtx {
  folded: Set<string>;            // cajas contraídas (en el móvil)
  bagDraft: Doc | null;           // el documento que se está añadiendo a la mochila
  setBagDraft(d: Doc | null, redraw?: boolean): void;
}

function box(ctx: SideCtx, id: string, title: string, right: HTMLElement | string | null, body: () => (HTMLElement | null)[], summary?: () => HTMLElement | null): HTMLElement {
  const folded = ctx.folded.has(id);
  const head = h("div", { cls: "ct-box-head" }, h("h3", { cls: "ct-h-box" }, title), h("span", { cls: "ct-grow" }),
    typeof right === "string" ? h("span", { cls: "ct-sub" }, right) : right,
    iconButton(folded ? "chevron-right" : "chevron-down", t(folded ? "expand" : "collapse"), () => {
      if (folded) ctx.folded.delete(id); else ctx.folded.add(id);
      ctx.rerender();
    }, "ct-ibtn ct-ibtn-sm"));
  return h("section", { cls: "ct-box" + (folded ? " is-folded" : "") }, head, folded ? summary?.() ?? null : body());
}

/* ---------- mochila ---------- */
function bagSuggestions(ctx: SideCtx): string[] {
  const have = new Set(ctx.trip.mochila.map(d => d.name.toLowerCase()));
  const es = t("bag") === "Mochila";
  const out: string[] = [];
  for (const p of ctx.trip.travelers) out.push(`${es ? "Pasaporte" : "Passport"} · ${p}`);
  out.push(es ? "Seguro de viaje" : "Travel insurance");
  for (const p of ctx.trip.travelers) out.push(`${es ? "DNI" : "ID card"} · ${p}`);
  out.push(es ? "Tarjeta sanitaria" : "Health card");
  const names = [...have];
  return out.filter(s => !names.some(n => n.startsWith(s.toLowerCase()))).slice(0, 4);
}
function docForm(ctx: SideCtx): HTMLElement {
  const d = ctx.bagDraft!;
  const wheres: Where[] = (["cloud", "wallet", "device", "vault"] as Where[]).filter(w => ctx.s.files[w as "cloud"]);
  wheres.push("paper");
  const name = h("input", { cls: "ct-input", attr: { type: "text", value: d.name, placeholder: t("f.docName") } });
  name.addEventListener("input", () => { d.name = name.value; });
  const url = h("input", { cls: "ct-input", attr: { type: "text", value: d.url, placeholder: d.where === "vault" ? ctx.s.files.vaultFolder + "/…" : "https://…" } });
  url.addEventListener("input", () => { d.url = url.value; });
  return h("form", { cls: "ct-form ct-form-small" },
    h("label", { cls: "ct-f" }, label(t("f.docName")), name),
    h("label", { cls: "ct-f" }, label(t("f.where")), h("span", { cls: "ct-seg" }, wheres.map(w =>
      button(t("w." + w), "ct-pill" + (w === d.where ? " is-solid" : ""), () => { d.where = w; ctx.rerender(); })))),
    d.where === "cloud" || d.where === "device" || d.where === "vault" ? h("label", { cls: "ct-f" }, label(d.where === "vault" ? t("f.vaultPath") : t("f.link")), url) : null,
    h("div", { cls: "ct-form-foot" }, h("span", { cls: "ct-grow" }),
      button(t("f.cancel"), "ct-btn-ghost", () => ctx.setBagDraft(null)),
      button(t("f.save"), "ct-btn-primary", () => {
        if (!d.name.trim()) return;
        ctx.trip.mochila.push({ name: d.name.trim(), where: d.where, url: d.where === "paper" || d.where === "wallet" ? "" : d.url.trim() });
        ctx.setBagDraft(null, false);
        ctx.commit();
      })));
}
export function mochila(ctx: SideCtx): HTMLElement {
  const docs = ctx.trip.mochila, paper = docs.filter(d => d.where === "paper").length;
  const right = paper ? t("bag.count", { n: docs.length, p: paper }) : String(docs.length);
  const firstWhere = (): Where => (["cloud", "wallet", "device", "vault"] as Where[]).find(w => ctx.s.files[w as "cloud"]) || "paper";
  return box(ctx, "bag", t("bag"), right, () => [
    h("div", { cls: "ct-docs" }, docs.map((d, i) => h("div", { cls: "ct-doc-edit-row" }, docButton(ctx, d),
      iconButton("x", t("remove"), () => { docs.splice(i, 1); ctx.commit(); }, "ct-ibtn ct-ibtn-sm ct-hover")))),
    bagSuggestions(ctx).length ? h("div", { cls: "ct-suggest" }, label(t("bag.suggest")), h("div", { cls: "ct-row-btns" },
      bagSuggestions(ctx).map(s => button([icon("plus"), s], "ct-pill is-dashed", () => ctx.setBagDraft({ name: s, where: /pasaporte|passport|dni|id card|sanitaria|health/i.test(s) ? "paper" : firstWhere(), url: "" }))))) : null,
    ctx.bagDraft ? docForm(ctx) : button([icon("plus"), t("bag.add")], "ct-btn-ghost is-wide", () => ctx.setBagDraft({ name: "", where: firstWhere(), url: "" })),
  ]);
}

/* ---------- por hacer ---------- */
interface Suggest { text: string; action?: [string, () => void] }
function todoSuggestions(ctx: SideCtx): Suggest[] {
  const tr = ctx.trip, have = new Set(tr.tasks.map(x => x.text.toLowerCase()));
  const out: Suggest[] = [];
  const spans = lodgings(tr);
  let acc = 0;
  tr.dests.forEach(dest => {
    const first = addDays(tr.start, acc); acc += dest.nights;
    if (!dest.nights) return;
    const covered = Array.from({ length: dest.nights }, (_, i) => addDays(first, i)).some(n => spans.some(l => l.from <= n && n < l.to));
    if (!covered) out.push({ text: t("todo.lodging", { c: dest.city }), action: [t("todo.addBtn"), () => {
      const di = tr.days.findIndex(d => d.date === first);
      const draft: Item = { kind: "lodging", check: false, done: false, time: "", title: "", link: "", place: "", price: "", para: [], fields: [], docs: [], extra: [] };
      ctx.openForm({ day: Math.max(0, di), index: -1, isNew: true, draft });
    }] });
  });
  if (tr.dests.length) {
    const cities = tr.dests.map(d => d.city);
    const list = cities.length > 1 ? cities.slice(0, -1).join(", ") + (t("bag") === "Mochila" ? " y " : " and ") + cities[cities.length - 1] : cities[0];
    out.push({ text: t("todo.maps", { c: list }), action: [t("todo.mapsBtn"), () => ctx.openUrl(mapsUrl(ctx.s.maps.app, tr.dests[0].city, tr.dests[0].country, null))] });
  }
  const firstFlight = tr.days.flatMap(d => d.items).find(i => i.kind === "flight");
  if (firstFlight) out.push({ text: t("todo.checkinOut") });
  return out.filter(s => !have.has(s.text.toLowerCase()));
}
function taskRow(ctx: SideCtx, text: string, done: boolean, onToggle: () => void, extra: HTMLElement | null, onRemove: (() => void) | null): HTMLElement {
  return h("div", { cls: "ct-task" + (done ? " is-done" : "") },
    button(done ? icon("check") : null, "ct-task-check" + (done ? " is-done" : ""), onToggle, { role: "checkbox", "aria-checked": String(done), "aria-label": text }),
    h("span", { cls: "ct-task-text" }, text), extra,
    onRemove ? iconButton("x", t("remove"), onRemove, "ct-ibtn ct-ibtn-sm ct-hover") : null);
}
export function porHacer(ctx: SideCtx): HTMLElement {
  const tr = ctx.trip;
  const sugg = todoSuggestions(ctx);
  const pending = tr.tasks.filter(x => !x.done), done = tr.tasks.filter(x => x.done);
  const total = tr.tasks.length + sugg.length, ndone = done.length;
  const bar = h("div", { cls: "ct-progress", attr: { role: "progressbar", "aria-valuenow": String(ndone), "aria-valuemax": String(total) } }, h("span", null));
  (bar.firstChild as HTMLElement).setCssProps({ "--ct-p": total ? `${(ndone / total) * 100}%` : "0%", "--ct-accent-fill": PALETTE[0].hex });
  const right = h("span", { cls: "ct-count" }, `${ndone}/${total}`);
  const add = h("input", { cls: "ct-input", attr: { type: "text", placeholder: t("todo.add") } });
  add.addEventListener("keydown", ev => {
    if (ev.key !== "Enter" || !add.value.trim()) return;
    ev.preventDefault();
    tr.tasks.push({ text: add.value.trim(), done: false });
    ctx.commit();
  });
  const list = (rows: HTMLElement[]) => rows.length ? h("div", { cls: "ct-task-list" }, rows) : null;
  const pendingRows = [
    ...sugg.map(s => taskRow(ctx, s.text, false, () => { tr.tasks.push({ text: s.text, done: true }); ctx.commit(); },
      s.action ? button(s.action[0], "ct-pill is-small", s.action[1]) : h("span", { cls: "ct-sub" }, t("todo.suggested")), null)),
    ...pending.map(x => taskRow(ctx, x.text, false, () => { x.done = true; ctx.commit(); }, null, () => { tr.tasks.splice(tr.tasks.indexOf(x), 1); ctx.commit(); })),
  ];
  const doneRows = done.map(x => taskRow(ctx, x.text, true, () => { x.done = false; ctx.commit(); }, null, () => { tr.tasks.splice(tr.tasks.indexOf(x), 1); ctx.commit(); }));
  const next = pendingRows.length ? (sugg[0]?.text || pending[0]?.text) : "";
  return box(ctx, "todo", t("todo"), right, () => [
    bar,
    pendingRows.length ? h("span", { cls: "ct-group" }, h("span", null, t("todo.pending")), h("span", null, String(pendingRows.length))) : null,
    list(pendingRows),
    doneRows.length ? h("span", { cls: "ct-group" }, h("span", null, t("todo.done")), h("span", null, String(doneRows.length))) : null,
    list(doneRows), add,
  ], () => h("div", { cls: "ct-folded" }, bar, next ? h("span", { cls: "ct-sub" }, t("todo.next", { t: next })) : null));
}

/* ---------- coste ---------- */
const CAT = (it: Item): string => isTransport(it.kind) ? "transport" : it.kind === "lodging" ? "lodging" : it.kind === "meal" ? "meals" : it.kind === "ticket" ? "tickets" : it.kind === "place" ? "places" : "other";
const CAT_COLOR: Record<string, string> = { transport: "#E8613C", lodging: "#9CC9F0", meals: "#EDC14B", tickets: "#B5D69A", places: "#C2B3F5", other: "#F5AFC0" };
export function coste(ctx: SideCtx): HTMLElement {
  const tr = ctx.trip;
  const items = tr.days.flatMap(d => d.items).filter(i => i.price);
  const cur = items.length ? currencyOf(items[0].price) : "€";
  const total = items.reduce((a, i) => a + priceValue(i.price), 0);
  const per: Record<string, number> = {};
  for (const p of tr.travelers) per[p] = 0;
  const cats: Record<string, number> = {};
  for (const it of items) {
    const v = priceValue(it.price), who = it.para.length ? it.para.filter(p => p in per) : tr.travelers;
    for (const p of who) per[p] += v / Math.max(1, who.length);
    cats[CAT(it)] = (cats[CAT(it)] || 0) + v;
  }
  const missing: string[] = [];
  for (const d of tr.days) for (const it of d.items) if (!it.price && (isTransport(it.kind) || it.kind === "lodging")) missing.push(it.link || it.title);
  const spans = lodgings(tr);
  let acc = 0;
  for (const dest of tr.dests) {
    const first = addDays(tr.start, acc); acc += dest.nights;
    if (dest.nights && !Array.from({ length: dest.nights }, (_, i) => addDays(first, i)).some(n => spans.some(l => l.from <= n && n < l.to))) missing.push(t("slot.lodging", { c: dest.city }));
  }
  const rows = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => {
    const fill = h("span", null); fill.setCssProps({ "--ct-p": total ? `${Math.max(2, (v / total) * 100)}%` : "0%", "--ct-accent-fill": CAT_COLOR[k] });
    return h("div", { cls: "ct-cost-row" }, h("span", { cls: "ct-cost-line" }, h("span", null, t("cost." + k)), h("span", { cls: "ct-num" }, fmtMoney(v, cur))),
      h("span", { cls: "ct-progress is-thin" }, fill));
  });
  return box(ctx, "cost", t("cost"), null, () => [
    h("div", { cls: "ct-cost-total" }, h("span", { cls: "ct-h-total" }, fmtMoney(total, cur)), h("span", { cls: "ct-sub" }, t("cost.sub"))),
    tr.travelers.length > 1 ? h("div", { cls: "ct-cost-people" }, tr.travelers.map((p, i) => h("span", { cls: "ct-cost-person" }, avatar(p, i, "ct-avatar ct-avatar-lg"),
      h("span", { cls: "ct-name-col" }, h("b", { cls: "ct-num" }, fmtMoney(per[p], cur)), h("span", { cls: "ct-sub" }, p))))) : null,
    tr.travelers.length > 1 ? h("span", { cls: "ct-sub" }, t("cost.who")) : null,
    ...rows,
    ...missing.map(m => h("div", { cls: "ct-missing" }, icon("circle-dashed"), h("span", null, t("cost.missing", { t: m })))),
  ]);
}
