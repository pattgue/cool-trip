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
  /* la ficha de un lugar: un restaurante, un museo y una sala, con algunas secciones ya escritas */
  plugin.settings.countries = { tokio: "Japón" };
  const kind = window.__mode.slice(6) || "eat";
  const SAMPLES: Record<string, { name: string; fm: Record<string, unknown>; md: string; editing?: string }> = {
    eat: { name: "Omoide Yokocho", fm: { "categoría": "Izakaya", "valoración": 4, coordenadas: ["35.6929", "139.6996"] },
      editing: "topBar", md: "## Cocina\nYakitori a la brasa y guisos de toda la vida, en puestos de 6 u 8 sitios.\n\n## Carta\n- Yakitori de muslo · 220 ¥ · con sal\n- Motsuni · 600 ¥ · guiso de casquería\n- Cerveza Sapporo · 550 ¥\n\n## Horario\n- Lunes: 17:00–24:00\n- Martes: 17:00–24:00\n- Miércoles: cerrado\n- Jueves: 17:00–24:00\n- Viernes: 17:00–02:00\n- Sábado: 16:00–02:00\n- Domingo: 16:00–23:00\n\n## Accesibilidad\n- Sin escalones\n\n## Datos útiles\nSolo efectivo. Hay mucho humo: mejor no llevar ropa buena.\n" },
    see: { name: "teamLab Planets", editing: "hero", fm: { "valoración": 5, visitado: true },
      md: "## Entradas\n- General · 3.800 ¥ · todas las salas\n- Joven (13–17) · 2.800 ¥\n- Niños (4–12) · 1.500 ¥\n\n## Exposiciones y actividades\n- Jardín flotante · permanente · se entra descalzo\n\n## Horario\n- Lunes: 9:00–22:00\n- Martes: 9:00–22:00\n- Miércoles: 9:00–22:00\n- Jueves: 9:00–22:00\n- Viernes: 9:00–22:00\n- Sábado: 8:00–22:00\n- Domingo: 8:00–22:00\n\n## Accesibilidad\n- Ascensor\n- Baño adaptado\n\n## Tras la visita\nCenar en Toyosu, al lado.\n" },
    music: { name: "Shibuya WWW", fm: { "categoría": "Sala de conciertos", ciudad: "Tokio", precio: "3.500 ¥" },
      md: "## Qué se programa\nIndie, electrónica y pop japonés; casi cada noche hay concierto.\n\n## Entradas\n- Anticipada · 3.000 ¥ · en e+ o Pia\n- En taquilla · 3.500 ¥ · si quedan\n\n## Aforo\n- Aforo: 500 personas de pie\n\n## Accesibilidad\n- Bucle magnético\n- Zona tranquila\n", editing: "hours" },
  };
  const S0 = SAMPLES[kind] || SAMPLES.eat;
  let f = files.find(x => x.basename === S0.name);
  if (!f) { f = new TFile(`Lugares/Tokio/${S0.name}.md`, { tipo: "lugar", ciudad: "Tokio" }); files.push(f); }
  const ff = f as unknown as { fm: Record<string, unknown> };
  ff.fm = { ...ff.fm, ...S0.fm };
  const root = document.createElement("div");
  root.className = "ct-root ct-view" + (window.__phone ? " is-phone" : "");
  const pg = document.createElement("div");
  pg.className = "ct-page";
  const ask = () => Promise.resolve(null);
  pg.appendChild(placePage({ place: placeInfo(app as never, plugin.settings, f), doc: parsePlace(S0.md), phone: window.__phone, lang: "es", photo: null, cover: "",
    trips: [{ name: "2027 - Japón", dates: "3 – 14 abr 2027", open: () => {} }], mapsUrl: "", today: 4, editing: location.hash === "#view" ? null : S0.editing || null,
    openUrl: () => {}, openLink: () => {}, edit: () => {}, setLines: () => {}, setProp: () => {}, ask, pickPlace: ask, lookup: () => null, locate: () => {},
    currency: "¥", countries: ["España", "Italia", "Japón"], setCountry: () => {}, setCurrency: () => {} }));
  root.appendChild(pg);
  document.body.appendChild(root);
} else {
  const view = new TripView({ app } as never, plugin as never);
  (view as unknown as { file: TFile }).file = trip;
  document.body.appendChild(view.containerEl);
  view.setViewData(window.__sample, true);
}
