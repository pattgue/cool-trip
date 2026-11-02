/* Ajustes › 7 · Listo: cómo queda tu vault. */
import { h } from "../dom";
import { t } from "../i18n";
import { KIT_VERSION } from "../cool-kit/kit";
import { serializeTrip } from "../md";
import { ticket } from "../ticket";

import { coverHex, icon } from "../ui";
import type { CoolTripSettingTab } from "../settings-tab";

/* 7 · Listo */
export function stepReady(tab: CoolTripSettingTab, body: HTMLElement) {
  tab.head(body, t("s7.h"), t("s7.p"));
  const tr = tab.demo();
  /* lo que se guarda: el Markdown de verdad del viaje de ejemplo (sin las secciones y días vacíos ni la marca del final) */
  const md = serializeTrip(tr, tab.plugin.settings).split("\n");
  const level = (l: string) => /^(#{2,3}) /.exec(l)?.[1].length ?? 0;
  const hasContent = (i: number) => {
    for (let j = i + 1; j < md.length; j++) { const lj = level(md[j]); if (lj && lj <= level(md[i])) return false; if (!lj && md[j].trim() && !md[j].startsWith("%%")) return true; }
    return false;
  };
  const lines: HTMLElement[] = [];
  let fm = 0;
  for (let i = 0; i < md.length && lines.length < 24; i++) {
    const l = md[i];
    if (l === "---") fm++;
    if (!l.trim() || l.startsWith("%%") || (level(l) && !hasContent(i))) continue;
    const cls = fm < 2 || l === "---" || l.startsWith(">") ? "is-fm" : level(l) === 2 ? "is-h2" : level(l) === 3 ? "is-h3" : "";
    lines.push(h("span", { cls }, l.split(/(\[\[[^\]]+\]\])/).map(x => x.startsWith("[[") ? h("span", { cls: "is-link" }, x) : x)));
  }
  const tk = (phone: boolean) => ticket({ mode: "note", phone, trip: tr, path: "", locked: true, changed: () => {}, prompt: () => Promise.resolve(null), promptDest: () => Promise.resolve(null), coverSrc: () => null });
  body.appendChild(h("div", { cls: "ct-set-how-it" },
    h("div", { cls: "ct-set-card ct-set-md" }, tab.label(t("s7.saved")), h("span", { cls: "ct-set-md-lines" }, lines)),
    h("span", { cls: "ct-set-how-arrow", attr: { "aria-hidden": "true" } }, icon("arrow-down")),
    h("div", { cls: "ct-set-sees" }, tab.label(t("s7.sees")), tab.real("ct-set-real-ticket", [tk(false), 1000], [tk(true), 360], coverHex(tr.cover)))));
  const bar = h("span", { cls: "cool-bar ct-set-mini-bar", attr: { "data-ck": String(KIT_VERSION), "data-align": "right" } }, h("span", { cls: "cool-fold" }, icon("chevron-up")),
    h("span", { cls: "cool-tools" }, h("span", { cls: "cool-tool", attr: { "data-state": "available" } }, "Cool Trip")));
  const form = h("span", { cls: "ct-set-mini-form" }, h("span", null, "09:00"), h("span", { cls: "is-grow" }, icon("map-pin"), h("span", null, t("demo.p1"))), h("span", { cls: "is-add" }, t("s7.add")));
  const chips = h("span", { cls: "ct-set-mini-chips" }, ([["calendar", "s7.chipPlan"], ["ticket", "s7.chipBook"], ["file-text", "s7.chipDocs"]] as const).map(([i, k]) => h("span", null, icon(i), t(k))));
  const step = (n: number, visual: HTMLElement) => h("div", { cls: "ct-set-card ct-set-howstep" },
    h("span", { cls: "ct-set-num is-current" }, String(n)),
    h("span", { cls: "ct-set-howstep-text" }, h("b", null, t(`s7.${n}`)), h("span", { cls: "ct-set-howstep-visual" }, visual), h("span", { cls: "ct-set-howstep-desc" }, t(`s7.${n}d`))));
  const list = (title: string, keys: string[], ico: string, cls: string) => h("div", { cls: "ct-set-ul " + cls }, h("b", null, title),
    keys.map(k => h("span", null, icon(ico), t(k))));
  body.append(h("div", { cls: "ct-set-grid is-3 is-steps" }, step(1, bar), step(2, form), step(3, chips)),
    h("div", { cls: "ct-set-grid is-lists" }, list(t("s7.adds"), ["s7.adds1", "s7.adds2", "s7.adds3"], "check", "is-adds"), list(t("s7.keeps"), ["s7.keeps1", "s7.keeps2", "s7.keeps3"], "minus", "is-keeps")));
}
