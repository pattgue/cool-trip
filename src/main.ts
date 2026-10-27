/* Cool Trip: cada viaje en una nota, pintada como una tarjeta de embarque con su plan día a día.
   Se abre desde el botón COOL TRIP de la Cool Bar (Cool Kit) o con los comandos. */
import { MarkdownView, Plugin } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { joinCoolKit } from "./cool-kit/kit";
import type { CoolKitHandle } from "./cool-kit/kit";
import { locale, t } from "./i18n";
import { isTripFile } from "./places";
import { mergeSettings } from "./settings";
import { CoolTripSettingTab } from "./settings-tab";
import { NewTripModal } from "./modal";
import { TripView, VIEW_TYPE } from "./view";
import type { Settings } from "./types";

export default class CoolTripPlugin extends Plugin {
  settings: Settings = mergeSettings(null, "es");
  bar: CoolKitHandle | null = null;
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
        const ok = v instanceof TripView || (v instanceof MarkdownView && isTripFile(this.app, this.settings, v.file));
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
      toggle: leaf => {
        const v = leaf.view;
        if (v instanceof TripView || (v instanceof MarkdownView && isTripFile(this.app, this.settings, v.file))) void this.toggleLeaf(leaf);
        else new NewTripModal(this).open();
      },
      saveShared: async data => { this.settings.coolBar = data; await this.saveData(this.settings); },
      loadShared: async () => this.settings.coolBar,
    });

    /* las notas de viaje se abren pintadas */
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncLeaves()));
    this.registerEvent(this.app.metadataCache.on("changed", file => { if (isTripFile(this.app, this.settings, file)) this.syncLeaves(); }));
    this.app.workspace.onLayoutReady(() => this.syncLeaves());
  }

  onunload() {
    /* las pestañas pintadas vuelven a ser notas normales */
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      const file = (leaf.view as TripView).file;
      if (file) void leaf.setViewState({ type: "markdown", state: { file: file.path } });
    }
  }

  async saveSettings() { await this.saveData(this.settings); this.bar?.refresh(); }

  syncLeaves() {
    const ws = this.app.workspace;
    ws.iterateAllLeaves(leaf => {
      const root = leaf.getRoot();
      if (root === ws.leftSplit || root === ws.rightSplit) return;
      const v = leaf.view;
      if (v instanceof MarkdownView && v.file && !this.asMarkdown.has(v.file.path) && isTripFile(this.app, this.settings, v.file)) {
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
