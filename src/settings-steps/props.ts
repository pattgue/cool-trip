/* Ajustes › 2 · Propiedades: qué propiedad de tus notas guarda cada dato. */
import { h } from "../dom";
import { t } from "../i18n";
import { propKey, suggestedProps } from "../settings";
import { isPlaceFile, isTripFile, readLoc } from "../places";
import { promptText } from "../prompt";
import { toIso } from "../md";
import type { PropNames } from "../types";
import { icon } from "../ui";
import type { CoolTripSettingTab } from "../settings-tab";

/* 2 · Propiedades */
export function stepProps(tab: CoolTripSettingTab, body: HTMLElement) {
  const s = tab.plugin.settings, used = tab.vaultProps(), sug = suggestedProps(s.language);
  tab.head(body, t("s2.h"), t("s2.p"));
  const TYPE_ICON: Record<string, string> = { date: "calendar", list: "list", text: "type", number: "hash", checkbox: "square-check" };
  const req = h("p", { cls: "ct-set-req" }, h("span", { cls: "ct-req" }, "*"), " ", t("s2.req"));
  const OTHER = "\u0000other", NONE = "\u0000none";
  /* los tipos de Obsidian que sirven para cada dato (una propiedad sin tipo asignado sirve para todo) */
  const FITS: Record<string, string[]> = { date: ["date", "datetime"], list: ["multitext", "tags", "aliases", "text"], text: ["text", "multitext", "number"],
    number: ["number", "text"], checkbox: ["checkbox"] };
  const fits = (p: string, type: string) => { const ty = tab.propType(p); return !ty || (FITS[type] || []).includes(ty); };
  /* un valor que Cool Trip no sabe leer (una fecha como «2 nov», unas coordenadas sin números): el primero que encuentre */
  const PLACE_KEYS: (keyof PropNames)[] = ["location", "city", "category", "price", "rating", "visited", "photo"];
  const unreadable = (k: keyof PropNames): string => {
    const read = k === "start" || k === "end" ? (v: unknown) => !!toIso(v) : k === "location" ? (v: unknown) => !!readLoc(v) : null;
    if (!read || !s.props[k]) return "";
    const isMine = PLACE_KEYS.includes(k) ? isPlaceFile : isTripFile;
    for (const f of tab.app.vault.getMarkdownFiles()) {
      if (!isMine(tab.app, s, f)) continue;
      const fm = tab.app.metadataCache.getFileCache(f)?.frontmatter;
      const v: unknown = fm?.[propKey(s, k, fm)];
      const txt = (x: unknown) => typeof x === "string" || typeof x === "number" || typeof x === "boolean" ? String(x) : "";
      if (v != null && v !== "" && !read(v)) return Array.isArray(v) ? v.map(txt).join(", ") : txt(v);
    }
    return "";
  };
  const row = (k: keyof PropNames, type: string, need: boolean) => {
    const val = s.props[k], isUsed = !!val && used.has(val);
    const others = [...used].filter(p => p !== sug[k] && fits(p, type)).sort((a, b) => a.localeCompare(b));
    const opts: [string, string][] = [[sug[k], t("s2.suggested", { p: sug[k] })], ...others.map(p => [p, p] as [string, string])];
    if (val && !opts.some(([v]) => v === val)) opts.push([val, val]);
    if (!need) opts.push([NONE, t("s2.none")]);
    opts.push([OTHER, t("s2.other")]);
    const sel = tab.select(opts, val || NONE, v => {
      if (v === NONE) { s.props[k] = ""; tab.save(); tab.display(); return; }
      if (v !== OTHER) { s.props[k] = v; tab.save(); tab.display(); return; }
      void promptText(tab.app, t("p." + k), sug[k], val).then(name => {
        if (name?.trim()) { s.props[k] = name.trim(); tab.save(); }
        tab.display();
      });
    }, t("s2.yours") + " · " + t("p." + k));
    const odd = !!val && isUsed && !fits(val, type), bad = val && isUsed ? unreadable(k) : "";
    const state = !val ? ["", t("s2.unused")] : bad ? ["is-warn", t("s2.bad")] : odd ? ["is-warn", t("s2.odd")] : isUsed ? ["is-used", t("s2.used")] : ["", t("s2.new")];
    const st = h("span", { cls: "ct-set-state " + state[0] + (val ? "" : " is-off") }, state[1]);
    if (bad) st.setAttr("aria-label", t("s2.badD", { v: bad, e: k === "location" ? "41.39, 2.17" : "2026-11-02" }));
    else if (odd) st.setAttr("aria-label", t("s2.oddD", { t: t("t." + type) }));
    return h("div", { cls: "ct-set-prop" },
      h("span", { cls: "ct-set-prop-name" }, t("p." + k), need ? h("span", { cls: "ct-req", attr: { "aria-label": t("s2.reqShort") } }, "*") : null),
      h("span", { cls: "ct-set-prop-desc" }, t(`p.${k}D`)),
      h("span", { cls: "ct-set-type" }, icon(TYPE_ICON[type]), t("t." + type)),
      h("span", { cls: "ct-set-prop-in" }, sel), st);
  };
  const group = (title: string, ico: string) => h("div", { cls: "ct-set-group" }, icon(ico), title);
  body.append(req, h("div", { cls: "ct-set-table" },
    h("div", { cls: "ct-set-thead" }, h("span", null, t("s2.data")), h("span", null, t("s2.type")), h("span", null, t("s2.yours")), h("span", null, t("s2.state"))),
    group(t("s2.trip"), "plane"), row("start", "date", true), row("end", "date", true), row("destinations", "list", true), row("travelers", "list", false), row("cover", "text", false),
    group(t("s2.place"), "map-pin"), row("location", "list", true), row("city", "text", true), row("category", "text", false),
    row("price", "text", false), row("rating", "number", false), row("visited", "checkbox", false), row("photo", "text", false)));
}
