/* Piezas pequeñas de la interfaz de Cool Trip (botones, viajeros, código de barras, perforaciones…). */
import { setIcon } from "obsidian";
import { h, svg } from "./dom";
import type { Kid } from "./dom";
import { t } from "./i18n";

/* la paleta del billete: sólida, con tinta negra encima (igual en tema claro y oscuro) */
export const PALETTE: { id: string; hex: string }[] = [
  { id: "bermellon", hex: "#E8613C" }, { id: "mostaza", hex: "#EDC14B" }, { id: "pistacho", hex: "#B5D69A" },
  { id: "cielo", hex: "#9CC9F0" }, { id: "lavanda", hex: "#C2B3F5" }, { id: "rosa", hex: "#F5AFC0" },
];
/* cada paleta, tres colores: el de la portada, su compañero y uno propio que solo sale aquí. Los destinos (y las barras del coste) los usan en orden */
const SCHEMES: Record<string, string[]> = {
  bermellon: ["#E8613C", "#9CC9F0", "#7FC8B8"],     // + aguamarina
  mostaza: ["#EDC14B", "#C2B3F5", "#F09A72"],       // + melocotón
  pistacho: ["#B5D69A", "#F5AFC0", "#F3D9A4"],      // + arena
  cielo: ["#9CC9F0", "#E8613C", "#FFC9A8"],         // + albaricoque
  lavanda: ["#C2B3F5", "#EDC14B", "#8FD3C1"],       // + menta
  rosa: ["#F5AFC0", "#B5D69A", "#A8B9F2"],          // + vincapervinca
};
let scheme = SCHEMES.bermellon;
/* el color de un viaje: el de la portada o, si la portada es una imagen, el último elegido (accent) */
export const accentOf = (cover: string, accent: string) => paletteId(cover) || (SCHEMES[accent] ? accent : "bermellon");
export function useAccent(id: string) { scheme = SCHEMES[id] || SCHEMES.bermellon; }
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
export const coverHex = (cover: string, accent = "bermellon") => hexOf(accentOf(cover, accent));
/* el color de la paleta más cercano a un color cualquiera (para una portada con imagen) */
export function nearestPalette(r: number, g: number, b: number): string {
  let best = "bermellon", d = Infinity;
  for (const p of PALETTE) {
    const n = parseInt(p.hex.slice(1), 16), dr = (n >> 16) - r, dg = ((n >> 8) & 255) - g, db = (n & 255) - b;
    const x = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
    if (x < d) { d = x; best = p.id; }
  }
  return best;
}
export const destHex = (i: number) => scheme[i % scheme.length];
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
/* el color de una imagen (los píxeles más vivos) → el color de la paleta más cercano; null si la imagen no deja leerse */
export function imageAccent(src: string): Promise<string | null> {
  return new Promise(res => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = createEl("canvas"); c.width = 32; c.height = 32;
        const g = c.getContext("2d");
        if (!g) { res(null); return; }
        g.drawImage(img, 0, 0, 32, 32);
        const d = g.getImageData(0, 0, 32, 32).data;
        let r = 0, gr = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const k = (mx - mn) / 255 * (mx / 255) + 0.02;                // más peso a lo vivo y luminoso
          r += d[i] * k; gr += d[i + 1] * k; b += d[i + 2] * k; w += k;
        }
        res(w ? nearestPalette(r / w, gr / w, b / w) : null);
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.src = src;
  });
}
/* el avión de papel de la portada: el trazo exacto del diseño (el «send» de Lucide ha cambiado de forma) */
export const paperPlane = () => svg("svg", { width: 34, height: 34, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2,
  "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "ct-plane" }, svg("path", { d: "M22 2L11 13M22 2l-7 20-4-9-9-4z" }));
export const notchV = () => h("div", { cls: "ct-notch-v", attr: { "aria-hidden": "true" } });
export const notchH = () => h("div", { cls: "ct-notch-h", attr: { "aria-hidden": "true" } });

/* una etiqueta pequeña encima de un valor */
export const label = (text: string) => h("span", { cls: "ct-label" }, text);
export const kicker = (text: string) => h("span", { cls: "ct-kicker" }, text);
