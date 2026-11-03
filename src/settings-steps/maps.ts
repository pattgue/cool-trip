/* Ajustes › 4 · Mapas: la app de mapas, cómo te mueves y las coordenadas. */
import { Notice } from "obsidian";
import { h } from "../dom";
import { t } from "../i18n";
import { locateAll, unlocated } from "../geo";
import type { MapsApp } from "../types";
import { button } from "../ui";
import type { CoolTripSettingTab } from "../settings-tab";

/* 4 · Mapas */
export function stepMaps(tab: CoolTripSettingTab, body: HTMLElement) {
  const m = tab.plugin.settings.maps;
  tab.head(body, t("s4.h"), t("s4.p"));
  const app = (k: MapsApp) => {
    const rb = h("input", { cls: "ct-radio", attr: { type: "radio", name: "ct-maps-app" } });
    rb.checked = m.app === k;
    rb.addEventListener("change", () => { m.app = k; tab.save(); tab.display(); });
    return h("label", { cls: "ct-set-card is-radio" + (m.app === k ? " is-on" : "") },
      h("span", { cls: "ct-set-radio-title" }, rb, h("b", null, t("s4." + k))),
      h("span", { cls: "ct-set-radio-desc" }, t(`s4.${k}D`)),
      h("span", { cls: "ct-set-radio-note" }, t(`s4.${k}O`)));
  };
  const mode = (k: string) => h("label", { cls: "ct-set-chip" }, tab.check(m.modes.includes(k), on => {
    m.modes = on ? [...m.modes.filter(x => x !== k), k] : m.modes.filter(x => x !== k); tab.save();
  }), t("m." + k));
  body.append(h("div", { cls: "ct-set-grid is-3", attr: { role: "radiogroup", "aria-label": t("s4.h") } }, app("google"), app("apple"), app("organic")),
    h("div", { cls: "ct-set-modes" },
      h("b", { cls: "ct-set-subhead" }, t("s4.modes"), h("span", { cls: "ct-sub" }, " · " + t("s4.modesHint"))),
      h("div", { cls: "ct-set-chips" }, ["walk", "transit", "car", "bike", "taxi"].map(mode))));
  /* las coordenadas de los lugares, solas (OpenStreetMap) */
  const missing = unlocated(tab.app, tab.plugin.settings).length;
  const find = missing && m.geocode ? button(t("s4.geoBtn", { n: String(missing) }), "ct-set-btn", () => {
    if (!find) return;
    find.disabled = true;
    void locateAll(tab.app, tab.plugin.settings, (d, n) => { find.setText(t("s4.geoRun", { d: String(d), n: String(n) })); })
      .then(found => { new Notice(t("s4.geoDone", { n: String(found) })); tab.display(); });
  }) : null;
  body.append(h("label", { cls: "ct-set-card is-check" + (m.geocode ? " is-on" : "") }, tab.check(m.geocode, v => { m.geocode = v; tab.save(); tab.display(); }),
    h("span", { cls: "ct-set-card-text" }, h("span", { cls: "ct-set-opt-title" }, h("b", null, t("s4.geo"))), h("span", null, t("s4.geoD")), find)));
}
