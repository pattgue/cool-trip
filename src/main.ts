/* Cool Trip: cada viaje en una nota, pintada como una tarjeta de embarque con su plan día a día.
   Se abre desde el botón COOL TRIP de la Cool Bar (Cool Kit) o con los comandos. */
import { MarkdownView, Plugin, TFile } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { joinCoolKit } from "./cool-kit/kit";
import type { CoolKitHandle } from "./cool-kit/kit";
import { locale, t } from "./i18n";
import { allPlaces, isTripFile, resolve, tagsOf } from "./places";
import { promptDest } from "./prompt";
import { adaptToVault, mergeSettings } from "./settings";
import { CoolTripSettingTab } from "./settings-tab";
import { NewTripModal } from "./modal";
import { BaseKeeper } from "./keeper";
import { TripView, VIEW_TYPE } from "./view";
import type { Settings } from "./types";

export default class CoolTripPlugin extends Plugin {
  settings: Settings = mergeSettings(null, "es");
  bar: CoolKitHandle | null = null;
  keeper = new BaseKeeper(this);
  /* notas de viaje que el usuario ha pedido ver como Markdown (hasta que vuelva a pulsar COOL TRIP) */
  asMarkdown = new Set<string>();

  async onload() {
    this.settings = mergeSettings(await this.loadData() as Partial<Settings> | null, locale());
    this.registerView(VIEW_TYPE, leaf => new TripView(leaf, this));
    this.addSettingTab(new CoolTripSettingTab(this.app, this));

    this.addCommand({ id: "new-trip", name: t("cmd.new"), callback: () => new NewTripModal(this).open() });
    this.addCommand({
      id: "toggle-trip-view", name: t("cmd.toggle"),
      checkCallback: checking => {
        const leaf = this.app.workspace.getMostRecentLeaf();
        const v = leaf?.view;
        const ok = v instanceof TripView || (v instanceof MarkdownView && !!v.file);
        if (ok && !checking && leaf) void this.toggleLeaf(leaf);
        return ok;
      },
    });

    this.bar = joinCoolKit(this, {
      id: this.manifest.id,
      label: () => "Cool Trip",
      icon: "plane",
      order: 30,
      appliesTo: () => true,
      isOpen: leaf => leaf.view instanceof TripView,
      kind: "view",
      toggle: leaf => {
        const v = leaf.view;
        if (v instanceof TripView || (v instanceof MarkdownView && this.isTrip(v.file))) void this.toggleLeaf(leaf);
        else new NewTripModal(this).open();
      },
      saveShared: async data => { this.settings.coolBar = data; await this.saveData(this.settings); },
      loadShared: async () => this.settings.coolBar,
    });

    /* las notas de viaje se abren pintadas */
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncLeaves()));
    this.registerEvent(this.app.metadataCache.on("changed", file => { this.marked.delete(file.path); this.syncLeaves(); this.keeper.schedule(); }));
    this.app.workspace.onLayoutReady(() => { void this.adapt(); this.syncLeaves(); this.keeper.schedule(); });
    this.registerEvent(this.app.metadataCache.on("resolved", () => { void this.adapt(); }));
    /* las bases que creó Cool Trip siguen siendo suyas aunque se muevan o se renombren (y dejan de serlo si se borran) */
    this.registerEvent(this.app.vault.on("rename", (f, old) => { this.followBase(old, f.path); this.keeper.schedule(); }));
    this.registerEvent(this.app.vault.on("delete", f => { this.followBase(f.path, ""); this.keeper.schedule(); }));
  }
  private followBase(from: string, to: string) {
    const made = this.settings.basesMade;
    let changed = false;
    for (const k of ["trips", "places"] as const) {
      const p = made[k];
      if (!p || (p !== from && !p.startsWith(from + "/"))) continue;
      made[k] = to ? to + p.slice(from.length) : "";
      changed = true;
    }
    if (changed) void this.saveSettings();
  }

  /* si los ajustes por defecto son de otro idioma que las notas del vault, se pasan al de las notas (una vez) */
  private adapted = false;
  async adapt() {
    if (this.adapted) return;
    const notes = this.app.vault.getMarkdownFiles().map(f => ({ path: f.path, fm: this.app.metadataCache.getFileCache(f)?.frontmatter, tags: tagsOf(this.app, f) }));
    if (!notes.some(n => n.fm)) return;                     // la caché aún no está lista
    this.adapted = true;
    if (adaptToVault(this.settings, notes)) { await this.saveSettings(); this.syncLeaves(); }
  }

  onunload() {
    this.keeper.cancel();
    /* las pestañas pintadas vuelven a ser notas normales */
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const file = (leaf.view as TripView).file;
      if (file) void leaf.setViewState({ type: "markdown", state: { file: file.path } });
    }
  }

  async saveSettings() { await this.saveData(this.settings); this.bar?.refresh(); }

  /* el país de una ciudad: el que ya usaste, o el de tus notas de lugar de esa ciudad */
  guessCountry(city: string): string {
    const c = city.trim().toLowerCase();
    if (!c) return "";
    if (this.settings.countries[c]) return this.settings.countries[c];
    return allPlaces(this.app, this.settings).find(p => p.city.toLowerCase() === c && p.country)?.country || "";
  }
  async askDest(city: string, country: string, fallback: string): Promise<{ city: string; country: string } | null> {
    const v = await promptDest(this.app, t("addDest"), locale(), city, country || this.guessCountry(city) || fallback,
      c => this.guessCountry(c) || fallback);
    if (v?.country) { this.settings.countries[v.city.toLowerCase()] = v.country; await this.saveSettings(); }
    return v;
  }
  /* la URL de una portada con imagen: un enlace o un archivo del vault */
  coverSrc(cover: string, from: string): string | null {
    const c = cover.trim().replace(/^!?\[\[|\]\]$/g, "").replace(/^!?\[[^\]]*\]\((.*)\)$/, "$1");
    if (!c) return null;
    if (/^(https?|app|file|data):/i.test(c)) return c;
    const f = resolve(this.app, c, from);
    return f instanceof TFile ? this.app.vault.getResourcePath(f) : null;
  }

  /* una nota de viaje: la reconocen los ajustes o lleva el bloque del plugin (> [!cool-trip…]), aunque los ajustes no la reconozcan */
  marked = new Map<string, boolean>();
  isTrip(f: TFile | null | undefined): f is TFile {
    return !!f && f.extension === "md" && (this.marked.get(f.path) === true || isTripFile(this.app, this.settings, f));
  }
  private async checkMarker(f: TFile) {
    const has = /^>\s*\[!cool-trip/im.test(await this.app.vault.cachedRead(f));
    const before = this.marked.get(f.path);
    this.marked.set(f.path, has);
    if (has && !before) this.syncLeaves();
  }

  syncLeaves() {
    const ws = this.app.workspace;
    ws.iterateAllLeaves(leaf => {
      const root = leaf.getRoot();
      if (root === ws.leftSplit || root === ws.rightSplit) return;
      const v = leaf.view;
      if (!(v instanceof MarkdownView) || !v.file || this.asMarkdown.has(v.file.path)) return;
      if (!this.marked.has(v.file.path)) void this.checkMarker(v.file);
      if (this.isTrip(v.file)) {
        void leaf.setViewState({ type: VIEW_TYPE, state: { file: v.file.path }, active: leaf === ws.getMostRecentLeaf() });
      }
    });
    this.bar?.refresh();
  }

  /* entre el viaje pintado y su Markdown */
  async toggleLeaf(leaf: WorkspaceLeaf) {
    const v = leaf.view;
    if (v instanceof TripView && v.file) {
      this.asMarkdown.add(v.file.path);
      await leaf.setViewState({ type: "markdown", state: { file: v.file.path, mode: "source" }, active: true });
    } else if (v instanceof MarkdownView && v.file) {
      this.asMarkdown.delete(v.file.path);
      await leaf.setViewState({ type: VIEW_TYPE, state: { file: v.file.path }, active: true });
    }
    this.bar?.refresh();
  }
}
