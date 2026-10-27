/* Las notas de lugar: encontrarlas, crearlas, su icono según la categoría y el enlace a la app de mapas. */
import { normalizePath, Platform, TFile } from "obsidian";
import type { App } from "obsidian";
import { placeFolder, propKey, recognizes } from "./settings";
import type { MapsApp, PropNames, Settings } from "./types";
import { toList } from "./md";

export interface PlaceInfo { file: TFile; name: string; city: string; country: string; category: string; price: string; loc: [number, number] | null;
  rating: number; visited: boolean; photo: string }

const fmOf = (app: App, f: TFile): Record<string, unknown> | undefined => app.metadataCache.getFileCache(f)?.frontmatter;
const str = (v: unknown): string => typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
export function tagsOf(app: App, f: TFile): string[] {
  const c = app.metadataCache.getFileCache(f);
  const out = (c?.tags || []).map(x => x.tag);
  return out.concat(toList(c?.frontmatter?.tags).map(x => "#" + x.replace(/^#/, "")));
}
export const isTripFile = (app: App, s: Settings, f: TFile | null | undefined): f is TFile =>
  !!f && f.extension === "md" && recognizes(s.trips, "trip", f.path, fmOf(app, f), tagsOf(app, f));
export const isPlaceFile = (app: App, s: Settings, f: TFile | null | undefined): f is TFile =>
  !!f && f.extension === "md" && recognizes(s.places, "place", f.path, fmOf(app, f), tagsOf(app, f));

export function readLoc(x: unknown): [number, number] | null {
  const nums = (Array.isArray(x) ? x.map(str).join(",") : str(x)).match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const [a, b] = [parseFloat(nums[0]), parseFloat(nums[1])];
  return Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] : null;
}
/* la valoración: un número (4) o estrellas («⭐⭐⭐⭐»); visitado: una casilla o un sí */
const stars = (v: unknown): number => { const x = str(Array.isArray(v) ? v[0] : v); const n = (x.match(/⭐|★/g) || []).length; return n || Math.min(5, parseInt(x, 10) || 0); };
const isYes = (v: unknown): boolean => v === true || /^(true|s[ií]|yes|x|1|✓)$/i.test(str(v).trim());
export function placeInfo(app: App, s: Settings, f: TFile): PlaceInfo {
  const fm = fmOf(app, f) || {};
  const get = (k: keyof PropNames) => { const v = fm[propKey(s, k, fm)]; return (Array.isArray(v) ? v.map(str).join(", ") : str(v)).replace(/^\[\[|\]\]$/g, ""); };
  return { file: f, name: f.basename, city: get("city"), country: get("country"), category: get("category"),
    price: get("price"), loc: readLoc(fm[propKey(s, "location", fm)]), rating: stars(fm[propKey(s, "rating", fm)]),
    visited: isYes(fm[propKey(s, "visited", fm)]), photo: get("photo") };
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

/* ---------- iconos según la categoría (iconos Lucide que trae Obsidian), con su color y su familia ---------- */
/* el color es un id de la paleta del billete; la familia agrupa las vistas por ciudad de la base de lugares (ver, comer, pasear…) */
export type Family = "see" | "eat" | "walk" | "sleep" | "other";
export const ICONS: [RegExp, string, string, Family][] = [
  [/templo|santuario|temple|shrine|iglesia|church|catedral|cathedral|mezquita|mosque|bas[ií]lica/i, "landmark", "lavanda", "see"],
  [/museo|museum|galer[ií]a|gallery|arte|art/i, "palette", "cielo", "see"],
  [/restaurante|restaurant|comida|food|ramen|sushi|tapas|bar\b|tasca|izakaya/i, "utensils", "bermellon", "eat"],
  [/caf[eé]|coffee|cafeter[ií]a|brunch/i, "coffee", "rosa", "eat"],
  [/mercado|market/i, "store", "mostaza", "eat"],
  [/tienda|shop|calle comercial|shopping|compras/i, "shopping-bag", "mostaza", "walk"],
  [/mirador|viewpoint|vista|torre|tower/i, "binoculars", "pistacho", "see"],
  [/parque|park|jard[ií]n|garden|bosque|forest/i, "trees", "pistacho", "walk"],
  [/playa|beach|costa|lago|lake|\br[ií]o\b|river/i, "waves", "cielo", "walk"],
  [/monta[ñn]a|mountain|volc[aá]n|ruta|hike|senderismo/i, "mountain", "pistacho", "walk"],
  [/castillo|castle|palacio|palace|fortaleza/i, "castle", "lavanda", "see"],
  [/cruce|crossing|plaza|square|calle|street|barrio|neighbo/i, "signpost", "cielo", "walk"],
  [/m[uú]sica|music|concierto|concert|teatro|theat/i, "music", "rosa", "see"],
  [/noche|night|discoteca|club|cocteler[ií]a|cocktail|vino|wine/i, "wine", "bermellon", "eat"],
  [/hotel|alojamiento|hostal|ryokan|apartamento|lodging/i, "bed", "lavanda", "sleep"],
  [/monumento|monument|ruinas|ruins|hist[oó]ric/i, "landmark", "lavanda", "see"],
  [/onsen|spa|ba[ñn]os|bath/i, "droplets", "cielo", "see"],
];
export const OTHER_ICON: [string, string, Family] = ["map-pin", "cielo", "other"];
const catOf = (category: string) => ICONS.find(([re]) => re.test(category));
export function iconFor(category: string): string { return catOf(category)?.[1] || OTHER_ICON[0]; }
export function catColor(category: string): string { return catOf(category)?.[2] || OTHER_ICON[1]; }
export function catFamily(category: string): Family { return catOf(category)?.[3] || OTHER_ICON[2]; }

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
