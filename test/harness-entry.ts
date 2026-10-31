// Pinta la nota de ejemplo con la vista de Cool Trip (y el modal de Nuevo viaje) sin Obsidian.
import { TripView } from "../src/view";
import { NewTripModal } from "../src/modal";
import { defaultSettings } from "../src/settings";
import { registry } from "../src/cool-kit/kit";
import { CoolTripSettingTab } from "../src/settings-tab";
import { TFile } from "obsidian";
import { parsePlace, placePage } from "../src/place-page";
import { placeInfo } from "../src/places";
declare const window: Window & { __sample: string; __phone: boolean; __mode: string };

const places: Record<string, Record<string, unknown>> = {
  "Senso-ji": { tipo: "lugar", ciudad: "Tokio", "categoría": "Templo" }, "Nakamise-dori": { tipo: "lugar", ciudad: "Tokio", "categoría": "Calle comercial" },
  "Meiji Jingu": { tipo: "lugar", ciudad: "Tokio", "categoría": "Santuario" }, "Shibuya Crossing": { tipo: "lugar", ciudad: "Tokio", "categoría": "Cruce" },
  "Omoide Yokocho": { tipo: "lugar", ciudad: "Tokio", "categoría": "Restaurante" }, "teamLab Planets": { tipo: "lugar", ciudad: "Tokio", "categoría": "Museo" },
  "Hotel Kaminarimon": { tipo: "lugar", ciudad: "Tokio", "categoría": "Hotel" }, "Tsukiji Outer Market": { tipo: "lugar", ciudad: "Tokio", "categoría": "Mercado" },
};
const files = Object.entries(places).map(([n, fm]) => new TFile(`Lugares/Tokio/${n}.md`, fm));
const trip = new TFile("Viajes/2027 - Japón.md", { tipo: "viaje", inicio: "2027-04-03", fin: "2027-04-14", destinos: ["Tokio", "Kioto"], viajeros: ["Ana", "Leo"], portada: "bermellón" });
const trip2 = new TFile("Viajes/2026 - Portugal.md", { tipo: "viaje", inicio: "2026-12-04", fin: "2026-12-09", destinos: ["Lisboa", "Oporto"], viajeros: ["Ana", "Leo"], portada: "lavanda" });
const app = {
  metadataCache: {
    getFirstLinkpathDest: (l: string) => files.find(f => f.basename === l) || null,
    getFileCache: (f: TFile & { fm: Record<string, unknown> }) => ({ frontmatter: f.fm }),
  },
  vault: { getName: () => "Mi vault", getMarkdownFiles: () => [...files, trip, trip2], getAbstractFileByPath: () => null, getResourcePath: () => "", getAllLoadedFiles: () => [] },
  workspace: { openLinkText: () => {}, getLeaf: () => ({ openFile: () => {} }) },
  fileManager: {},
};
const plugin = { settings: defaultSettings("es"), app, isTrip: () => true, syncLeaves: () => {}, manifest: { id: "cool-trip" },
  coverSrc: (c: string) => /^(https?|data):/.test(c) ? c : null,
  askDest: async () => ({ city: "Roma", country: "Italia" }),
  keeper: { env: () => ({ cool: false, maps: false, iconSvg: () => "" }), missing: async () => ({ old: false, map: false, cool: false }), create: async () => {}, upgrade: async () => {} } };
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
} else if (window.__mode.startsWith("place")) {
  /* la nota de un lugar: un museo (ordenador) y un restaurante (móvil), con alguna sección ya escrita */
  plugin.settings.countries = { tokio: "Japón" };
  const eat = window.__mode === "place-eat";
  const f = files.find(x => x.basename === (eat ? "Omoide Yokocho" : "teamLab Planets"))!;
  (f as unknown as { fm: Record<string, unknown> }).fm = { ...(f as unknown as { fm: Record<string, unknown> }).fm,
    ...(eat ? { "categoría": "Izakaya", precio: "€€", "valoración": 4 } : { precio: "3.800 ¥", "valoración": 5, visitado: true }) };
  const md = eat ? "## Qué pedir\n- Yakitori de muslo con sal\n- Motsuni (guiso de casquería)\n\n## Horario\nTodos los días, de 17:00 a 24:00. Mejor llegar pronto: los puestos son de 6 u 8 sitios.\n"
    : "## Entradas\nCon hora fija: comprarlas en la web una semana antes. Incluye todas las salas; hay que ir descalzo.\n\n## Horario\n- Lunes a viernes, 9:00–22:00\n- Sábados y domingos, 8:00–22:00\n\n## Tras la visita\nCenar en Toyosu, al lado.\n";
  const root = document.createElement("div");
  root.className = "ct-root ct-view" + (window.__phone ? " is-phone" : "");
  const pg = document.createElement("div");
  pg.className = "ct-page";
  pg.appendChild(placePage({ place: placeInfo(app as never, plugin.settings, f), doc: parsePlace(md), phone: window.__phone, lang: "es", photo: null,
    trips: [{ name: "2027 - Japón", dates: "3 – 14 abr 2027", open: () => {} }], mapsUrl: "", editing: null,
    openUrl: () => {}, edit: () => {}, saveSection: () => {}, setRating: () => {}, setVisited: () => {}, setPrice: () => {} }));
  root.appendChild(pg);
  document.body.appendChild(root);
} else {
  const view = new TripView({ app } as never, plugin as never);
  (view as unknown as { file: TFile }).file = trip;
  document.body.appendChild(view.containerEl);
  view.setViewData(window.__sample, true);
}
