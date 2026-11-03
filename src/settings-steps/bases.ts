/* Ajustes › 5 · Bases: las bases de viajes y de lugares, con sus vistas previas. */
import { Notice, TFile, normalizePath } from "obsidian";
import { h } from "../dom";
import { t } from "../i18n";
import { AUTO_FOLDERS, propKey, tripFolder } from "../settings";
import { allPlaces, catColor, iconFor, isTripFile } from "../places";
import { spanLabel } from "../dates";
import { toList } from "../md";

import type { PropNames } from "../types";
import { button, coverHex, icon } from "../ui";
import type { CoolTripSettingTab } from "../settings-tab";

/* 5 · Bases: cada base va, si no se elige otra carpeta, con las notas que organiza (la carpeta del paso 1) */
function baseFolder(tab: CoolTripSettingTab, kind: "trips" | "places") {
  const s = tab.plugin.settings;
  if (s.bases[kind]) return s.bases[kind];
  if (kind === "trips") return tripFolder(s);
  return s.autoOrganize ? AUTO_FOLDERS[s.language].places : s.places.mode === "folder" ? s.places.folder : s.placeFolder;
}

function basePath(tab: CoolTripSettingTab, kind: "trips" | "places") {
  const folder = baseFolder(tab, kind);
  return normalizePath((folder ? folder + "/" : "") + t("s5." + kind) + ".base");
}

/* la base que ya creó Cool Trip: la guardada en los ajustes (main.ts la sigue si se mueve o se borra) o, de antes, la de su sitio */
function madeBase(tab: CoolTripSettingTab, kind: "trips" | "places"): TFile | null {
  const s = tab.plugin.settings;
  for (const p of [s.basesMade[kind], basePath(tab, kind)]) {
    const f = p ? tab.app.vault.getAbstractFileByPath(p) : null;
    if (!(f instanceof TFile)) continue;
    if (s.basesMade[kind] !== f.path) { s.basesMade[kind] = f.path; tab.save(); }
    return f;
  }
  return null;
}

