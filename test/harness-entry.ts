// Pinta la nota de ejemplo con la vista de Cool Trip (y el modal de Nuevo viaje) sin Obsidian.
import { TripView } from "../src/view";
import { NewTripModal } from "../src/modal";
import { defaultSettings } from "../src/settings";
import { CoolTripSettingTab } from "../src/settings-tab";
import { TFile } from "obsidian";
declare const window: Window & { __sample: string; __phone: boolean; __mode: string };

const places: Record<string, Record<string, unknown>> = {
  "Senso-ji": { tipo: "lugar", ciudad: "Tokio", "categoría": "Templo" }, "Nakamise-dori": { tipo: "lugar", ciudad: "Tokio", "categoría": "Calle comercial" },
  "Meiji Jingu": { tipo: "lugar", ciudad: "Tokio", "categoría": "Santuario" }, "Shibuya Crossing": { tipo: "lugar", ciudad: "Tokio", "categoría": "Cruce" },
  "Omoide Yokocho": { tipo: "lugar", ciudad: "Tokio", "categoría": "Restaurante" }, "teamLab Planets": { tipo: "lugar", ciudad: "Tokio", "categoría": "Museo" },
  "Hotel Kaminarimon": { tipo: "lugar", ciudad: "Tokio", "categoría": "Hotel" }, "Tsukiji Outer Market": { tipo: "lugar", ciudad: "Tokio", "categoría": "Mercado" },
};
const files = Object.entries(places).map(([n, fm]) => new TFile(`Lugares/Tokio/${n}.md`, fm));
const trip = new TFile("Viajes/2027 - Japón.md", { tipo: "viaje" });
const app = {
  metadataCache: {
    getFirstLinkpathDest: (l: string) => files.find(f => f.basename === l) || null,
    getFileCache: (f: TFile & { fm: Record<string, unknown> }) => ({ frontmatter: f.fm }),
  },
  vault: { getMarkdownFiles: () => [...files, trip], getAbstractFileByPath: () => null, getResourcePath: () => "", getAllLoadedFiles: () => [] },
  workspace: { openLinkText: () => {}, getLeaf: () => ({ openFile: () => {} }) },
  fileManager: {},
};
const plugin = { settings: defaultSettings("es"), app };
if (window.__mode.startsWith("settings")) {
  const tab = new CoolTripSettingTab(app as never, plugin as never);
  tab.step = Number(window.__mode.slice(8)) || 1;
  document.body.appendChild(tab.containerEl);
  (plugin as unknown as { saveSettings: () => Promise<void> }).saveSettings = async () => {};
  tab.display();
} else if (window.__mode === "modal") {
  const m = new NewTripModal(plugin as never);
  (m as unknown as { trip: { dests: unknown[]; start: string; end: string; travelers: string[] } }).trip.dests.push(
    { city: "Tokio", country: "Japón", nights: 6, travelers: ["Ana", "Leo"] }, { city: "Kioto", country: "Japón", nights: 5, travelers: ["Ana", "Leo"] });
  const tr = (m as unknown as { trip: { start: string; end: string; travelers: string[] } }).trip;
  tr.start = "2027-04-03"; tr.end = "2027-04-14"; tr.travelers.push("Ana", "Leo");
  m.open();
} else {
  const view = new TripView({ app } as never, plugin as never);
  (view as unknown as { file: TFile }).file = trip;
  document.body.appendChild(view.containerEl);
  view.setViewData(window.__sample, true);
}
