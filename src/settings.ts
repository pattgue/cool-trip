/* Los ajustes de Cool Trip: valores por defecto (en el idioma de Obsidian) y cómo se reconoce cada nota. */
import type { PropNames, Recog, Settings } from "./types";

const PROPS: Record<"es" | "en", PropNames> = {
  es: { start: "inicio", end: "fin", destinations: "destinos", travelers: "viajeros", cover: "portada",
    location: "coordenadas", city: "ciudad", category: "categoría", price: "precio", rating: "valoración", visited: "visitado", photo: "portada" },
  en: { start: "start", end: "end", destinations: "destinations", travelers: "travelers", cover: "cover",
    location: "coordinates", city: "city", category: "category", price: "price", rating: "rating", visited: "visited", photo: "cover" },
};
export const suggestedProps = (lang: "es" | "en"): PropNames => ({ ...PROPS[lang] });
export const AUTO_FOLDERS = { es: { trips: "Viajes", places: "Lugares" }, en: { trips: "Trips", places: "Places" } };

const KIND = { es: { key: "tipo", trip: "viaje", place: "lugar" }, en: { key: "type", trip: "trip", place: "place" } };

export function defaultSettings(lang: "es" | "en"): Settings {
  const kind = KIND[lang];
  return {
    /* por defecto, por carpeta: así Cool Trip no añade ninguna propiedad para reconocer las notas */
    trips: { mode: "folder", key: kind.key, value: kind.trip, folder: AUTO_FOLDERS[lang].trips },
    places: { mode: "folder", key: kind.key, value: kind.place, folder: AUTO_FOLDERS[lang].places },
    tripFolder: "", placeFolder: "", autoOrganize: false, placeView: true,
    props: suggestedProps(lang),
    files: { cloud: true, wallet: true, device: false, vault: false, vaultFolder: lang === "es" ? "Archivos" : "Files" },
    maps: { app: "google", modes: ["walk", "transit"], geocode: true },
    bases: { trips: "", places: "" },
    basesMade: { trips: "", places: "" },
    baseCities: [],
    done: [],
    countries: {},
    language: lang,
  };
}

