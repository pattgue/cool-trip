/* La nota de un lugar pintada (como la del viaje): un TextFileView sobre su .md. Las secciones se escriben en el cuerpo;
   las propiedades (categoría, ciudad, precio, coordenadas, portada, estrellas, visitado), en el frontmatter, solo cuando las tocas. */
import { FuzzySuggestModal, Notice, Platform, TextFileView } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t, locale } from "./i18n";
import { spanLabel } from "./dates";
import { toIso, toList } from "./md";
import { allPlaces, isPlaceFile, isTripFile, mapsUrl, placeInfo, readLoc } from "./places";
import type { PlaceInfo } from "./places";
import { locate } from "./geo";
import { parsePlace, placePage, serializePlace, setSection } from "./place-page";
import type { PlaceDoc, PlaceProp } from "./place-page";
import { promptText } from "./prompt";
import { propKey } from "./settings";
import { button } from "./ui";

export const PLACE_VIEW = "cool-trip-place";

export class PlaceView extends TextFileView {
  doc: PlaceDoc | null = null;
  editing: string | null = null;
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
  /* una propiedad: se guarda antes lo pendiente del cuerpo, y Obsidian vuelve a pintar la nota al cambiar.
     Vacía (o 0, o «no visitado» sin haberlo marcado nunca): se quita, si estaba; nunca se escribe vacía. */
  private async setProp(k: PlaceProp, v: string | number | boolean) {
    const f = this.file, s = this.plugin.settings;
    if (!f || !s.props[k]) return;
    await this.save();
    let val: unknown = v;
    if (k === "location" && typeof v === "string") { const loc = readLoc(v); val = loc ? loc.map(String) : ""; }
    await this.app.fileManager.processFrontMatter(f, (m: Record<string, unknown>) => {
      const key = propKey(s, k, m);
      if (val === "" || val === 0 || (val === false && !(key in m))) delete m[key]; else m[key] = val;
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
    const p = placeInfo(this.app, s, f), doc = this.doc;
    const fm = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
    const rawCover: unknown = fm[propKey(s, "photo", fm)];
    const cover = typeof rawCover === "string" ? rawCover : p.photo;
    const trips = this.app.vault.getMarkdownFiles().filter(x => isTripFile(this.app, s, x) && this.app.metadataCache.resolvedLinks[x.path]?.[f.path])
      .map(x => {
        const tfm = this.app.metadataCache.getFileCache(x)?.frontmatter || {};
        const a = toIso(tfm[propKey(s, "start", tfm)]), b = toIso(tfm[propKey(s, "end", tfm)]) || a;
        return { name: x.basename, dates: a ? spanLabel(a, b) : toList(tfm[propKey(s, "destinations", tfm)]).join(" → "), open: () => void this.app.workspace.getLeaf().openFile(x) };
      });
    const places = () => allPlaces(this.app, s).filter(x => x.file !== f);
    el.appendChild(h("div", { cls: "ct-page" }, placePage({
      place: p, doc, phone, lang: locale(), cover,
      photo: cover ? this.plugin.coverSrc(cover, f.path) : null,
      trips, mapsUrl: mapsUrl(s.maps.app, p.name, p.city, p.loc), editing: this.editing,
      today: (new Date().getDay() + 6) % 7,
      openUrl: url => window.open(url),
      openLink: name => void this.app.workspace.openLinkText(name, f.path, false),
      edit: id => { this.editing = id; this.render(); },
      setLines: (k, lines, keep) => { setSection(doc, k, lines, s.language, keep); this.editing = null; this.commit(); },
      setProp: (k, v) => void this.setProp(k, v),
      ask: (title, ph, value) => promptText(this.app, title, ph, value),
      pickPlace: () => new Promise(res => new PlacePicker(this.app, places(), res).open()),
      lookup: name => {
        const x = allPlaces(this.app, s).find(y => y.name === name);
        return x ? { category: x.category, photo: x.photo ? this.plugin.coverSrc(x.photo, x.file.path) : null } : null;
      },
      locate: () => void locate(this.app, s, f, p.name, p.city, p.country).then(ok => { if (!ok) new Notice(t("pl.notFound")); }),
    })));
  }
}

/* elegir una nota de lugar (para el «Top» de un barrio) */
class PlacePicker extends FuzzySuggestModal<PlaceInfo> {
  private picked = false;
  constructor(app: App, private list: PlaceInfo[], private done: (name: string | null) => void) { super(app); this.setPlaceholder(t("pl.addPlace")); }
  getItems() { return this.list; }
  getItemText(p: PlaceInfo) { return [p.name, p.category, p.city].filter(Boolean).join(" · "); }
  onChooseItem(p: PlaceInfo) { this.picked = true; this.done(p.name); }
  onClose() { window.setTimeout(() => { if (!this.picked) this.done(null); }, 0); }
}