export function stepBases(tab: CoolTripSettingTab, body: HTMLElement) {
  const s = tab.plugin.settings, keeper = tab.plugin.keeper, env = keeper.env();
  tab.head(body, t("s5.h"), t("s5.p"));
  body.appendChild(h("div", { cls: "ct-set-promo" },
    h("span", { cls: "ct-set-promo-icon" }, icon("id-card")),
    h("span", { cls: "ct-set-card-text" }, h("b", null, t("s5.promoH")), h("span", null, t("s5.promo"))),
    /* la ficha de Cool Bases en el buscador de plugins de la comunidad de Obsidian */
    button(t("s5.promoBtn"), "ct-set-promo-btn", () => { window.open("obsidian://show-plugin?id=cool-bases"); })));
  const card = (kind: "trips" | "places") => {
    const made = madeBase(tab, kind), exists = !!made, name = t("s5." + kind);
    const open = () => { if (made) void tab.app.workspace.getLeaf("tab").openFile(made); };
    const create = async () => {
      const p = basePath(tab, kind);
      await keeper.create(kind, baseFolder(tab, kind), p);
      new Notice(t("s5.created", { p }));
      tab.display();
    };
    /* lo que se puede añadir a una base que ya existe (si después se instala Maps o Cool Bases) */
    const ups = h("div", { cls: "ct-set-base-ups" });
    if (made) void keeper.missing(kind).then(m => {
      const up = (label: string, what: { addMap?: boolean; useCool?: boolean }) => button(label, "ct-set-btn is-small", () => {
        void keeper.upgrade(kind, what).then(() => { new Notice(t("s5.updated", { p: made.path })); tab.display(); });
      });
      if (m.old) ups.append(h("span", { cls: "ct-set-base-desc" }, t("s5.oldD")), button(t("s5.rebuild"), "ct-set-btn is-small is-primary", () => {
        void keeper.rebuild(kind, name).then(() => { new Notice(t("s5.updated", { p: made.path })); tab.display(); });
      }));
      if (m.cool) ups.appendChild(up(t("s5.useCool"), { useCool: true }));
      if (m.map) ups.appendChild(up(t("s5.addMap"), { addMap: true }));
    });
    const left = h("div", { cls: "ct-set-base-main" },
      h("label", { cls: "ct-set-base-on" }, tab.check(exists, on => { if (on && !exists) void create(); }, exists ? { disabled: "" } : {}), h("b", { cls: "is-caps" }, name)),
      h("span", { cls: "ct-set-base-desc" }, t(`s5.${kind}D`)),
      made ? h("span", { cls: "ct-set-base-path" }, icon("table"), h("span", null, made.path), button(t("s5.open"), "ct-set-btn is-small", open))
        : h("div", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s5.saveIn")),
          tab.folderPicker(baseFolder(tab, kind), v => { s.bases[kind] = v; tab.save(); tab.display(); }, t("s5.saveIn") + " · " + name)),
      ups);
    return h("div", { cls: "ct-set-card ct-set-base" }, left,
      h("div", { cls: "ct-set-base-prev" }, tab.label(t(`s5.${kind}Native`)), kind === "trips" ? tripCards(tab) : placeTable(tab)),
      h("div", { cls: "ct-set-base-prev" }, tab.label(t(`s5.${kind}Cool`)), kind === "trips" ? tripTickets(tab) : placeRows(tab)));
  };
  /* el mapa es de otro plugin (Maps) y necesita internet: si no está, se explica y la vista no se crea */
  const maps = h("div", { cls: "ct-set-maps" }, h("span", { cls: "ct-set-maps-icon" }, icon("map")),
    h("span", { cls: "ct-set-card-text" }, h("b", null, t(env.maps ? "s5.mapsOn" : "s5.mapsH")), h("span", null, t(env.maps ? "s5.mapsOnD" : "s5.maps"))),
    env.maps ? null : button(t("s5.mapsBtn"), "ct-set-btn is-small", () => { window.open("obsidian://show-plugin?id=maps"); }));
  body.append(card("trips"), card("places"), maps,
    h("div", { cls: "ct-set-why" }, h("b", null, t("s5.why")), h("ul", null, h("li", null, t("s5.why1")), h("li", null, t("s5.why2")))));
}

/* los viajes y lugares del vault para las vistas previas de las bases (sin ninguno, los del viaje de ejemplo) */
function trips(tab: CoolTripSettingTab) {
  const s = tab.plugin.settings;
  const list = tab.app.vault.getMarkdownFiles().filter(f => isTripFile(tab.app, s, f)).map(f => {
    const fm: Record<string, unknown> = tab.app.metadataCache.getFileCache(f)?.frontmatter || {};
    const get = (k: keyof PropNames): unknown => fm[propKey(s, k, fm)];
    const str = (v: unknown) => typeof v === "string" ? v : "";
    return { name: f.basename, start: str(get("start")), end: str(get("end")), dests: toList(get("destinations")), travelers: toList(get("travelers")), cover: str(get("cover")) };
  }).filter(tr => tr.start).sort((a, b) => a.start.localeCompare(b.start));
  if (list.length) {
    const today = new Date().toISOString().slice(0, 10), next = list.filter(tr => (tr.end || tr.start) >= today);
    return [...next, ...list.filter(tr => !next.includes(tr)).reverse()];
  }
  const d = tab.demo();
  return [{ name: d.name, start: d.start, end: d.end, dests: d.dests.map(x => x.city), travelers: d.travelers, cover: d.cover }];
}

function places(tab: CoolTripSettingTab) {
  const list = allPlaces(tab.app, tab.plugin.settings);
  if (list.length) return list.sort((a, b) => a.city.localeCompare(b.city));
  const city = t("demo.c1"), country = t("demo.country");
  return [{ name: t("demo.p1"), city, country, category: t("demo.cat1"), price: t("demo.free"), rating: 0, visited: false },
    { name: t("demo.p2"), city, country, category: t("demo.cat2"), price: "€€", rating: 0, visited: false }];
}

