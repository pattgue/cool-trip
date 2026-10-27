/* Los ajustes de Cool Trip: valores por defecto (en el idioma de Obsidian) y cómo se reconoce cada nota. */
import type { PropNames, Recog, Settings } from "./types";

const PROPS: Record<"es" | "en", PropNames> = {
  es: { start: "inicio", end: "fin", destinations: "destinos", travelers: "viajeros", cover: "portada",
    location: "ubicación", city: "ciudad", country: "país", category: "categoría", price: "precio", rating: "valoración", visited: "visitado" },
  en: { start: "start", end: "end", destinations: "destinations", travelers: "travelers", cover: "cover",
    location: "location", city: "city", country: "country", category: "category", price: "price", rating: "rating", visited: "visited" },
};
export const suggestedProps = (lang: "es" | "en"): PropNames => ({ ...PROPS[lang] });
export const AUTO_FOLDERS = { es: { trips: "Viajes", places: "Lugares" }, en: { trips: "Trips", places: "Places" } };

export function defaultSettings(lang: "es" | "en"): Settings {
  const kind = lang === "es" ? { key: "tipo", trip: "viaje", place: "lugar" } : { key: "type", trip: "trip", place: "place" };
  return {
    trips: { mode: "property", key: kind.key, value: kind.trip, folder: AUTO_FOLDERS[lang].trips },
    places: { mode: "property", key: kind.key, value: kind.place, folder: AUTO_FOLDERS[lang].places },
    tripFolder: "", placeFolder: "", autoOrganize: false,
    props: suggestedProps(lang),
    files: { cloud: true, wallet: true, device: false, vault: false, vaultFolder: lang === "es" ? "Archivos" : "Files" },
    maps: { app: "google", modes: ["walk", "transit"] },
    bases: { folder: "" },
    visited: [],
    countries: {},
    language: lang,
  };
}

/* mezcla lo guardado con los valores por defecto (los ajustes nuevos de versiones futuras se rellenan solos) */
export function mergeSettings(saved: Partial<Settings> | null | undefined, lang: "es" | "en"): Settings {
  const d = defaultSettings(saved?.language || lang);
  if (!saved) return d;
  return {
    ...d, ...saved,
    trips: { ...d.trips, ...saved.trips }, places: { ...d.places, ...saved.places },
    props: { ...d.props, ...saved.props }, files: { ...d.files, ...saved.files },
    maps: { ...d.maps, ...saved.maps }, bases: { ...d.bases, ...saved.bases },
    visited: Array.isArray(saved.visited) ? saved.visited : [],
    countries: saved.countries && typeof saved.countries === "object" ? saved.countries : {},
  };
}

/* ¿esta nota es un viaje / un lugar? (frontmatter, etiquetas y ruta) */
export function matches(r: Recog, path: string, fm: Record<string, unknown> | undefined, tags: string[]): boolean {
  if (r.mode === "folder") {
    const f = r.folder.replace(/^\/+|\/+$/g, "");
    return !!f && (path === f || path.startsWith(f + "/"));
  }
  if (r.mode === "tag") {
    const want = r.value.replace(/^#/, "").toLowerCase();
    return !!want && tags.some(t => { const x = t.replace(/^#/, "").toLowerCase(); return x === want || x.startsWith(want + "/"); });
  }
  if (!r.key || !fm) return false;
  const v = fm[r.key];
  const want = r.value.trim().toLowerCase();
  const eq = (x: unknown) => (typeof x === "string" ? x : typeof x === "number" || typeof x === "boolean" ? String(x) : "").replace(/^\[\[|\]\]$/g, "").trim().toLowerCase() === want;
  return Array.isArray(v) ? v.some(eq) : eq(v);
}

/* dónde se guarda un viaje o un lugar nuevo */
export function tripFolder(s: Settings): string {
  return s.autoOrganize ? AUTO_FOLDERS[s.language].trips : s.tripFolder.replace(/^\/+|\/+$/g, "");
}
export function placeFolder(s: Settings, city: string): string {
  if (s.autoOrganize) return [AUTO_FOLDERS[s.language].places, city.trim()].filter(Boolean).join("/");
  return s.placeFolder.replace(/^\/+|\/+$/g, "");
}