/* antes había una sola carpeta para las dos bases («folder») */
function mergeBases(d: Settings["bases"], saved: Partial<Settings["bases"]> & { folder?: string } | undefined): Settings["bases"] {
  const old = typeof saved?.folder === "string" ? saved.folder : "";
  return { trips: saved?.trips ?? old ?? d.trips, places: saved?.places ?? old ?? d.places };
}
/* mezcla lo guardado con los valores por defecto (los ajustes nuevos de versiones futuras se rellenan solos) */
export function mergeSettings(saved: Partial<Settings> | null | undefined, lang: "es" | "en"): Settings {
  const d = defaultSettings(saved?.language || lang);
  if (!saved) return d;
  return {
    ...d, ...saved,
    trips: { ...d.trips, ...saved.trips }, places: { ...d.places, ...saved.places },
    props: { ...d.props, ...saved.props }, files: { ...d.files, ...saved.files },
    maps: { ...d.maps, ...saved.maps }, bases: mergeBases(d.bases, saved.bases),
    basesMade: { ...d.basesMade, ...saved.basesMade },
    baseCities: Array.isArray(saved.baseCities) ? saved.baseCities : [],
    done: Array.isArray(saved.done) ? saved.done : [],
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

/* El móvil y el ordenador pueden tener Obsidian en idiomas distintos y compartir los ajustes con Sync: los valores por
   defecto de un idioma («tipo: viaje», «inicio»…) también reconocen y leen los del otro («type: trip», «start»…). */
const low = (x: string) => x.trim().toLowerCase();
const other = (l: "es" | "en"): "es" | "en" => l === "es" ? "en" : "es";
export function twinRecog(r: Recog, kind: "trip" | "place"): Recog | null {
  if (r.mode !== "property") return null;
  for (const l of ["es", "en"] as const) {
    if (low(r.key) === KIND[l].key && low(r.value) === KIND[l][kind]) return { ...r, key: KIND[other(l)].key, value: KIND[other(l)][kind] };
  }
  return null;
}
export function recognizes(r: Recog, kind: "trip" | "place", path: string, fm: Record<string, unknown> | undefined, tags: string[]): boolean {
  const twin = twinRecog(r, kind);
  return matches(r, path, fm, tags) || (!!twin && matches(twin, path, fm, tags));
}
/* el nombre de una propiedad en esta nota: el de los ajustes o, si la nota usa los del otro idioma, el de ese idioma */
export function propKey(s: Settings, k: keyof PropNames, fm: Record<string, unknown>): string {
  const name = s.props[k];
  if (!name || name in fm) return name;
  for (const l of ["es", "en"] as const) {
    if (PROPS[l][k] !== name) continue;
    const mine = Object.values(PROPS[l]), twin = Object.values(PROPS[other(l)]);
    if (PROPS[other(l)][k] in fm || (twin.some(n => n in fm) && !mine.some(n => n in fm))) return PROPS[other(l)][k];
  }
  return name;
}
/* Si ninguna nota usa el reconocimiento por defecto de los ajustes pero sí el del otro idioma, los ajustes pasan a ese
   idioma (reconocimiento y propiedades por defecto): así los viajes nuevos se escriben como los que ya hay. */
export function adaptToVault(s: Settings, notes: { path: string; fm: Record<string, unknown> | undefined; tags: string[] }[]): boolean {
  const twin = twinRecog(s.trips, "trip");
  if (!twin || notes.some(n => matches(s.trips, n.path, n.fm, n.tags)) || !notes.some(n => matches(twin, n.path, n.fm, n.tags))) return false;
  const from = low(s.trips.key) === KIND.es.key ? "es" : "en", to = other(from);
  s.trips = { ...s.trips, key: twin.key, value: twin.value };
  const pt = twinRecog(s.places, "place");
  if (pt && low(s.places.key) === KIND[from].key) s.places = { ...s.places, key: pt.key, value: pt.value };
  for (const k of Object.keys(s.props) as (keyof PropNames)[]) if (s.props[k] === PROPS[from][k]) s.props[k] = PROPS[to][k];
  if (s.files.vaultFolder === (from === "es" ? "Archivos" : "Files")) s.files.vaultFolder = to === "es" ? "Archivos" : "Files";
  s.language = to;
  return true;
}

/* dónde se guarda un viaje o un lugar nuevo (si se reconocen por carpeta, siempre dentro de esa carpeta) */
const clean = (f: string) => f.replace(/^\/+|\/+$/g, "");
const inside = (f: string, r: Recog) => r.mode !== "folder" || !clean(r.folder) || f === clean(r.folder) || f.startsWith(clean(r.folder) + "/");
export function tripFolder(s: Settings): string {
  const f = s.autoOrganize ? AUTO_FOLDERS[s.language].trips : clean(s.tripFolder);
  return inside(f, s.trips) ? f : clean(s.trips.folder);
}
export function placeFolder(s: Settings, city: string): string {
  const f = s.autoOrganize ? [AUTO_FOLDERS[s.language].places, city.trim()].filter(Boolean).join("/") : clean(s.placeFolder);
  return inside(f, s.places) ? f : [clean(s.places.folder), s.autoOrganize ? city.trim() : ""].filter(Boolean).join("/");
}
/* el nombre de la misma propiedad en el otro idioma («categoría» ↔ «category»), o "" si no es uno de los nombres por defecto */
export function twinProp(name: string): string {
  for (const l of ["es", "en"] as const) {
    const k = (Object.keys(PROPS[l]) as (keyof PropNames)[]).find(x => PROPS[l][x] === name);
    if (k && PROPS[other(l)][k] !== name) return PROPS[other(l)][k];
  }
  return "";
}
