/* La nota de un lugar pintada (como la del viaje): un TextFileView sobre su .md. Las secciones se escriben en el cuerpo;
   las estrellas, «visitado» y el precio, en sus propiedades (solo cuando las tocas). */
import { Platform, TextFileView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t, locale } from "./i18n";
import { spanLabel } from "./dates";
import { toIso, toList } from "./md";
import { isPlaceFile, isTripFile, mapsUrl, placeInfo } from "./places";
import { parsePlace, placePage, serializePlace, setSection } from "./place-page";
import type { PlaceDoc, SecKey } from "./place-page";
import { promptText } from "./prompt";
import { propKey } from "./settings";
import { button } from "./ui";

export const PLACE_VIEW = "cool-trip-place";

export class PlaceView extends TextFileView {
  doc: PlaceDoc | null = null;
  editing: SecKey | null = null;
  constructor(leaf: WorkspaceLeaf, private plugin: CoolTripPlugin) { super(leaf); }
  getViewType() { return PLACE_VIEW; }
  getDisplayText() { return this.file?.basename ?? "Cool Trip"; }
  getIcon() { return "map-pin"; }
  canAcceptExtension(ext: string) { return ext === "md"; }
  setViewData(data: string, clear: boolean) {
    this.data = data;
    if (clear) this.editing = null;
    this.doc = parsePlace(data);
    this.render();
  }
  getViewData() { return this.data; }
  async onOpen() {
    /* al cambiar sus propiedades (estrellas, visitado, precio…), la nota se vuelve a leer */
    this.registerEvent(this.app.metadataCache.on("changed", f => {
      if (f !== this.file || this.editing) return;
      void this.app.vault.read(f).then(d => { if (d !== this.data) this.setViewData(d, false); else this.render(); });
    }));
  }
  clear() { this.doc = null; this.contentEl.empty(); }

  private commit() {
    if (!this.doc) return;
    this.data = serializePlace(this.doc);
    void this.save();                     // enseguida: así las propiedades que se toquen después leen la nota ya guardada
    this.render();
  }
  /* una propiedad: se guarda antes lo pendiente del cuerpo, y Obsidian vuelve a pintar la nota al cambiar */
  private async setProp(k: "rating" | "visited" | "price", v: unknown) {
    const f = this.file, s = this.plugin.settings;
    if (!f || !s.props[k]) return;
    await this.save();
    await this.app.fileManager.processFrontMatter(f, (m: Record<string, unknown>) => {
      const key = propKey(s, k, m);
      if (v === "" || v === 0 || (v === false && !(key in m))) delete m[key]; else m[key] = v;
    });
  }

  render() {
    const el = this.contentEl, f = this.file, s = this.plugin.settings;
    el.empty();
    el.addClass("ct-root", "ct-view");
    const phone = Platform.isPhone || (el.clientWidth > 0 && el.clientWidth < 760);
    el.toggleClass("is-phone", phone);
    if (!f || !this.doc) return;
    if (!isPlaceFile(this.app, s, f)) {
      el.appendChild(h("div", { cls: "ct-empty" }, h("p", null, t("notTrip")), button(t("cmd.toggle"), "ct-btn-ghost", () => void this.plugin.toggleLeaf(this.leaf))));
      return;
    }
    const p = placeInfo(this.app, s, f);
    const fmCover = this.app.metadataCache.getFileCache(f)?.frontmatter?.[s.props.photo] as unknown;
    const trips = this.app.vault.getMarkdownFiles().filter(x => isTripFile(this.app, s, x) && this.app.metadataCache.resolvedLinks[x.path]?.[f.path])
      .map(x => {
        const fm = this.app.metadataCache.getFileCache(x)?.frontmatter || {};
        const a = toIso(fm[propKey(s, "start", fm)]), b = toIso(fm[propKey(s, "end", fm)]) || a;
        return { name: x.basename, dates: a ? spanLabel(a, b) : toList(fm[propKey(s, "destinations", fm)]).join(" → "), open: () => void this.app.workspace.getLeaf().openFile(x) };
      });
    el.appendChild(h("div", { cls: "ct-page" }, placePage({
      place: p, doc: this.doc, phone, lang: locale(),
      photo: p.photo ? this.plugin.coverSrc(typeof fmCover === "string" ? fmCover : p.photo, f.path) : null,
      trips, mapsUrl: mapsUrl(s.maps.app, p.name, p.city, p.loc), editing: this.editing,
      openUrl: url => window.open(url),
      edit: k => { this.editing = k; this.render(); },
      saveSection: (k, text) => { if (!this.doc) return; setSection(this.doc, k, text, s.language); this.editing = null; this.commit(); },
      setRating: n => void this.setProp("rating", n),
      setVisited: on => void this.setProp("visited", on),
      setPrice: () => void promptText(this.app, t("f.price"), "€€", p.price).then(v => { if (v != null) void this.setProp("price", v.trim()); }),
    })));
  }
}
