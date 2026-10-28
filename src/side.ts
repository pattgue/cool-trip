/* El lateral de la nota: la mochila (documentos de siempre), por hacer y el coste del viaje. */
import { h } from "./dom";
import { locale, t } from "./i18n";
import { addDays, todayIso } from "./dates";
import { fmtMoney, newItem, priceValue, tripCurrency } from "./md";
import { mapsUrl } from "./places";
import type { PlanCtx } from "./plan";
import { lodgings } from "./plan";
import { blankDoc, docButton, docForm, docWheres, firstWhere } from "./docs";
import type { Doc, Item, Task, Where } from "./types";
import { isTransport } from "./types";
import { avatar, button, destHex, icon, iconButton, label, plain } from "./ui";
import { promptText } from "./prompt";

export interface SideCtx extends PlanCtx {
  folded: Set<string>;            // cajas contraídas (en el móvil)
  bagDraft: Doc | null;           // el documento que se está añadiendo a la mochila
  setBagDraft(d: Doc | null, redraw?: boolean): void;
}

function box(ctx: SideCtx, id: string, title: string, right: HTMLElement | string | null, body: () => (HTMLElement | null)[], summary?: () => HTMLElement | null, ico?: string): HTMLElement {
  const folded = ctx.folded.has(id);
  const head = h("div", { cls: "ct-box-head" }, h("div", { cls: "ct-h-box", attr: { role: "heading", "aria-level": "3" } }, ico ? icon(ico, "ct-ico ct-h-ico") : null, title),
    h("span", { cls: "ct-grow" }),
    typeof right === "string" ? h("span", { cls: "ct-sub" }, right) : right,
    iconButton(folded ? "chevron-right" : "chevron-down", t(folded ? "expand" : "collapse"), () => {
      if (folded) ctx.folded.delete(id); else ctx.folded.add(id);
      ctx.rerender();
    }, "ct-ibtn ct-ibtn-sm"));
  return h("section", { cls: "ct-box" + (folded ? " is-folded" : "") }, head, folded ? summary?.() ?? null : body());
}

