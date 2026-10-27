/* Piezas pequeñas de la interfaz de Cool Trip (botones, viajeros, código de barras, perforaciones…). */
import { setIcon } from "obsidian";
import { h } from "./dom";
import type { Kid } from "./dom";
import { t } from "./i18n";

/* la paleta del billete: sólida, con tinta negra encima (igual en tema claro y oscuro) */
export const PALETTE: { id: string; hex: string }[] = [
  { id: "bermellon", hex: "#E8613C" }, { id: "mostaza", hex: "#EDC14B" }, { id: "pistacho", hex: "#B5D69A" },
  { id: "cielo", hex: "#9CC9F0" }, { id: "lavanda", hex: "#C2B3F5" }, { id: "rosa", hex: "#F5AFC0" },
];
const DEST_ORDER = ["bermellon", "cielo", "pistacho", "lavanda", "mostaza", "rosa"];
const PEOPLE_ORDER = ["lavanda", "pistacho", "rosa", "mostaza", "cielo", "bermellon"];
const hexOf = (id: string) => PALETTE.find(p => p.id === id)!.hex;
export const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/* «bermellón», «Bermellon», «vermilion»… → id de la paleta, o null si la portada es una imagen */
export function paletteId(cover: string): string | null {
  const c = plain(cover);
  if (!c) return "bermellon";
  const en: Record<string, string> = { vermilion: "bermellon", mustard: "mostaza", pistachio: "pistacho", sky: "cielo", lavender: "lavanda", pink: "rosa" };
  if (PALETTE.some(p => p.id === c)) return c;
  return en[c] || null;
}
export const coverHex = (cover: string) => hexOf(paletteId(cover) || "bermellon");
export const destHex = (i: number) => hexOf(DEST_ORDER[i % DEST_ORDER.length]);
export const personHex = (i: number) => hexOf(PEOPLE_ORDER[i % PEOPLE_ORDER.length]);

export function icon(name: string, cls = "ct-ico"): HTMLElement {
  const el = h("span", { cls, attr: { "aria-hidden": "true" } });
  setIcon(el, name);
  return el;
}
type Click = (ev: MouseEvent) => void;
export function button(text: Kid, cls: string, onClick?: Click, attr: Record<string, string> = {}): HTMLButtonElement {
  const b = h("button", { cls, attr: { type: "button", ...attr } }, text);
  if (onClick) b.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); onClick(ev); });
  return b;
}
export function iconButton(name: string, label: string, onClick: Click, cls = "ct-ibtn"): HTMLButtonElement {
  return button(icon(name), cls, onClick, { "aria-label": label });
}
export const pill = (iconName: string | null, text: string, onClick: Click, cls = "ct-pill") =>
  button([iconName ? icon(iconName) : null, h("span", null, text)], cls, onClick);

/* viajeros */
export function avatar(name: string, index: number, cls = "ct-avatar"): HTMLElement {
  const el = h("span", { cls, attr: { "aria-hidden": "true" } }, (name.trim()[0] || "?").toUpperCase());
  el.setCssProps({ "--ct-person": personHex(index) });
  return el;
}
export function personChip(name: string, index: number, on: boolean, onClick: Click | null, cls = "ct-person"): HTMLElement {
  const b = button([avatar(name, index), h("span", null, name), icon(on ? "check" : "plus", "ct-ico ct-ico-sm")], cls + (on ? " is-on" : ""), onClick || undefined,
    { "aria-pressed": String(on) });
  return b;
}
export function miniPerson(name: string, index: number, on: boolean, onClick: Click | null): HTMLElement {
  const b = button([avatar(name, index, "ct-avatar ct-avatar-xs"), h("span", null, name)], "ct-mini-person" + (on ? " is-on" : ""), onClick || undefined,
    { "aria-pressed": String(on), "aria-label": t("travelersFor", { p: name }) });
  return b;
}
export function faces(names: string[], all: string[]): HTMLElement {
  return h("span", { cls: "ct-faces", attr: { "aria-label": names.join(", ") } },
    names.map(n => avatar(n, Math.max(0, all.indexOf(n)), "ct-avatar ct-avatar-face")));
}

/* el código de barras: barras que se estiran hasta llenar el ancho */
export function barcode(seed: string, caption: string | null, height = 38): HTMLElement {
  const bars = h("div", { cls: "ct-barcode-bars", attr: { "aria-hidden": "true" } });
  bars.setCssProps({ "--ct-bar-h": height + "px" });
  const src = (seed || "COOLTRIP").repeat(8).slice(0, 70);
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    const bar = bars.createSpan({ cls: "ct-bar" });
    bar.setCssProps({ "--ct-grow": String(1 + (c + i) % 3) });
    const gap = bars.createSpan({ cls: "ct-gap" });
    gap.setCssProps({ "--ct-grow": String(1 + (c * 7 + i) % 3) });
  }
  return h("div", { cls: "ct-barcode" }, bars, caption ? h("span", { cls: "ct-barcode-cap" }, caption) : null);
}
export const notchV = () => h("div", { cls: "ct-notch-v", attr: { "aria-hidden": "true" } });
export const notchH = () => h("div", { cls: "ct-notch-h", attr: { "aria-hidden": "true" } });

/* una etiqueta pequeña encima de un valor */
export const label = (text: string) => h("span", { cls: "ct-label" }, text);
export const kicker = (text: string) => h("span", { cls: "ct-kicker" }, text);
