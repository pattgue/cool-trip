/* «Cargar lista» de la maleta: se elige una nota (de la carpeta de las listas, si la hay) y su lista se añade a la maleta. */
import { FuzzySuggestModal, Notice, TFile } from "obsidian";
import type { App } from "obsidian";
import { t } from "./i18n";
import { addPackList, packListOf } from "./md";
import type { Settings, Trip } from "./types";

class ListPicker extends FuzzySuggestModal<TFile> {
  constructor(app: App, private files: TFile[], private pick: (f: TFile) => void) {
    super(app);
    this.setPlaceholder(t("pk.loadPh"));
  }
  getItems(): TFile[] { return this.files; }
  getItemText(f: TFile): string { return f.path.replace(/\.md$/, ""); }
  onChooseItem(f: TFile): void { this.pick(f); }
}

/* las notas que se ofrecen: las de la carpeta de las listas (o todas) menos la del propio viaje; las más recientes, primero */
function candidates(app: App, s: Settings, self: TFile | null): TFile[] {
  const dir = s.pack.folder.replace(/^\/+|\/+$/g, "");
  return app.vault.getMarkdownFiles()
    .filter(f => f !== self && (!dir || f.path.startsWith(dir + "/")))
    .sort((a, b) => b.stat.mtime - a.stat.mtime);
}

/* el viaje se pide al final (getTrip): mientras eliges, la nota puede haberse vuelto a leer (Sync, otra pestaña) */
export function loadPackList(app: App, s: Settings, getTrip: () => Trip | null, self: TFile | null, done: () => void) {
  new ListPicker(app, candidates(app, s, self), f => {
    void app.vault.cachedRead(f).then(text => {
      const list = packListOf(text, s);
      if (!list.items.length) { new Notice(t("pk.empty", { f: f.basename })); return; }
      const trip = getTrip();
      if (!trip) return;
      const n = addPackList(trip, list, s.pack.groups);
      new Notice(n ? t(n === 1 ? "pk.loaded1" : "pk.loaded", { n, f: f.basename }) : t("pk.nothing"));
      if (n) done();
    });
  }).open();
}