/* ---------- mochila ---------- */
interface BagSugg { name: string; para: string[]; where: Where; re: RegExp; person?: string }
function bagSuggestions(ctx: SideCtx): BagSugg[] {
  const tr = ctx.trip, es = t("bag") === "Mochila";
  const out: BagSugg[] = [];
  const per = (name: string, re: RegExp) => tr.travelers.length
    ? tr.travelers.map((p): BagSugg => ({ name, para: [p], where: "paper", re, person: p }))
    : [{ name, para: [], where: "paper", re } as BagSugg];
  out.push(...per(es ? "Pasaporte" : "Passport", /pasaporte|passport/));
  out.push({ name: es ? "Seguro de viaje" : "Travel insurance", para: [], where: firstWhere(ctx.s), re: /seguro|insurance/ });
  out.push(...per(es ? "DNI" : "ID card", /\bdni\b|identidad|\bid\b|id card|identity/));
  out.push({ name: es ? "Tarjeta sanitaria" : "Health card", para: [], where: "paper", re: /sanitaria|health|ehic|tse\b/ });
  /* ya está si hay un documento de ese tipo para esa persona (aunque le hayas cambiado el nombre) */
  const covered = (sg: BagSugg) => tr.mochila.some(d => {
    const n = plain(d.name);
    if (!sg.re.test(n)) return false;
    if (!sg.person) return true;
    return d.para.includes(sg.person) || n.includes(plain(sg.person)) || (!d.para.length && tr.travelers.length <= 1);
  });
  return out.filter(sg => !covered(sg)).slice(0, 4);
}
/* el documento de la mochila que se está editando (su ventanita sale en su sitio) */
let editingBag: { index: number; draft: Doc } | null = null;
export function mochila(ctx: SideCtx): HTMLElement {
  const docs = ctx.trip.mochila, paper = docs.filter(d => docWheres(d).includes("paper")).length;
  const right = paper ? t("bag.count", { n: docs.length, p: paper }) : String(docs.length);
  const sugg = bagSuggestions(ctx);
  return box(ctx, "bag", t("bag"), right, () => [
    docs.length ? h("div", { cls: "ct-docs" }, docs.map((d, i) => editingBag?.index === i && editingBag.draft === ctx.bagDraft
      ? docForm({
        s: ctx.s, travelers: ctx.trip.travelers, draft: ctx.bagDraft,
        onCancel: () => { editingBag = null; ctx.setBagDraft(null); },
        onSave: nd => {
          /* el mismo documento elegido en las reservas (por nombre y enlace) cambia con él */
          const same = (x: Doc) => x.name.trim().toLowerCase() === d.name.trim().toLowerCase() && x.url === d.url;
          for (const it of ctx.trip.days.flatMap(day => day.items)) it.docs = it.docs.map(x => same(x) ? { ...nd, also: [...nd.also], para: [...nd.para] } : x);
          docs[i] = nd; editingBag = null; ctx.setBagDraft(null, false); ctx.commit();
        },
      })
      : h("div", { cls: "ct-doc-edit-row" }, docButton(ctx, d, ctx.trip.travelers, true),
        h("span", { cls: "ct-doc-acts ct-hover" },
          iconButton("pencil", t("edit"), () => {
            const draft: Doc = { ...d, also: [...d.also], para: [...d.para] };
            editingBag = { index: i, draft };
            ctx.setBagDraft(draft);
          }, "ct-ibtn ct-ibtn-sm"),
          iconButton("x", t("remove"), () => { docs.splice(i, 1); ctx.commit(); }, "ct-ibtn ct-ibtn-sm"))))) : null,
    sugg.length ? h("div", { cls: "ct-suggest" }, label(t("bag.suggest")), h("div", { cls: "ct-row-btns" },
      sugg.map(sg => button([icon("plus"), h("span", null, sg.name), sg.person ? avatar(sg.person, Math.max(0, ctx.trip.travelers.indexOf(sg.person)), "ct-avatar ct-avatar-tag") : null],
        "ct-pill is-dashed is-small", () => ctx.setBagDraft(blankDoc(sg.where, { name: sg.name, para: [...sg.para] })))))) : null,
    ctx.bagDraft && editingBag?.draft !== ctx.bagDraft ? docForm({
      s: ctx.s, travelers: ctx.trip.travelers, draft: ctx.bagDraft,
      onCancel: () => ctx.setBagDraft(null),
      onSave: d => { ctx.trip.mochila.push(d); ctx.setBagDraft(null, false); ctx.commit(); },
    }) : button([icon("plus"), t("bag.add")], "ct-btn-ghost is-wide", () => ctx.setBagDraft(blankDoc(firstWhere(ctx.s)))),
    packing(ctx),
  ], undefined, "backpack");
}
/* la maleta, dentro de la mochila y plegable: cada cosa es una pastilla; tocarla la mete (llena) o la saca (a rayas) */
function packing(ctx: SideCtx): HTMLElement {
  const list = ctx.trip.packing, inside = list.filter(x => x.done).length, folded = ctx.folded.has("pack");
  const head = button([icon(folded ? "chevron-right" : "chevron-down"), icon("luggage"), h("span", null, t("pack")), h("span", { cls: "ct-grow" }),
    list.length ? h("span", { cls: "ct-sub" }, `${inside}/${list.length}`) : null], "ct-pack-head", () => {
    if (folded) ctx.folded.delete("pack"); else ctx.folded.add("pack");
    ctx.rerender();
  }, { "aria-expanded": String(!folded) });
  if (folded) return h("div", { cls: "ct-pack" }, head);
  const add = h("input", { cls: "ct-input ct-pack-input", attr: { type: "text", placeholder: t("pack.add") } });
  add.addEventListener("keydown", ev => {
    if (ev.key !== "Enter" || !add.value.trim()) return;
    ev.preventDefault();
    list.push({ text: add.value.trim(), done: false });
    ctx.commit();
  });
  const pill = (x: Task) => h("span", { cls: "ct-pack-item" + (x.done ? " is-in" : "") },
    button([icon(x.done ? "check" : "circle-dashed"), h("span", null, x.text)], "ct-pack-pill", () => { x.done = !x.done; ctx.commit(); },
      { "aria-pressed": String(x.done), title: x.done ? t("pack.in") : t("pack.out") }),
    iconButton("x", t("remove"), () => { list.splice(list.indexOf(x), 1); ctx.commit(); }, "ct-ibtn ct-pack-x ct-hover"));
  return h("div", { cls: "ct-pack" }, head,
    list.length ? h("div", { cls: "ct-pack-list" }, [...list.filter(x => !x.done), ...list.filter(x => x.done)].map(pill)) : null, add);
}

