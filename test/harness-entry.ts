// Pinta la nota de ejemplo con la vista de Cool Trip (y el modal de Nuevo viaje) sin Obsidian.
import { TripView } from "../src/view";
import { NewTripModal } from "../src/modal";
import { defaultSettings } from "../src/settings";
import { registry } from "../src/cool-kit/kit";
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
  vault: { getName: () => "Mi vault", getMarkdownFiles: () => [...files, trip], getAbstractFileByPath: () => null, getResourcePath: () => "", getAllLoadedFiles: () => [] },
  workspace: { openLinkText: () => {}, getLeaf: () => ({ openFile: () => {} }) },
  fileManager: {},
};
const plugin = { settings: defaultSettings("es"), app, isTrip: () => true, manifest: { id: "cool-trip" },
  coverSrc: (c: string) => /^(https?|data):/.test(c) ? c : null,
  askDest: async () => ({ city: "Roma", country: "Italia" }) };
if (window.__mode.startsWith("settings")) {
  /* la Cool Bar con dos plugins Cool, para el paso 6 */
  const reg = registry();
  const tool = (id: string, label: string, order: number) => ({ id, label: () => label, order, appliesTo: () => id === "cool-trip", isOpen: () => false, toggle: () => {} });
  reg.tools["cool-trip"] = tool("cool-trip", "Cool Trip", 30);
  reg.tools["cool-bases"] = tool("cool-bases", "Cool Bases", 20);
  const tab = new CoolTripSettingTab(app as never, plugin as never);
  tab.step = Number(window.__mode.slice(8)) || 1;
  /* el marco de Ajustes de Obsidian (test/obsidian-settings.css): barra lateral y pestaña; en el móvil, su cabecera */
  const el = (cls: string, text = "") => { const d = document.createElement("div"); d.className = cls; d.textContent = text; return d; };
  const modal = el("modal mod-settings" + (window.__phone ? " is-phone-frame" : ""));
  if (window.__phone) modal.appendChild(el("modal-header", "‹  Cool Trip"));
  else {
    const side = el("vertical-tab-header");
    side.append(el("vertical-tab-header-group-title", "Opciones"), ...["General", "Editor", "Archivos y enlaces", "Apariencia"].map(x => el("vertical-tab-nav-item", x)),
      el("vertical-tab-header-group-title", "Complementos de la comunidad"), el("vertical-tab-nav-item", "Cool Bases"), el("vertical-tab-nav-item is-active", "Cool Trip"));
    modal.appendChild(side);
  }
  const cont = el("vertical-tab-content-container");
  tab.containerEl.classList.add("vertical-tab-content");
  cont.appendChild(tab.containerEl);
  modal.appendChild(cont);
  document.body.appendChild(modal);
  (plugin as unknown as { saveSettings: () => Promise<void> }).saveSettings = async () => {};
  tab.display();
} else if (window.__mode === "modal") {
  const m = new NewTripModal(plugin as never);
  (m as unknown as { trip: { dests: unknown[]; start: string; end: string; travelers: string[] } }).trip.dests.push(
    { city: "Tokio", country: "Japón", nights: 6, travelers: ["Ana", "Leo"] }, { city: "Kioto", country: "Japón", nights: 5, travelers: ["Ana", "Leo"] });
  const tr = (m as unknown as { trip: { start: string; end: string; travelers: string[] } }).trip;
  tr.start = "2027-04-03"; tr.end = "2027-04-14"; tr.travelers.push("Ana", "Leo");
  if (location.hash === "#patt") {
    /* lo que vio Patt en el móvil: sin fechas, dos destinos con país y el modal a pantalla completa */
    (m as unknown as { trip: { dests: unknown[] } }).trip.dests.splice(0, 2,
      { city: "Roma", country: "Italy", nights: 0, travelers: ["patt"] }, { city: "Palermo", country: "Italy", nights: 0, travelers: ["patt", "alba"] });
    tr.start = ""; tr.end = ""; tr.travelers.splice(0, 2, "patt", "alba");
    m.containerEl.setCssProps({ position: "fixed", inset: "0", display: "flex" });
  }
  if (location.hash === "#img") (tr as unknown as { cover: string; accent: string }).cover = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#4a7fb5"/><circle cx="300" cy="60" r="50" fill="#f3d36b"/><rect y="140" width="400" height="60" fill="#2f5d3a"/></svg>');
  m.open();
} else {
  const view = new TripView({ app } as never, plugin as never);
  (view as unknown as { file: TFile }).file = trip;
  document.body.appendChild(view.containerEl);
  view.setViewData(window.__sample, true);
}
