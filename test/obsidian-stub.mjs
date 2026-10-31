// Lo mínimo de «obsidian» para probar el Markdown en Node (parseYaml / stringifyYaml con js-yaml).
import yaml from "js-yaml";
export const parseYaml = s => yaml.load(s, { schema: yaml.JSON_SCHEMA });
export const stringifyYaml = o => yaml.dump(o, { lineWidth: -1 });
export const getLanguage = () => globalThis.__lang || "es";
export const moment = { locale: () => globalThis.__lang || "es" };
export const normalizePath = p => p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
export const Platform = { isPhone: false, isMobile: false, isIosApp: false, isAndroidApp: false };
export class TFile {}
export const setIcon = () => {};
