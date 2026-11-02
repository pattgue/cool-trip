/* Ajustes › 6 · Cool Bar: la barra de los plugins Cool. */
import { h } from "../dom";
import { t } from "../i18n";
import { KIT_VERSION, devicePrefs, registry, saveBarSettings, sortedTools } from "../cool-kit/kit";
import type { BarAlign, BarLocation, BarMode, Device, ToolVisibility } from "../cool-kit/kit";
import { kt } from "../cool-kit/i18n";
import { button, icon } from "../ui";
import type { CoolTripSettingTab } from "../settings-tab";

/* 6 · Cool Bar: los ajustes compartidos del Cool Kit (los mismos datos que en los demás plugins Cool) */
export function stepBar(tab: CoolTripSettingTab, body: HTMLElement) {
  tab.head(body, t("s6.h"), t("s6.p"));
  const p = devicePrefs(tab.barDevice), tools = sortedTools(p);
  const save = () => { void saveBarSettings(); tab.display(); };
  /* cómo queda la barra con los plugins Cool que tienes y estas opciones (con sus clases de verdad) */
  const bar = h("div", { cls: "cool-bar ct-set-bar" + (p.collapsed ? " is-collapsed" : ""), attr: { "data-ck": String(KIT_VERSION), "data-align": p.align, role: "img", "aria-label": t("s6.preview") } },
    h("span", { cls: "cool-fold" }, icon(p.collapsed ? "chevron-down" : "chevron-up")),
    p.collapsed ? null : h("div", { cls: "cool-tools" }, tools.filter(tl => (p.tools[tl.id]?.visibility || "always") !== "never").map(tl =>
      h("span", { cls: "cool-tool", attr: { "data-state": "available" } }, tl.label()))));
  const tabs = h("div", { cls: "ct-set-tabs", attr: { role: "tablist", "aria-label": kt("s.device") } }, (["desktop", "phone"] as Device[]).map(d =>
    button(kt("s." + d), "ct-set-tab" + (d === tab.barDevice ? " is-on" : ""), () => { tab.barDevice = d; tab.display(); }, { role: "tab", "aria-selected": String(d === tab.barDevice) })));
  const row = (name: string, desc: string | null, control: HTMLElement, cls = "") => h("div", { cls: "ct-set-row " + cls },
    h("span", { cls: "ct-set-row-text" }, h("b", null, name), desc ? h("span", null, desc) : null), control);
  const barCard = h("div", { cls: "ct-set-card ct-set-rows" },
    h("div", { cls: "ct-set-row is-head" }, h("b", null, t("s6.bar")), tabs),
    row(kt("s.location"), null, tab.select([["top", kt("s.top")], ["bottom", kt("s.bottom")], ["float", kt("s.float")]], p.location, v => { p.location = v as BarLocation; save(); }, kt("s.location"))),
    row(kt("s.align"), null, tab.select([["right", kt("s.right")], ["center", kt("s.center")], ["left", kt("s.left")]], p.align, v => { p.align = v as BarAlign; save(); }, kt("s.align"))),
    row(kt("s.mode"), t("s6.modeD"), tab.select([["fixed", kt("s.fixed")], ["context", kt("s.context")], ["hidden", kt("s.hidden")]], p.mode, v => { p.mode = v as BarMode; registry().toggled = false; save(); }, kt("s.mode"))),
    row(kt("s.collapsed"), kt("s.collapsedDesc"), tab.check(p.collapsed, v => { p.collapsed = v; save(); }, { "aria-label": kt("s.collapsed") }), "is-check"));
  const move = (i: number, by: number) => {
    const ids = tools.map(x => x.id);
    [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
    ids.forEach((id, k) => { (p.tools[id] ??= {}).order = k * 10; });
    save();
  };
  const arrow = (name: string, label: string, disabled: boolean, go: () => void) => {
    const b = button(icon(name), "ct-set-arrow", go, { "aria-label": label });
    b.disabled = disabled;
    return b;
  };
  const btnCard = h("div", { cls: "ct-set-card ct-set-rows" },
    h("div", { cls: "ct-set-row is-head" }, h("span", { cls: "ct-set-row-text" }, h("b", null, kt("s.buttons")), h("span", null, t("s6.buttonsD")))),
    tools.map((tl, i) => h("div", { cls: "ct-set-row is-tool" },
      h("span", { cls: "ct-set-tool-chip" }, tl.label()),
      h("span", { cls: "ct-set-tool-ctl" },
        tab.select([["always", kt("s.always")], ["applies", kt("s.applies")], ["never", kt("s.never")]], p.tools[tl.id]?.visibility || "always",
          v => { (p.tools[tl.id] ??= {}).visibility = v as ToolVisibility; save(); }, tl.label()),
        arrow("arrow-up", kt("s.up"), i === 0, () => move(i, -1)), arrow("arrow-down", kt("s.down"), i === tools.length - 1, () => move(i, 1))))));
  body.append(h("div", { cls: "ct-set-bar-block" }, tab.label(t("s6.preview")), h("div", { cls: "ct-set-bar-frame" }, bar)),
    h("div", { cls: "ct-set-grid is-bar" }, barCard, btnCard));
}
