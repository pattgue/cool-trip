/* Ajustes › 1 · Tus notas: cómo se reconocen los viajes y los lugares, y dónde se guardan. */
import { h } from "../dom";
import { t } from "../i18n";
import { AUTO_FOLDERS } from "../settings";
import type { Recog, RecogMode } from "../types";
import { button, icon } from "../ui";
import type { CoolTripSettingTab } from "../settings-tab";

/* 1 · Tus notas */
export function stepNotes(tab: CoolTripSettingTab, body: HTMLElement) {
  const s = tab.plugin.settings;
  tab.head(body, t("s1.h"), t("s1.p"));
  const block = (title: string, desc: string, iconName: string, r: Recog, kind: string, tagPh: string, folder: () => string, setFolder: (v: string) => void) => {
    const modes: [RecogMode, string][] = [["property", t("s1.property")], ["tag", t("s1.tag")], ["folder", t("s1.folder")]];
    const radios = h("div", { cls: "ct-set-radios", attr: { role: "radiogroup", "aria-label": title } }, modes.map(([m, l]) => {
      const rb = h("input", { cls: "ct-radio", attr: { type: "radio", name: "ct-recog-" + kind } });
      rb.checked = r.mode === m;
      rb.addEventListener("change", () => { r.mode = m; tab.save(); tab.display(); });
      return h("label", null, rb, l);
    }));
    let how: HTMLElement;
    if (r.mode === "property") {
      const key = tab.text(r.key, v => { r.key = v; tab.save(); }, { placeholder: "tipo", "aria-label": t("s1.property") });
      key.classList.add("is-key");
      how = h("div", { cls: "ct-set-how" }, key, h("span", { cls: "ct-eq" }, "="), tab.text(r.value, v => { r.value = v; tab.save(); }, { placeholder: kind, "aria-label": kind }));
    } else if (r.mode === "tag") how = h("div", { cls: "ct-set-how" }, tab.text(r.value ? "#" + r.value.replace(/^#/, "") : "", v => { r.value = v.replace(/^#/, ""); tab.save(); }, { placeholder: tagPh, "aria-label": t("s1.tag") }));
    else how = h("span", { cls: "ct-sub" }, t("s1.folderHint", { k: kind }));
    /* con «Carpeta», el desplegable de abajo elige esa carpeta (y ahí se guardan los nuevos) */
    const inFolder = r.mode === "folder";
    const pick = s.autoOrganize ? h("span", { cls: "ct-set-auto" }, icon("smile"), folder())
      : tab.folderPicker(inFolder ? r.folder : folder(), v => { if (inFolder) r.folder = v; setFolder(v); tab.save(); tab.display(); }, title);
    return [
      h("div", { cls: "ct-set-card ct-set-recog" },
        h("div", { cls: "ct-set-card-top" }, h("span", { cls: "ct-set-icon" }, icon(iconName)),
          h("span", { cls: "ct-set-card-text" }, h("b", { cls: "is-caps" }, title), h("span", null, tab.lines(desc)))),
        h("div", { cls: "ct-set-recog-how" }, radios, how)),
      h("div", { cls: "ct-f ct-set-save" }, h("span", { cls: "ct-label" }, inFolder && !s.autoOrganize ? t("s1.folderLbl") : t("s1.saveIn")), pick),
    ];
  };
  body.append(...block(t("s1.trips"), t("s1.tripsD"), "plane", s.trips, t("s1.trip"), t("s1.tripTag"),
    () => s.autoOrganize ? AUTO_FOLDERS[s.language].trips : s.tripFolder, v => { s.tripFolder = v; }));
  body.append(...block(t("s1.places"), t("s1.placesD"), "map-pin", s.places, t("s1.place"), t("s1.placeTag"),
    () => s.autoOrganize ? AUTO_FOLDERS[s.language].places + "/…" : s.placeFolder, v => { s.placeFolder = v; }));
  body.appendChild(h("div", { cls: "ct-set-autoorg" },
    tree(tab),
    h("div", { cls: "ct-set-autoorg-side" },
      h("b", { cls: "ct-set-autoorg-title" }, t("s1.auto"), h("span", { cls: "ct-sub" }, " · " + t("s1.optional"))),
      h("p", { cls: "ct-set-autoorg-text ct-if-l" }, h("b", null, t("s1.autoB")), h("br"), h("br"), t("s1.autoD")),
      h("p", { cls: "ct-set-autoorg-text ct-if-ms" }, h("b", null, t("s1.autoB")), " ", t("s1.autoDShort")),
      button([icon(s.autoOrganize ? "check" : "smile"), h("span", null, s.autoOrganize ? t("s1.usingAuto") : t("s1.useAuto"))], "ct-set-btn ct-set-autoorg-btn" + (s.autoOrganize ? " is-on" : ""),
        () => { s.autoOrganize = !s.autoOrganize; tab.save(); tab.display(); }))));
  /* las notas de lugar con el diseño de Cool Trip (opcional) */
  body.appendChild(h("label", { cls: "ct-set-card is-check" + (s.placeView ? " is-on" : "") }, tab.check(s.placeView, v => { s.placeView = v; tab.save(); tab.display(); tab.plugin.syncLeaves(); }),
    h("span", { cls: "ct-set-card-text" }, h("span", { cls: "ct-set-opt-title" }, h("b", null, t("pl.view"))), h("span", null, t("pl.viewD")))));
  /* la maleta: grupos y listas típicas (opcionales) */
  const P = s.pack, redraw = () => { tab.save(); tab.display(); tab.plugin.redrawTrips(); };
  body.appendChild(h("label", { cls: "ct-set-card is-check" + (P.groups ? " is-on" : "") }, tab.check(P.groups, v => { P.groups = v; redraw(); }),
    h("span", { cls: "ct-set-card-text" }, h("span", { cls: "ct-set-opt-title" }, h("b", null, t("pk.groups"))), h("span", null, t("pk.groupsD")))));
  body.appendChild(h("label", { cls: "ct-set-card is-check" + (P.lists ? " is-on" : "") }, tab.check(P.lists, v => { P.lists = v; redraw(); }),
    h("span", { cls: "ct-set-card-text" }, h("span", { cls: "ct-set-opt-title" }, h("b", null, t("pk.lists"))), h("span", null, t("pk.listsD")),
      P.lists ? h("div", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("pk.folder")),
        tab.folderPicker(P.folder, v => { P.folder = v; tab.save(); tab.display(); }, t("pk.folder"))) : null)));
}

/* el explorador de archivos con la organización automática (el ejemplo del boceto) */
function tree(tab: CoolTripSettingTab): HTMLElement {
  const F = AUTO_FOLDERS[tab.plugin.settings.language];
  type R = [number, "open" | "closed" | null, string, string, boolean?];
  const rows: R[] = [[0, "open", "folder", F.trips], [1, null, "file", t("tree.t1")], [1, null, "file", t("tree.t2")], [1, null, "table", F.trips, true],
    [0, "open", "folder", F.places], [1, "open", "folder", t("tree.c1")], [2, null, "file", t("tree.p1")], [2, null, "file", t("tree.p2")],
    [1, "closed", "folder", t("tree.c2")], [1, null, "table", F.places, true]];
  return h("div", { cls: "ct-set-tree", attr: { role: "img", "aria-label": t("s1.preview") } }, rows.map(([d, fold, ico, name, base]) =>
    h("span", { cls: "ct-set-tree-row" + (d ? " is-in" : "") + (d === 2 ? " is-deep" : ""), attr: { style: `--d: ${d}` } },
      fold ? icon(fold === "open" ? "chevron-down" : "chevron-right", "ct-ico ct-set-tree-fold") : null,
      icon(ico, "ct-ico" + (ico === "folder" ? " is-folder" : "")), name, base ? h("span", { cls: "ct-set-tree-tag" }, "BASE") : null)));
}
