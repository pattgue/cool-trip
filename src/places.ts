/* Las notas de lugar: encontrarlas, crearlas, su icono según la categoría y el enlace a la app de mapas. */
import { normalizePath, Platform, TFile } from "obsidian";
import type { App } from "obsidian";
import { matches, placeFolder } from "./settings";
import type { MapsApp, Settings } from "./types";
import { toList } from "./md";

export interface PlaceInfo { file: TFile; name: string; city: string; country: string; category: string; price: string; loc: [number, number] | null }

const fmOf = (app: App, f: TFile): Record<string, unknown> | undefined => app.metadataCache.getFileCache(f)?.frontmatter;
const str = (v: unknown): string => typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
export function tagsOf(app: App, f: TFile): string[] {
  const c = app.metadataCache.getFileCache(f);
  const out = (c?.tags || []).map(x => x.tag);
  return out.concat(toList(c?.frontmatter?.tags).map(x => "#" + x.replace(/^#/, "")));
}
export const isTripFile = (app: App, s: Settings, f: TFile | null | undefined): f is TFile =>
  !!f && f.extension === "md" && matches(s.trips, f.path, fmOf(app, f), tagsOf(app, f));
export const isPlaceFile = (app: App, s: Settings, f: TFile | null | undefined): f is TFile =>
  !!f && f.extension === "md" && matches(s.places, f.path, fmOf(app, f), tagsOf(app, f));

function readLoc(x: unknown): [number, number] | null {
  const nums = (Array.isArray(x) ? x.map(str).join(",") : str(x)).match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const [a, b] = [parseFloat(nums[0]), parseFloat(nums[1])];
  return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null;
}
export function placeInfo(app: App, s: Settings, f: TFile): PlaceInfo {
  const fm = fmOf(app, f) || {};
  const get = (k: string) => { const v = fm[k]; return (Array.isArray(v) ? v.map(str).join(", ") : str(v)).replace(/^\[\[|\]\]$/g, ""); };
  return { file: f, name: f.basename, city: get(s.props.city), country: get(s.props.country), category: get(s.props.category),
    price: get(s.props.price), loc: readLoc(fm[s.props.location]) };
}
export function allPlaces(app: App, s: Settings): PlaceInfo[] {
  return app.vault.getMarkdownFiles().filter(f => isPlaceFile(app, s, f)).map(f => placeInfo(app, s, f));
}
/* la nota a la que apunta [[enlace]] desde la nota del viaje */
export function resolve(app: App, link: string, from: string): TFile | null {
  return app.metadataCache.getFirstLinkpathDest(link, from);
}

async function ensureFolder(app: App, folder: string) {
  if (!folder) return;
  let cur = "";
  for (const part of folder.split("/")) {
    cur = cur ? `${cur}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(cur)) await app.vault.createFolder(cur);
  }
}
export { ensureFolder };
const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();

/* crea una nota de lugar (o devuelve la que ya hay con ese nombre en esa carpeta) */
export async function createPlace(app: App, s: Settings, name: string, city: string, country: string): Promise<TFile> {
  const folder = placeFolder(s, city);
  await ensureFolder(app, folder);
  const path = normalizePath((folder ? folder + "/" : "") + safeName(name) + ".md");
  const old = app.vault.getAbstractFileByPath(path);
  if (old instanceof TFile) return old;
  const fm: string[] = [];
  const q = (v: string) => /^[\w\sÀ-ÿ-]+$/.test(v) ? v : JSON.stringify(v);
  if (s.places.mode === "property" && s.places.key) fm.push(`${s.places.key}: ${q(s.places.value)}`);
  if (s.places.mode === "tag" && s.places.value) fm.push(`tags:\n  - ${s.places.value.replace(/^#/, "")}`);
  if (city) fm.push(`${s.props.city}: ${q(city)}`);
  if (country && s.props.country) fm.push(`${s.props.country}: ${q(country)}`);
  const body = fm.length ? `---\n${fm.join("\n")}\n---\n` : "";
  return app.vault.create(path, body);
}

/* ---------- iconos según la categoría (iconos Lucide que trae Obsidian) ---------- */
const ICONS: [RegExp, string][] = [
  [/templo|santuario|temple|shrine|iglesia|church|catedral|cathedral|mezquita|mosque|bas[ií]lica/i, "landmark"],
  [/museo|museum|galer[ií]a|gallery|arte|art/i, "palette"],
  [/restaurante|restaurant|comida|food|ramen|sushi|tapas|bar\b|tasca|izakaya/i, "utensils"],
  [/caf[eé]|coffee|cafeter[ií]a|brunch/i, "coffee"],
  [/mercado|market/i, "store"],
  [/tienda|shop|calle comercial|shopping|compras/i, "shopping-bag"],
  [/mirador|viewpoint|vista|torre|tower/i, "binoculars"],
  [/parque|park|jard[ií]n|garden|bosque|forest/i, "trees"],
  [/playa|beach|costa|lago|lake|r[ií]o|river/i, "waves"],
  [/monta[ñn]a|mountain|volc[aá]n|ruta|hike|senderismo/i, "mountain"],
  [/castillo|castle|palacio|palace|fortaleza/i, "castle"],
  [/cruce|crossing|plaza|square|calle|street|barrio|neighbo/i, "signpost"],
  [/m[uú]sica|music|concierto|concert|teatro|theat/i, "music"],
  [/noche|night|discoteca|club|cocteler[ií]a|cocktail|vino|wine/i, "wine"],
  [/hotel|alojamiento|hostal|ryokan|apartamento|lodging/i, "bed"],
  [/monumento|monument|ruinas|ruins|hist[oó]ric/i, "landmark"],
  [/onsen|spa|ba[ñn]os|bath/i, "droplets"],
];
export function iconFor(category: string): string {
  for (const [re, icon] of ICONS) if (re.test(category)) return icon;
  return "map-pin";
}

/* ---------- la app de mapas ---------- */
export function mapsUrl(app: MapsApp, name: string, city: string, loc: [number, number] | null): string {
  const q = encodeURIComponent([name, city].filter(Boolean).join(", "));
  if (app === "apple") return `https://maps.apple.com/?q=${encodeURIComponent(name)}` + (loc ? `&ll=${loc[0]},${loc[1]}` : city ? `&near=${encodeURIComponent(city)}` : "");
  if (app === "organic") return loc ? `om://map?v=1&ll=${loc[0]},${loc[1]}&n=${encodeURIComponent(name)}` : `om://search?query=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${loc ? `${loc[0]},${loc[1]}` : q}`;
}
/* abrir la Wallet del móvil (no hay enlace a un pase concreto) */
export function walletUrl(): string | null {
  if (Platform.isIosApp) return "shoebox://";
  if (Platform.isAndroidApp) return "https://wallet.google.com/";
  return null;
}
/* el nombre del servicio de un enlace de nube («Google Drive», «iCloud»…) */
export function cloudName(url: string): string {
  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
  if (/drive\.google|docs\.google/.test(host)) return "Google Drive";
  if (/icloud/.test(host)) return "iCloud";
  if (/dropbox/.test(host)) return "Dropbox";
  if (/onedrive|1drv|sharepoint/.test(host)) return "OneDrive";
  if (/box\.com/.test(host)) return "Box";
  if (/proton/.test(host)) return "Proton Drive";
  return host;
}
