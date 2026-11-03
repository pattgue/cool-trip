/* Las coordenadas de un lugar, buscadas por su nombre y su ciudad en OpenStreetMap (Nominatim: gratis y sin cuenta).
   Solo se busca si está activado en Ajustes › 4, y como mucho una vez por segundo (lo pide Nominatim). */
import { requestUrl } from "obsidian";
import type { App, TFile } from "obsidian";
import type { Settings } from "./types";
import { propKey } from "./settings";
import { allPlaces } from "./places";

let last = 0;
const wait = (ms: number) => new Promise(r => window.setTimeout(r, ms));

export async function geocode(name: string, city: string, country = ""): Promise<[number, number] | null> {
  const q = [name, city, country].map(x => x.trim()).filter(Boolean).join(", ");
  if (!q) return null;
  const gap = last + 1100 - Date.now();
  if (gap > 0) await wait(gap);
  last = Date.now();
  try {
    const r = await requestUrl({ url: `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
      headers: { "User-Agent": "Cool Trip (Obsidian plugin)" }, throw: false });
    const hit = Array.isArray(r.json) ? (r.json as { lat?: string; lon?: string }[])[0] : undefined;
    const lat = parseFloat(hit?.lat ?? ""), lon = parseFloat(hit?.lon ?? "");
    return isFinite(lat) && isFinite(lon) ? [lat, lon] : null;
  } catch { return null; }
}

/* el país de una ciudad, en el idioma de Obsidian («Rome» → «Italy»; «Roma» → «Italia»), para no tener que elegirlo */
export async function countryOf(city: string, lang: string): Promise<string> {
  const q = city.trim();
  if (!q) return "";
  const gap = last + 1100 - Date.now();
  if (gap > 0) await wait(gap);
  last = Date.now();
  try {
    const r = await requestUrl({ url: `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&featureType=settlement&accept-language=${lang}&q=${encodeURIComponent(q)}`,
      headers: { "User-Agent": "Cool Trip (Obsidian plugin)" }, throw: false });
    const hit = Array.isArray(r.json) ? (r.json as { address?: { country?: string } }[])[0] : undefined;
    return hit?.address?.country || "";
  } catch { return ""; }
}

/* escribe las coordenadas en la nota (solo si no tiene) y devuelve si las ha encontrado */
export async function locate(app: App, s: Settings, f: TFile, name: string, city: string, country = ""): Promise<boolean> {
  if (!s.props.location) return false;
  const loc = await geocode(name, city, country);
  if (!loc) return false;
  await app.fileManager.processFrontMatter(f, (m: Record<string, unknown>) => {
    const key = propKey(s, "location", m);
    if (m[key] == null || m[key] === "") m[key] = loc.map(x => String(Math.round(x * 1e6) / 1e6));
  });
  return true;
}

/* los lugares que aún no tienen coordenadas (para el botón de los ajustes) */
export const unlocated = (app: App, s: Settings) => allPlaces(app, s).filter(p => !p.loc && p.city);

export async function locateAll(app: App, s: Settings, onStep?: (done: number, total: number) => void): Promise<number> {
  const list = unlocated(app, s);
  let found = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (await locate(app, s, p.file, p.name, p.city, p.country)) found++;
    onStep?.(i + 1, list.length);
  }
  return found;
}
