// Un Obsidian de mentira para pintar la vista de Cool Trip en Chromium (test/harness.mjs). Solo lo que usa el plugin.
import yaml from "js-yaml";
const P = HTMLElement.prototype;
function opts(el, o) {
  if (!o) return el;
  if (typeof o === "string") { el.className = o; return el; }
  if (o.cls) el.className = Array.isArray(o.cls) ? o.cls.join(" ") : o.cls;
  if (o.text != null) el.textContent = o.text;
  if (o.attr) for (const [k, v] of Object.entries(o.attr)) if (v != null) el.setAttribute(k, v);
  return el;
}
window.createEl = (tag, o) => opts(document.createElement(tag), o);
window.createSvg = (tag, o) => opts(document.createElementNS("http://www.w3.org/2000/svg", tag), o);
window.createFragment = () => document.createDocumentFragment();
P.createEl = function (tag, o) { const el = window.createEl(tag, o); this.appendChild(el); return el; };
P.createDiv = function (o) { return this.createEl("div", o); };
P.createSpan = function (o) { return this.createEl("span", o); };
P.empty = function () { while (this.firstChild) this.removeChild(this.firstChild); };
P.setText = function (t) { this.textContent = t; };
P.addClass = function (...c) { this.classList.add(...c); };
P.removeClass = function (...c) { this.classList.remove(...c); };
P.toggleClass = function (c, on) { this.classList.toggle(c, !!on); };
P.setCssProps = function (props) { for (const [k, v] of Object.entries(props)) this.style.setProperty(k, v); };
for (const k of ["addClass", "removeClass", "toggleClass", "setCssProps", "empty"]) SVGElement.prototype[k] = P[k];

export const parseYaml = s => yaml.load(s, { schema: yaml.JSON_SCHEMA });
export const stringifyYaml = o => yaml.dump(o, { lineWidth: -1 });
export const getLanguage = () => "es";
export const moment = { locale: () => "es" };
export const normalizePath = p => p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
export const Platform = { get isPhone() { return !!window.__phone; }, isIosApp: false, isAndroidApp: false, get isMobile() { return !!window.__phone; } };
/* iconos: un trazo genérico de Lucide (solo para ver dónde van) */
const PATHS = { plane: "M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4z", check: "M5 12l5 5L20 7", plus: "M12 5v14M5 12h14", minus: "M5 12h14", x: "M6 6l12 12M18 6L6 18",
  "map-pin": "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z", pencil: "M4 20h4L19 9l-4-4L4 16z",
  "chevron-down": "M6 9l6 6 6-6", "chevron-right": "M9 6l6 6-6 6", "arrow-up-right": "M7 17L17 7M7 7h10v10", "arrow-right": "M5 12h14M13 6l6 6-6 6",
  utensils: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3-3 6v3h3v9", "bed-double": "M3 18V6M3 13h18v5M21 13v-1a3 3 0 0 0-3-3h-7v4",
  ticket: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zM14 5v12",
  "train-front": "M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM4 10h16", wallet: "M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h16V9H5a2 2 0 0 1-2-2z",
  "file-text": "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5", calendar: "M4 5h16v16H4zM3 10h18M8 3v4M16 3v4",
  image: "M4 4h16v16H4zM3 16l5-5 4 4 3-3 6 6", home: "M3 11l9-7 9 7v9H4z", landmark: "M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z" };
export function setIcon(el, name) { el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name] || "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16"}"/></svg>`; }
export class Notice { constructor(m) { console.log("Notice:", m); } }
export class TFile { constructor(path, fm) { this.path = path; this.name = path.split("/").pop(); this.basename = this.name.replace(/\.md$/, ""); this.extension = "md"; this.fm = fm || {};
  const parts = path.split("/"); parts.pop(); this.parent = { path: parts.join("/") || "/" }; } }
export class TFolder {}
export class Component { load() {} unload() {} registerEvent() {} }
export class ItemView { constructor(leaf) { this.leaf = leaf; this.app = leaf.app; this.containerEl = document.createElement("div"); this.contentEl = this.containerEl.createDiv({ cls: "view-content" }); } }
export class TextFileView extends ItemView { requestSave() { window.__saved = this.data; } }
export class MarkdownView extends ItemView {}
export class Modal { constructor(app) { this.app = app; this.containerEl = document.createElement("div"); this.containerEl.className = "modal-container"; this.modalEl = this.containerEl.createDiv({ cls: "modal" }); this.modalEl.createDiv({ cls: "modal-close-button" }); this.titleEl = this.modalEl.createDiv(); this.contentEl = this.modalEl.createDiv({ cls: "modal-content" }); }
  open() { document.body.appendChild(this.containerEl); this.onOpen?.(); } close() { this.containerEl.remove(); this.onClose?.(); } }
export class Plugin {}
export class PluginSettingTab { constructor(app, plugin) { this.app = app; this.plugin = plugin; this.containerEl = document.createElement("div"); } }
/* las filas de ajustes de Obsidian, con su DOM (setting-item › info + control), para ver la sección de la Cool Bar */
export class Setting {
  constructor(el) { this.settingEl = el.createDiv({ cls: "setting-item" }); const info = this.settingEl.createDiv({ cls: "setting-item-info" });
    this.nameEl = info.createDiv({ cls: "setting-item-name" }); this.descEl = info.createDiv({ cls: "setting-item-description" }); this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" }); }
  setName(n) { this.nameEl.textContent = n; return this; } setDesc(d) { this.descEl.textContent = d; return this; }
  setHeading() { this.settingEl.addClass("setting-item-heading"); return this; } setClass(c) { this.settingEl.addClass(c); return this; }
  addDropdown(cb) { const s = this.controlEl.createEl("select", { cls: "dropdown" });
    const api = { addOptions(o) { for (const [k, v] of Object.entries(o)) s.createEl("option", { text: v, attr: { value: k } }); return api; }, setValue(v) { s.value = v; return api; }, onChange(f) { s.onchange = () => f(s.value); return api; } };
    cb(api); return this; }
  addToggle(cb) { this.settingEl.addClass("mod-toggle"); const d = this.controlEl.createDiv({ cls: "checkbox-container" });
    const api = { setValue(v) { d.toggleClass("is-enabled", v); return api; }, onChange(f) { d.onclick = () => { d.classList.toggle("is-enabled"); f(d.classList.contains("is-enabled")); }; return api; } };
    cb(api); return this; }
  addExtraButton(cb) { const b = this.controlEl.createDiv({ cls: "clickable-icon extra-setting-button" });
    const api = { setIcon(i) { b.textContent = i === "arrow-up" ? "↑" : "↓"; return api; }, setTooltip() { return api; }, setDisabled(x) { b.toggleClass("is-disabled", x); return api; }, onClick(f) { b.onclick = f; return api; } };
    cb(api); return this; }
}