/* ---------- por hacer ---------- */
/* una sugerencia: se tacha sola cuando ya está hecha en el viaje (el alojamiento reservado…) */
interface Suggest { text: string; done: boolean; action?: [string, () => void] }
function todoSuggestions(ctx: SideCtx): Suggest[] {
  const tr = ctx.trip, have = new Set(tr.tasks.map(x => x.text.toLowerCase())), hidden = new Set(tr.hidden.map(x => x.toLowerCase()));
  const out: Suggest[] = [];
  const spans = lodgings(tr);
  let acc = 0;
  tr.dests.forEach(dest => {
    const first = addDays(tr.start, acc); acc += dest.nights;
    if (!dest.nights) return;
    const covered = Array.from({ length: dest.nights }, (_, i) => addDays(first, i)).some(n => spans.some(l => l.from <= n && n < l.to));
    out.push({ text: t("todo.lodging", { c: dest.city }), done: covered, action: covered ? undefined : [t("todo.addBtn"), () => {
      const di = tr.days.findIndex(d => d.date === first);
      ctx.openForm({ day: Math.max(0, di), index: -1, isNew: true, draft: newItem("lodging"), at: `lodging:${dest.city}` });
    }] });
  });
  if (tr.dests.length) {
    const cities = tr.dests.map(d => d.city);
    const list = cities.length > 1 ? cities.slice(0, -1).join(", ") + (t("bag") === "Mochila" ? " y " : " and ") + cities[cities.length - 1] : cities[0];
    out.push({ text: t("todo.maps", { c: list }), done: false, action: [t("todo.mapsBtn"), () => ctx.openUrl(mapsUrl(ctx.s.maps.app, tr.dests[0].city, tr.dests[0].country, null))] });
  }
  const firstFlight = tr.days.flatMap(d => d.items).find(i => i.kind === "flight");
  if (firstFlight) out.push({ text: t("todo.checkinOut"), done: false });
  return out.filter(s => !have.has(s.text.toLowerCase()) && !hidden.has(s.text.toLowerCase()));
}
/* una tarea tuya: el texto se edita al tocarlo y la fecha límite sale con el calendario del sistema */
function editText(ctx: SideCtx, x: Task): () => void {
  return () => void promptText(ctx.app, t("todo.edit"), "", x.text).then(v => { if (v == null || !v.trim()) return; x.text = v.trim(); ctx.commit(); });
}
function dueButton(ctx: SideCtx, x: Task): HTMLElement {
  const late = !!x.due && !x.done && x.due < todayIso(), soon = !!x.due && !x.done && x.due === todayIso();   // vence hoy: menos de 24 h
  const lab = x.due ? new Date(x.due + "T12:00").toLocaleDateString(locale(), { day: "numeric", month: "short" }) : "";
  const wrap = h("span", { cls: "ct-task-due" + (x.due ? "" : " ct-hover") + (late ? " is-late" : soon ? " is-soon" : "") });
  const pick = h("input", { attr: { type: "date", value: x.due || "", "aria-label": t("todo.due") } });
  pick.addEventListener("change", () => { if (pick.value) x.due = pick.value; else delete x.due; ctx.commit(); });
  wrap.append(icon(x.due ? "calendar" : "calendar-plus"), x.due ? h("span", null, lab) : "", pick);
  return wrap;
}
function taskRow(text: string, done: boolean, onToggle: (() => void) | null, extra: HTMLElement | null, onRemove: () => void, onEdit?: () => void): HTMLElement {
  return h("div", { cls: "ct-task" + (done ? " is-done" : "") },
    button(done ? icon("check") : null, "ct-task-check" + (done ? " is-done" : ""), onToggle || undefined,
      { role: "checkbox", "aria-checked": String(done), "aria-label": text, ...(onToggle ? {} : { disabled: "" }) }),
    h("span", { cls: "ct-task-body" }, onEdit ? button(text, "ct-task-text is-edit", onEdit) : h("span", { cls: "ct-task-text" }, text), extra),
    iconButton("x", t("remove"), onRemove, "ct-ibtn ct-task-x ct-hover"));
}
export function porHacer(ctx: SideCtx): HTMLElement {
  const tr = ctx.trip;
  const sugg = todoSuggestions(ctx);
  const open = sugg.filter(s => !s.done), auto = sugg.filter(s => s.done);
  const pending = tr.tasks.filter(x => !x.done), done = tr.tasks.filter(x => x.done);
  const total = tr.tasks.length + sugg.length, ndone = done.length + auto.length;
  const bar = h("div", { cls: "ct-progress", attr: { role: "progressbar", "aria-valuenow": String(ndone), "aria-valuemax": String(total) } }, h("span", null));
  (bar.firstChild as HTMLElement).setCssProps({ "--ct-p": total ? `${(ndone / total) * 100}%` : "0%", "--ct-accent-fill": "var(--ct-acc)" });
  const right = h("span", { cls: "ct-count" }, `${ndone}/${total}`);
  const add = h("input", { cls: "ct-input", attr: { type: "text", placeholder: t("todo.add") } });
  add.addEventListener("keydown", ev => {
    if (ev.key !== "Enter" || !add.value.trim()) return;
    ev.preventDefault();
    tr.tasks.push({ text: add.value.trim(), done: false });
    ctx.commit();
  });
  const hide = (text: string) => { tr.hidden.push(text); ctx.commit(); };
  const drop = (x: Task) => { tr.tasks.splice(tr.tasks.indexOf(x), 1); ctx.commit(); };
  const list = (rows: HTMLElement[]) => rows.length ? h("div", { cls: "ct-task-list" }, rows) : null;
  const pendingRows = [
    ...open.map(s => taskRow(s.text, false, () => { tr.tasks.push({ text: s.text, done: true }); ctx.commit(); },
      s.action ? button([h("span", null, s.action[0]), icon("arrow-right")], "ct-task-action", s.action[1]) : h("span", { cls: "ct-task-meta" }, t("todo.suggested")), () => hide(s.text))),
    ...[...pending].sort((a, b) => (a.due || "9").localeCompare(b.due || "9"))
      .map(x => taskRow(x.text, false, () => { x.done = true; ctx.commit(); }, dueButton(ctx, x), () => drop(x), editText(ctx, x))),
  ];
  const doneRows = [
    ...auto.map(s => taskRow(s.text, true, null, null, () => hide(s.text))),
    ...done.map(x => taskRow(x.text, true, () => { x.done = false; ctx.commit(); }, null, () => drop(x), editText(ctx, x))),
  ];
  const next = pendingRows.length ? (open[0]?.text || pending[0]?.text) : "";
  return box(ctx, "todo", t("todo"), right, () => [
    bar,
    pendingRows.length ? h("span", { cls: "ct-group" }, h("span", null, t("todo.pending")), h("span", null, String(pendingRows.length))) : null,
    list(pendingRows),
    doneRows.length ? h("span", { cls: "ct-group" }, h("span", null, t("todo.done")), h("span", null, String(doneRows.length))) : null,
    list(doneRows), add,
  ], () => h("div", { cls: "ct-folded" }, bar, next ? h("span", { cls: "ct-sub" }, t("todo.next", { t: next })) : null));
}