/* lo que dicen las tarjetas: «Faltan 38 días», «En curso», «Hace 4 meses» (lo mismo que las fórmulas de la base) */
function when(tab: CoolTripSettingTab, start: string, end: string) {
  const day = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const until = Math.round((day(start) - today) / 864e5), since = Math.round((today - day(end || start)) / 864e5);
  if (until > 0) return { label: t(until === 1 ? "s5.left1" : "s5.left", { n: until }), pill: t(until === 1 ? "s5.in1" : "s5.in", { n: until }) };
  if (since <= 0) { const n = Math.round((today - day(start)) / 864e5) + 1, all = Math.round((day(end || start) - day(start)) / 864e5) + 1; return { label: t("s5.dayOf", { d: n, n: all }), pill: t("s5.now") }; }
  const [n, u] = since < 26 ? [since, since === 1 ? "s5.day" : "s5.days"] : since < 320 ? [Math.max(1, Math.round(since / 30.44)), "s5.months"] : [Math.max(1, Math.floor(since / 365.25)), "s5.years"];
  const unit = n === 1 ? t(u.replace(/s$/, "1")) : t(u);
  const ago = t("s5.ago", { n, u: unit });
  return { label: ago, pill: ago };
}

function nights(tab: CoolTripSettingTab, start: string, end: string) {
  const day = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
  return Math.round((day(end || start) - day(start)) / 864e5);
}

function miniTable(tab: CoolTripSettingTab, head: string[], rows: string[][]): HTMLElement {
  const cells = [...head.map(c => h("span", { cls: "is-head" }, c)), ...(rows.length ? rows : [["…", "", ""]]).slice(0, 2).flatMap(r => r.map((c, i) => h("span", { cls: i ? "" : "is-first" }, c)))];
  return h("span", { cls: "ct-set-mini-table" }, cells);
}

/* sin Cool Bases: las tarjetas de Bases, con el color del viaje (o su foto) de portada */
function tripCards(tab: CoolTripSettingTab) {
  return h("span", { cls: "ct-set-mini-cards is-2" }, trips(tab).slice(0, 2).map(tr => {
    const src = tab.plugin.coverSrc(tr.cover, "");
    return h("span", { cls: "ct-set-mini-ncard" },
      h("span", { cls: "ct-set-mini-ncard-top", attr: { style: `background: ${coverHex(tr.cover)}` } }, src ? h("img", { attr: { src, alt: "" } }) : null),
      h("span", { cls: "ct-set-mini-ncard-text" }, h("b", null, tr.name), h("strong", null, when(tab, tr.start, tr.end).label),
        h("span", null, [spanLabel(tr.start, tr.end), t("s5.nights", { n: nights(tab, tr.start, tr.end) })].join(" · "))));
  }));
}

