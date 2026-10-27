/* La nota del viaje pintada: un TextFileView sobre el .md (como hace Kanban). Lee el Markdown, lo enseña diseñado y,
   con cada cambio, lo vuelve a escribir y guarda. */
import { Notice, Platform, TextFileView, TFile, normalizePath } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t } from "./i18n";
import { isIso } from "./dates";
import { parseTrip, serializeTrip } from "./md";
import { allPlaces, createPlace, isTripFile, resolve, walletUrl } from "./places";
import type { PlaceInfo } from "./places";
import { plan } from "./plan";
import type { DocAdd, FormState } from "./plan";
import { renderForm } from "./forms";
import type { FormCtx, FormExtra } from "./forms";
import { coste, mochila, porHacer } from "./side";
import type { SideCtx } from "./side";
import { ticket } from "./ticket";
import { promptText } from "./prompt";
import { button } from "./ui";
import type { Doc, Trip } from "./types";
import { isTransport } from "./types";
import { field, splitWhen } from "./md";

export const VIEW_TYPE = "cool-trip";
const PHONE_WIDTH = 760;

export class TripView extends TextFileView {
  plugin: CoolTripPlugin;
  trip: Trip | null = null;
  form: (FormState & FormExtra) | null = null;
  docAdd: DocAdd | null = null;
  editing = false;                 // la portada desbloqueada para editarla (con el lápiz)
  collapsed = new Set<string>();
  folded = new Set<string>();
  bagDraft: Doc | null = null;
  private placesCache: PlaceInfo[] | null = null;
  private wasPhone: boolean | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: CoolTripPlugin) { super(leaf); this.plugin = plugin; }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return this.file?.basename ?? "Cool Trip"; }
  getIcon() { return "plane"; }
  canAcceptExtension(ext: string) { return ext === "md"; }

  setViewData(data: string, clear: boolean) {
    this.data = data;
    if (clear) {
      this.form = null; this.collapsed.clear(); this.bagDraft = null; this.docAdd = null; this.editing = false;
      this.folded = new Set(this.isPhone() ? ["bag", "todo"] : []);
    }
    this.trip = this.file ? parseTrip(data, this.file.basename, this.plugin.settings) : null;
    this.render();
  }
  getViewData() { return this.data; }
  clear() { this.trip = null; this.contentEl.empty(); }
  onResize() { if (this.wasPhone !== null && this.wasPhone !== this.isPhone()) this.render(); }

  isPhone(): boolean { return Platform.isPhone || (this.contentEl.clientWidth > 0 && this.contentEl.clientWidth < PHONE_WIDTH); }

  /* guarda el viaje en la nota y repinta */
  commit() {
    if (!this.trip) return;
    this.data = serializeTrip(this.trip, this.plugin.settings);
    this.requestSave();
    this.render();
  }

  render() {
    const el = this.contentEl, scroll = el.scrollTop;
    el.empty();
    el.addClass("ct-root", "ct-view");
    const phone = this.isPhone();
    this.wasPhone = phone;
    el.toggleClass("is-phone", phone);
    this.placesCache = null;
    const file = this.file;
    if (!file || !this.trip) return;
    if (!isTripFile(this.app, this.plugin.settings, file) && !this.data.includes("[!cool-trip]")) {
      el.appendChild(h("div", { cls: "ct-empty" }, h("p", null, t("notTrip")),
        button(t("cmd.toggle"), "ct-btn-ghost", () => void this.plugin.toggleLeaf(this.leaf))));
      return;
    }
    const ctx = this.ctx(file, phone);
    const page = h("div", { cls: "ct-page" });
    page.appendChild(ticket({
      mode: "note", phone, trip: this.trip, expanded: this.editing, locked: !this.editing,
      path: [file.parent && file.parent.path !== "/" ? file.parent.path : "", file.name].filter(Boolean).join(" / "),
      changed: () => this.commit(),
      prompt: (title, ph, value) => promptText(this.app, title, ph, value),
      promptDest: (city, country, fb) => this.plugin.askDest(city, country, fb),
      rename: name => void this.rename(name),
      toggleExpanded: () => { this.editing = !this.editing; this.render(); },
      jump: date => this.jump(date),
      coverSrc: cover => this.plugin.coverSrc(cover, file.path),
    }));
    let aside: HTMLElement | null = null;
    if (phone) page.append(mochila(ctx), porHacer(ctx), plan(ctx), coste(ctx));
    else page.appendChild(h("div", { cls: "ct-columns" }, plan(ctx), aside = h("aside", { cls: "ct-aside" }, mochila(ctx), porHacer(ctx), coste(ctx))));
    el.appendChild(page);
    el.scrollTop = scroll;
    this.watchAside(aside);
  }

  /* el lateral acompaña al plan: si no cabe en la pantalla, baja con el scroll hasta que se ve su final y ahí se queda */
  private asideObs: ResizeObserver | null = null;
  private watchAside(aside: HTMLElement | null) {
    this.asideObs?.disconnect();
    this.asideObs = null;
    if (!aside) return;
    const fit = () => {
      const room = this.contentEl.clientHeight, tall = aside.offsetHeight;
      aside.setCssProps({ "--ct-aside-top": Math.min(16, room - tall - 24) + "px" });
    };
    fit();
    this.asideObs = new ResizeObserver(fit);
    this.asideObs.observe(aside);
    this.asideObs.observe(this.contentEl);
  }
  async onClose() { this.asideObs?.disconnect(); await super.onClose(); }

  private ctx(file: TFile, phone: boolean): FormCtx & SideCtx {
    const ctx: FormCtx & SideCtx = {
      app: this.app, s: this.plugin.settings, trip: this.trip!, file, phone,
      form: this.form,
      collapsed: this.collapsed, folded: this.folded,
      bagDraft: this.bagDraft,
      setBagDraft: (d, redraw = true) => { this.bagDraft = d; if (redraw) this.render(); },
      docAdd: this.docAdd,
      setDocAdd: (d, redraw = true) => { this.docAdd = d; if (redraw) this.render(); },
      move: (a, ai, b, bi) => this.move(a, ai, b, bi),
      commit: () => this.commit(),
      rerender: () => this.render(),
      openForm: f => { this.form = f; this.docAdd = null; this.render(); if (f) window.setTimeout(() => this.contentEl.querySelector<HTMLElement>(".ct-form input, .ct-form select")?.focus(), 30); },
      renderForm: f => renderForm(ctx, f),
      openLink: link => void this.app.workspace.openLinkText(link, file.path, true),
      openUrl: url => window.open(url, "_blank"),
      openDoc: d => this.openDoc(d, file),
      places: () => this.placesCache ??= allPlaces(this.app, this.plugin.settings),
      createPlace: async (name, city, country) => { const f = await createPlace(this.app, this.plugin.settings, name, city, country); this.placesCache = null; return f.basename; },
      saveForm: f => this.saveForm(f),
      deleteForm: f => { if (!f.isNew) this.trip!.days[f.day]?.items.splice(f.index, 1); this.form = null; this.commit(); },
    };
    return ctx;
  }

  private saveForm(f: FormState) {
    const tr = this.trip!, it = f.draft;
    if (!it.title.trim() && !it.link) { new Notice(t("f.placeNote")); return; }
    if (f.day >= 0 && !f.isNew) tr.days[f.day]?.items.splice(f.index, 1);
    /* el día lo manda la propia reserva (salida o check-in) si cae dentro del viaje; lo demás, el día elegido */
    let di = f.target ?? f.day;
    const key = isTransport(it.kind) ? "depart" : it.kind === "lodging" ? "checkin" : "";
    if (key) {
      const w = splitWhen(field(it, key), tr.start);
      if (w.time && isTransport(it.kind)) it.time = w.time;
      const k = w.date ? tr.days.findIndex(d => d.date === w.date) : -1;
      if (k >= 0) di = k;
    }
    if (it.kind === "lodging") it.time = "";
    const items = tr.days[di].items;
    if (it.kind === "lodging") {
      /* el alojamiento va tras el transporte que te lleva (o al principio del día) */
      let at = -1;
      items.forEach((x, i) => { if (isTransport(x.kind)) at = i; });
      items.splice(f.isNew || di !== f.day ? at + 1 : Math.min(f.index, items.length), 0, it);
    } else if (f.isNew || di !== f.day || it.time) {
      /* con hora, en su sitio; sin hora, al final del día (o donde estaba) */
      const at = it.time ? items.findIndex(x => !!x.time && x.kind !== "lodging" && x.time > it.time) : -1;
      items.splice(at >= 0 ? at : items.length, 0, it);
    } else items.splice(Math.min(f.index, items.length), 0, it);
    this.form = null;
    this.commit();
  }

  /* arrastrar un paso a otro sitio (del mismo día o de otro) */
  private move(fromDay: number, fromIndex: number, toDay: number, toIndex: number) {
    const tr = this.trip;
    if (!tr) return;
    const src = tr.days[fromDay]?.items, dst = tr.days[toDay]?.items;
    if (!src || !dst || !src[fromIndex]) return;
    const [it] = src.splice(fromIndex, 1);
    if (src === dst && fromIndex < toIndex) toIndex--;
    dst.splice(Math.max(0, Math.min(toIndex, dst.length)), 0, it);
    this.commit();
  }

  private openDoc(d: Doc, file: TFile) {
    if (d.where === "paper") { new Notice(t("doc.paper")); return; }
    if (d.where === "wallet") { const u = walletUrl(); if (u) window.open(u, "_blank"); else new Notice(t("doc.wallet")); return; }
    if (d.where === "vault") {
      const f = resolve(this.app, d.url, file.path);
      if (f) void this.app.workspace.getLeaf("tab").openFile(f); else new Notice(t("doc.missing", { p: d.url }));
      return;
    }
    if (d.url) window.open(d.url, "_blank");
  }

  private async rename(name: string) {
    const file = this.file;
    if (!file || !this.trip) return;
    const path = normalizePath((file.parent && file.parent.path !== "/" ? file.parent.path + "/" : "") + name.replace(/[\\/:*?"<>|]/g, "") + ".md");
    if (this.app.vault.getAbstractFileByPath(path)) { new Notice(t("new.exists")); return; }
    this.trip.name = name;
    this.commit();
    await this.app.fileManager.renameFile(file, path);
  }

  private jump(date: string) {
    if (!isIso(date)) return;
    this.contentEl.querySelector(`.ct-day[data-date="${date}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

