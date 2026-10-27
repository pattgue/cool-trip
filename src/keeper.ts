/* Las bases después de crearlas: Cool Trip solo toca lo suyo y solo cuando cambia algo.
   - Cada viaje sin ubicación toma la de un lugar de su primera ciudad (para el mapa de viajes).
   - El color de cada billete en las vistas de Cool Bases (el bloque marcado de su CSS libre).
   - La vista de cada ciudad nueva en la base de lugares (una sola vez: si la borras, no vuelve).
   También crea las bases y les añade el mapa o el diseño de Cool Bases cuando se instalan esos plugins. */
import { getIcon, normalizePath, parseYaml, stringifyYaml, TFile } from "obsidian";
import type { App } from "obsidian";
import type CoolTripPlugin from "./main";
import { placesBase, syncBase, tripColorsCss, tripsBase } from "./bases";
import type { BaseDoc, BaseEnv, BaseKind } from "./bases";
import { allPlaces, ensureFolder, isTripFile } from "./places";
import { propKey } from "./settings";
import { coverHex } from "./ui";
import { toList } from "./md";

/* ¿está activado este plugin? (Cool Bases, Maps) */
export function hasPlugin(app: App, id: string): boolean {
  const p = (app as unknown as { plugins?: { enabledPlugins?: Set<string> } }).plugins;
  return !!p?.enabledPlugins?.has(id);
}
/* el dibujo de un icono de Obsidian, para meterlo en una imagen SVG */
function iconSvg(name: string): string {
  const svg = getIcon(name);
  if (!svg) return "";
  const ser = new XMLSerializer();
  return Array.from(svg.children).map(c => ser.serializeToString(c).replace(/ xmlns="[^"]*"/g, "")).join("");
}

export class BaseKeeper {
  private timer = 0;
  private running = false;
  constructor(private plugin: CoolTripPlugin) {}
  get app() { return this.plugin.app; }
  env(): BaseEnv { return { cool: hasPlugin(this.app, "cool-bases"), maps: hasPlugin(this.app, "maps"), iconSvg }; }

  /* las ciudades de los lugares, en el orden en que aparecen */
  cities(): string[] {
    const seen = new Map<string, string>();
    for (const p of allPlaces(this.app, this.plugin.settings)) { const c = p.city.trim(); if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c); }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }
  file(kind: BaseKind): TFile | null {
    const p = this.plugin.settings.basesMade[kind], f = p ? this.app.vault.getAbstractFileByPath(p) : null;
    return f instanceof TFile ? f : null;
  }

  async create(kind: BaseKind, folder: string, path: string): Promise<void> {
    const s = this.plugin.settings, env = this.env();
    await ensureFolder(this.app, folder);
    const cities = kind === "places" ? this.cities() : [];
    const doc = kind === "trips" ? tripsBase(s, env) : placesBase(s, env, cities);
    if (kind === "trips") syncBase(doc, kind, s, env, { colors: await this.colors() });
    if (!(this.app.vault.getAbstractFileByPath(path) instanceof TFile)) await this.app.vault.create(normalizePath(path), stringifyYaml(doc));
    s.basesMade[kind] = path;
    if (kind === "places") s.baseCities = [...new Set([...s.baseCities, ...cities.map(c => c.toLowerCase())])];
    await this.plugin.saveSettings();
  }

  /* lo que falta en una base que ya existe: la vista Mapa (si está Maps) y las tarjetas de Cool Bases (si está) */
  /* lo que falta en una base que ya existe: todo el diseño (una base de antes de la 0.2, con una sola tabla), la vista Mapa
     (si está Maps) o las tarjetas de Cool Bases (si está) */
  async missing(kind: BaseKind): Promise<{ old: boolean; map: boolean; cool: boolean }> {
    const doc = await this.read(kind), env = this.env(), s = this.plugin.settings;
    if (!doc) return { old: false, map: false, cool: false };
    const fresh = kind === "trips" ? tripsBase(s, env) : placesBase(s, env, []);
    const old = !doc.views.some(v => fresh.views.some(f => f.type !== "map" && f.name === v.name));
    if (old) return { old, map: false, cool: false };
    const map = env.maps && !doc.views.some(v => v.type === "map");
    const ours = kind === "trips" ? [fresh.views[0].name, fresh.views[1].name] : [fresh.views[0].name];
    const cool = env.cool && doc.views.some(v => (v.type === "cards" || v.type === "table") && (ours.includes(v.name) || (kind === "places" && v.type === "cards" && s.baseCities.includes(v.name.toLowerCase()))));
    return { old, map, cool };
  }
  async upgrade(kind: BaseKind, what: { addMap?: boolean; useCool?: boolean }): Promise<void> {
    await this.edit(kind, async doc => syncBase(doc, kind, this.plugin.settings, this.env(), { ...what, colors: kind === "trips" ? await this.colors() : undefined }));
  }
  /* una base de antes: sus vistas pasan a ser las del diseño (con Cool Bases y Maps si están); se quedan las vistas que
     añadiste tú, y se quita solo la tabla que creaba Cool Trip (con el nombre de la base) */
  async rebuild(kind: BaseKind, oldName: string): Promise<void> {
    const s = this.plugin.settings, env = this.env(), cities = kind === "places" ? this.cities() : [];
    const colors = kind === "trips" ? await this.colors() : undefined;
    await this.edit(kind, doc => {
      const fresh = kind === "trips" ? tripsBase(s, env) : placesBase(s, env, cities);
      const keep = doc.views.filter(v => !(v.type === "table" && v.name === oldName) && !fresh.views.some(f => f.name === v.name));
      doc.filters = fresh.filters;
      doc.formulas = { ...doc.formulas, ...fresh.formulas };
      doc.properties = { ...fresh.properties, ...doc.properties };
      doc.views = [...fresh.views, ...keep];
      if (colors != null) syncBase(doc, kind, s, env, { colors });
      return true;
    });
    if (kind === "places") { s.baseCities = [...new Set([...s.baseCities, ...cities.map(c => c.toLowerCase())])]; await this.plugin.saveSettings(); }
  }

  private async read(kind: BaseKind): Promise<BaseDoc | null> {
    const f = this.file(kind);
    if (!f) return null;
    try {
      const doc = parseYaml(await this.app.vault.read(f)) as BaseDoc | null;
      return doc && typeof doc === "object" ? doc : null;
    } catch { return null; }                                // la base no es YAML válido: no se toca
  }
  private async edit(kind: BaseKind, fn: (doc: BaseDoc) => Promise<boolean> | boolean): Promise<void> {
    const f = this.file(kind), doc = await this.read(kind);
    if (!f || !doc) return;
    if (await fn(doc)) await this.app.vault.modify(f, stringifyYaml(doc));
  }

  /* el color de cada viaje: el de su paleta o, con foto, el último elegido (va en el bloque del viaje) */
  private async colors(): Promise<string> {
    const s = this.plugin.settings, out: { path: string; color: string }[] = [];
    for (const f of this.app.vault.getMarkdownFiles().filter(f => isTripFile(this.app, s, f)).sort((a, b) => a.path.localeCompare(b.path))) {
      const fm: Record<string, unknown> = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      const cv = fm[propKey(s, "cover", fm)], cover = typeof cv === "string" ? cv : "";
      const accent = /^>\s*\[!cool-trip\|([^\]]*)\]/im.exec(await this.app.vault.cachedRead(f))?.[1]?.trim() || "";
      out.push({ path: f.path, color: coverHex(cover, accent) });
    }
    return tripColorsCss(out);
  }

  /* ---------- al cambiar el vault (con un respiro, para no escribir a cada tecla) ---------- */
  schedule() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => { void this.run(); }, 2000);
  }
  cancel() { window.clearTimeout(this.timer); }
  async run() {
    if (this.running) { this.schedule(); return; }
    this.running = true;
    try {
      await this.locateTrips();
      const s = this.plugin.settings, env = this.env();
      if (this.file("trips")) { const colors = await this.colors(); await this.edit("trips", doc => syncBase(doc, "trips", s, env, { colors })); }
      if (this.file("places")) {
        const fresh = this.cities().filter(c => !s.baseCities.includes(c.toLowerCase()));
        if (fresh.length) {
          await this.edit("places", doc => syncBase(doc, "places", s, env, { newCities: fresh }));
          s.baseCities.push(...fresh.map(c => c.toLowerCase()));
          await this.plugin.saveSettings();
        }
      }
    } finally { this.running = false; }
  }
  /* los viajes sin ubicación: la de un lugar de su primera ciudad (si ya tiene alguno con coordenadas) */
  private async locateTrips() {
    const s = this.plugin.settings;
    if (!s.props.location || !s.props.destinations) return;
    const places = allPlaces(this.app, s).filter(p => p.loc).sort((a, b) => a.file.path.localeCompare(b.file.path));
    if (!places.length) return;
    for (const f of this.app.vault.getMarkdownFiles().filter(f => isTripFile(this.app, s, f))) {
      const fm: Record<string, unknown> = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      const key = propKey(s, "location", fm);
      if (fm[key] != null && fm[key] !== "") continue;
      const city = toList(fm[propKey(s, "destinations", fm)])[0]?.replace(/^\[\[|\]\]$/g, "").trim().toLowerCase();
      const p = city ? places.find(x => x.city.trim().toLowerCase() === city) : null;
      if (!p?.loc) continue;
      const [lat, lon] = p.loc;
      await this.app.fileManager.processFrontMatter(f, (m: Record<string, unknown>) => { if (m[key] == null || m[key] === "") m[key] = [String(lat), String(lon)]; });
    }
  }
}