/* con Cool Bases: el billete (vertical; en el móvil, apaisado con la matriz) */
function tripTickets(tab: CoolTripSettingTab) {
  const tk = (tr: ReturnType<typeof trips>[number]) => {
    const w = when(tab, tr.start, tr.end), n = nights(tab, tr.start, tr.end), title = tr.name.replace(/^\d{4}\s*-\s*/, "").toUpperCase();
    const yy = (tr.start || "").slice(0, 4), dates = spanLabel(tr.start, tr.end).replace(/\s*\d{4}$/, "").toUpperCase();
    return h("span", { cls: "ct-set-mini-ticket", attr: { style: `--ct-c: ${coverHex(tr.cover)}` } },
      h("span", { cls: "ct-set-mini-ticket-top" }, h("span", null, t("s5.daysN", { n: n + 1 }).toUpperCase(), h("br"), t("s5.nights", { n }).toUpperCase()), h("i", null, w.pill.toUpperCase())),
      h("b", { attr: { style: `--n: ${Math.max(4, title.length)}` } }, title), h("span", { cls: "ct-set-mini-ticket-route" }, tr.dests.join(" → ").toUpperCase()),
      h("span", { cls: "ct-set-mini-ticket-cut" }),
      h("span", { cls: "ct-set-mini-ticket-who" }, tr.travelers.slice(0, 3).map(p => h("i", null, p.toUpperCase()))),
      h("span", { cls: "ct-set-mini-ticket-dates" }, h("span", null, dates), h("b", null, yy)));
  };
  /* el apaisado del móvil: a la derecha, la matriz con «38 DÍAS», «EN CURSO» o «HACE 4 MESES» */
  const wide = (tr: ReturnType<typeof trips>[number]) => {
    const w = when(tab, tr.start, tr.end), n = nights(tab, tr.start, tr.end), title = tr.name.replace(/^\d{4}\s*-\s*/, "").toUpperCase();
    const m = /(\d+)/.exec(w.pill), num = m ? m[1] : "", [top, unit] = m ? w.pill.split(num).map(x => x.trim().toUpperCase()) : ["", ""];
    return h("span", { cls: "ct-set-mini-wticket", attr: { style: `--ct-c: ${coverHex(tr.cover)}` } },
      h("span", { cls: "ct-set-mini-wticket-main" }, h("span", { cls: "ct-set-mini-ticket-route" }, [(tr.start || "").slice(0, 4), tr.dests.join(" → ")].filter(Boolean).join(" · ").toUpperCase()),
        h("b", { attr: { style: `--n: ${Math.max(4, title.length)}` } }, title), h("span", { cls: "ct-set-mini-wticket-dates" }, [spanLabel(tr.start, tr.end), t("s5.nights", { n })].join(" · ")),
        h("span", { cls: "ct-set-mini-ticket-who" }, tr.travelers.slice(0, 3).map(p => h("i", null, p.toUpperCase())))),
      h("span", { cls: "ct-set-mini-wticket-stub" }, num ? [top && !/^(EN|IN)$/.test(top) ? h("small", null, top) : null, h("b", null, num), h("small", null, unit)] : h("i", null, w.pill.toUpperCase())));
  };
  const list = trips(tab).slice(0, 2);
  return h("span", { cls: "ct-set-mini-tickets" }, h("span", { cls: "ct-set-mini-cards is-2 is-desk" }, list.map(tk)), h("span", { cls: "ct-set-mini-wide" }, list.slice(0, 1).map(wide)));
}

/* sin Cool Bases: la tabla de la guía, por ciudad */
function placeTable(tab: CoolTripSettingTab) {
  const list = places(tab), first = list[0];
  const rows = list.filter(p => p.city === first.city).map(p => [p.name, [p.category, p.price].filter(Boolean).join(" · "), p.visited ? "☑" : "☐"]);
  return h("span", { cls: "ct-set-mini-guide" }, h("b", null, [first.city, first.country].filter(Boolean).join(" · ")),
    miniTable(tab, [t("s5.colPlace"), t("s5.colCat"), t("s5.colSeen")], rows));
}

/* con Cool Bases: las filas oscuras, con el icono de la categoría en su color */
function placeRows(tab: CoolTripSettingTab) {
  return h("span", { cls: "ct-set-mini-rows" }, places(tab).slice(0, 3).map(p => h("span", { cls: "ct-set-mini-row" },
    h("span", { cls: "ct-set-mini-row-ico", attr: { style: `background: ${catColor(p.category)}` } }, icon(iconFor(p.category))),
    h("span", { cls: "ct-set-mini-row-text" }, h("b", null, p.name), h("span", null, [p.category, p.price].filter(Boolean).join(" · "))),
    h("span", { cls: "ct-set-mini-row-check" + (p.visited ? " is-on" : "") }, p.visited ? icon("check") : null))));
}
