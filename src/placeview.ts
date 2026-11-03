/* La nota de un lugar pintada (como la del viaje): un TextFileView sobre su .md. Las secciones se escriben en el cuerpo;
   las propiedades (categoría, ciudad, precio, coordenadas, portada, estrellas, visitado), en el frontmatter, solo cuando las tocas. */
import { FuzzySuggestModal, Notice, Platform, TextFileView } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t, locale } from "./i18n";
import { spanLabel } from "./dates";
import { currencyOf, priceNumber, priceValue, toIso, toList, withCurrency } from "./md";
import { allPlaces, isPlaceFile, isTripFile, mapsUrl, placeInfo, readLoc, safeName } from "./places";
import type { PlaceInfo } from "./places";
import { countryOf, locate } from "./geo";
import { parsePlace, placePage, serializePlace, setSection } from "./place-page";
import { SECS } from "./place-types";
import type { SecDef, SecKey } from "./place-types";
import type { PlaceDoc, PlaceProp } from "./place-page";
import { countries, currencyOfCountry, promptText } from "./prompt";
import { propKey } from "./settings";
import { button } from "./ui";

export const PLACE_VIEW = "cool-trip-place";

export class PlaceView extends TextFileView {
  doc: PlaceDoc | null = null;
  editing: string | null = null;
  currency = "";                       // la moneda elegida en la cabecera (si aún no hay ningún precio que la diga)
  constructor(leaf: WorkspaceLeaf, private plugin: CoolTripPlugin) { super(leaf); }
  getViewType() { return PLACE_VIEW; }
  getDisplayText() { return this.file?.basename ?? "Cool Trip"; }
  getIcon() { return "map-pin"; }
  canAcceptExtension(ext: string) { return ext === "md"; }
  setViewData(data: string, clear: boolean) {
    this.data = data;
    if (clear) this.editing = null;
    this.doc = parsePlace(data);
    /* con la cabecera abierta, se espera a que Obsidian lea las propiedades nuevas (si no, la ciudad recién escrita desaparecía) */
    if (clear || this.editing !== "hero") this.render();
  }
  getViewData() { return this.data; }
  async onOpen() {
    /* al cambiar sus propiedades (estrellas, visitado, precio…), la nota se vuelve a leer */
    this.registerEvent(this.app.metadataCache.on("changed", f => {
      if (f !== this.file) return;
      /* la nota se vuelve a leer siempre (para no pisar lo que acabas de cambiar); con algo abierto, sin repintar */
      void this.app.vault.read(f).then(d => { if (d !== this.data) { this.data = d; this.doc = parsePlace(d); } if (!this.editing || this.editing === "hero") this.render(); });
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
      /* si ya era una lista (la categoría o las coordenadas), sigue siendo una lista; si era texto, texto */
      if (Array.isArray(m[key]) && typeof val === "string") val = val ? val.split(/\s*,\s*/) : "";
      else if (typeof m[key] === "string" && Array.isArray(val)) val = val.join(", ");
      if (val === "" || val === 0 || (val === false && !(key in m))) delete m[key]; else m[key] = val;
    });
    if (k === "city" && typeof v === "string") void this.fillCountry(v);
  }
  /* el país de una ciudad nueva: se busca en OpenStreetMap (si está activada la búsqueda en Ajustes › 4) y se recuerda */
  private async fillCountry(city: string) {
    const s = this.plugin.settings, key = city.trim().toLowerCase();
    if (!key || s.countries[key] || !s.maps.geocode) return;
    const c = await countryOf(city, locale());
    if (!c || s.countries[key]) return;
    s.countries[key] = c;
    await this.plugin.saveSettings();
    this.plugin.keeper.schedule();
    this.render();
  }

  render() {
    const el = this.contentEl, f = this.file, s = this.plugin.settings;
    /* lo que estabas escribiendo en la cabecera sigue ahí (y con el foco) al volver a pintar */
    const focus = el.querySelector<HTMLInputElement>("input[data-field]:focus");
    const keep = focus ? { k: focus.dataset.field, v: focus.value, at: focus.selectionStart } : null;
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
    /* la moneda: la elegida, la de los precios que ya tiene, la de su país o el euro */
    const priced = [p.price, ...doc.secs.flatMap(x => x.lines)].find(x => /R\$|[€$£¥₩฿]|\bkr\b|zł|\b[A-Z]{3}\b/.test(x) && /\d/.test(x));
    const currency = this.currency || (priced ? currencyOf(priced) : "") || currencyOfCountry(p.country) || "€";
    el.appendChild(h("div", { cls: "ct-page" }, placePage({
      place: p, doc, phone, lang: locale(), cover,
      photo: cover ? this.plugin.coverSrc(cover, f.path) : null,
      trips, mapsUrl: mapsUrl(s.maps.app, p.name, p.city, p.loc), editing: this.editing,
      today: (new Date().getDay() + 6) % 7,
      openUrl: url => window.open(url),
      openLink: name => void this.app.workspace.openLinkText(name, f.path, false),
      edit: id => { this.editing = id; this.render(); },
      setLines: (k, lines, keep, stay) => { setSection(doc, k, lines, s.language, keep); if (!stay) this.editing = null; this.commit(); },
      setProp: (k, v) => void this.setProp(k, v),
      ask: (title, ph, value) => promptText(this.app, title, ph, value),
      pickPlace: () => new Promise(res => new PlacePicker(this.app, places(), res).open()),
      lookup: name => {
        const x = allPlaces(this.app, s).find(y => y.name === name);
        return x ? { category: x.category, photo: x.photo ? this.plugin.coverSrc(x.photo, x.file.path) : null } : null;
      },
      locate: () => { void this.fillCountry(p.city); void locate(this.app, s, f, p.name, p.city, p.country).then(ok => { if (!ok) new Notice(t("pl.notFound")); }); },
      currency, countries: countries(locale()),
      cities: [...new Set([...allPlaces(this.app, s).map(x => x.city.trim()).filter(Boolean), ...Object.keys(s.countries).map(c => c.replace(/^./, x => x.toUpperCase()))])]
        .filter((c, i, a) => a.findIndex(y => y.toLowerCase() === c.toLowerCase()) === i).sort((a, b) => a.localeCompare(b)),
      setCountry: v => {
        if (!p.city.trim()) { new Notice(t("pl.cityFirst")); return; }
        const key = p.city.trim().toLowerCase();
        if (v) s.countries[key] = v; else delete s.countries[key];
        void this.plugin.saveSettings().then(() => { this.plugin.keeper.schedule(); this.render(); });
      },
      /* el nombre es el de la nota: se renombra (Obsidian cambia los enlaces que le apuntan) */
      rename: name => {
        const n = safeName(name);
        if (!n || n === f.basename) return;
        const path = (f.parent && f.parent.path !== "/" ? f.parent.path + "/" : "") + n + ".md";
        if (this.app.vault.getAbstractFileByPath(path)) { new Notice(t("new.exists")); this.render(); return; }
        void this.app.fileManager.renameFile(f, path).then(() => this.render());
      },
      setCurrency: c => {
        this.currency = c;
        /* los precios que ya tiene pasan a la moneda nueva (solo el símbolo; el número se queda) */
        for (const k of Object.keys(SECS) as SecKey[]) {
          const d: SecDef = SECS[k], pc = (d.cols || []).findIndex(x => /precio|price/i.test(x[0]));
          if (pc < 0) continue;
          const sec = doc.secs.find(x => d.title.map(y => y.toLowerCase()).includes(x.title.trim().toLowerCase()));
          if (!sec) continue;
          sec.lines = sec.lines.map(l => {
            const m = /^(\s*[-*]\s+)(.*)$/.exec(l);
            if (!m) return l;
            const cells = m[2].split(" · ");
            if (cells[pc] && priceValue(cells[pc]) > 0) cells[pc] = withCurrency(priceNumber(cells[pc]), c);
            return m[1] + cells.join(" · ");
          });
        }
        this.commit();
        if (p.price && priceValue(p.price) > 0) void this.setProp("price", withCurrency(priceNumber(p.price), c));
      },
    })));
    if (keep?.k) {
      const x = el.querySelector<HTMLInputElement>(`input[data-field="${keep.k}"]`);
      if (x) { x.value = keep.v; x.focus(); if (keep.at != null) x.setSelectionRange(keep.at, keep.at); }
    }
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