/* ---------- coste ---------- */
const CAT = (it: Item): string => isTransport(it.kind) ? "transport" : it.kind === "lodging" ? "lodging" : it.kind === "meal" ? "meals" : it.kind === "ticket" || it.kind === "place" ? "places" : "other";
export function coste(ctx: SideCtx): HTMLElement {
  const tr = ctx.trip;
  const all = tr.days.flatMap(d => d.items).filter(i => i.price), items = all.filter(i => !i.unpaid);
  const cur = tripCurrency(tr);
  const unpaid = all.filter(i => i.unpaid).reduce((a, i) => a + priceValue(i.price), 0);
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
  const rows = Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v], i) => {
    const fill = h("span", null); fill.setCssProps({ "--ct-p": total ? `${Math.max(2, (v / total) * 100)}%` : "0%", "--ct-accent-fill": destHex(i) });
    return h("div", { cls: "ct-cost-row" }, h("span", { cls: "ct-cost-line" }, h("span", null, t("cost." + k)), h("span", { cls: "ct-num" }, fmtMoney(v, cur))),
      h("span", { cls: "ct-progress is-thin" }, fill));
  });
  /* el presupuesto: se pone o se cambia con el lápiz; lo pagado se compara con él */
  const setBudget = () => {
    void promptText(ctx.app, t("cost.budget"), "1500", tr.budget ? String(tr.budget) : "").then(v => { if (v == null) return; tr.budget = Math.max(0, priceValue(v)); ctx.commit(); });
  };
  const budget = tr.budget > 0 ? (() => {
    /* blanca; roja cuando queda poco (menos del 10 %) o te has pasado */
    const fill = h("span", null), over = total > tr.budget, near = total >= tr.budget * 0.9;
    fill.setCssProps({ "--ct-p": `${Math.min(100, (total / tr.budget) * 100)}%`, "--ct-accent-fill": near ? "var(--ct-berm)" : "var(--ct-budget)" });
    return h("div", { cls: "ct-cost-row ct-cost-budget" + (near ? " is-over" : "") },
      h("span", { cls: "ct-cost-line" }, button([icon("target"), h("span", null, t("cost.budget") + " · " + fmtMoney(tr.budget, cur))], "ct-budget-btn", setBudget, { "aria-label": t("cost.budget") }),
        h("span", { cls: "ct-num" }, over ? t("cost.over", { n: fmtMoney(total - tr.budget, cur) }) : t("cost.left", { n: fmtMoney(tr.budget - total, cur) }))),
      h("span", { cls: "ct-progress" }, fill));
  })() : null;
  return box(ctx, "cost", t("cost"), null, () => [
    h("div", { cls: "ct-cost-total" }, h("span", { cls: "ct-h-total" }, fmtMoney(total, cur)), h("span", { cls: "ct-sub" }, t("cost.sub"))),
    budget || button([icon("plus"), h("span", null, t("cost.setBudget"))], "ct-pill is-dashed is-small ct-budget-add", setBudget),
    unpaid ? h("div", { cls: "ct-missing" }, icon("clock"), h("span", null, t("cost.unpaid", { n: fmtMoney(unpaid, cur) }))) : null,
    tr.travelers.length > 1 ? h("div", { cls: "ct-cost-people" }, tr.travelers.map((p, i) => h("span", { cls: "ct-cost-person" }, avatar(p, i, "ct-avatar ct-avatar-lg"),
      h("span", { cls: "ct-name-col" }, h("b", { cls: "ct-num" }, fmtMoney(per[p], cur)), h("span", { cls: "ct-sub" }, p))))) : null,
    tr.travelers.length > 1 ? h("span", { cls: "ct-sub" }, t("cost.who")) : null,
    ...rows,
    ...missing.map(m => h("div", { cls: "ct-missing" }, icon("circle-dashed"), h("span", null, t("cost.missing", { t: m })))),
  ]);
}
