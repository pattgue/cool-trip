/* Ajustes › Cool Trip: los siete pasos del boceto (Tus notas, Propiedades, Archivos, Mapas, Bases, Cool Bar, Listo).
   Se sigue el boceto; solo cambia lo que no cabe en el hueco que da Obsidian. Cada cambio se guarda al momento.
   Con sitio, los pasos van a la izquierda; si es estrecho (o en el móvil), en una fila de números arriba. El ancho se mide
   con un ResizeObserver (no con container queries: Obsidian dimensiona esta pestaña por su contenido y una «container
   query» la encogería). Las vistas previas de la nota (la reserva del paso 3 y la portada del paso 7) son las piezas de
   verdad de la vista del viaje, pintadas con un viaje de ejemplo que no se guarda en ninguna parte: en el ordenador, su
   versión de escritorio (escalada para que quepa); en el móvil, la del móvil. */
import { App, Notice, Platform, PluginSettingTab, TFolder } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t, locale } from "./i18n";
import { thisDevice } from "./cool-kit/kit";
import type { Device } from "./cool-kit/kit";
import { defaultSettings } from "./settings";
import { parseTrip } from "./md";
import { fitRoutes } from "./plan";
import type { Trip } from "./types";
import { button, icon } from "./ui";
import { stepNotes } from "./settings-steps/notes";
import { stepProps } from "./settings-steps/props";
import { stepFiles } from "./settings-steps/files";
import { stepMaps } from "./settings-steps/maps";
import { stepBases } from "./settings-steps/bases";
import { stepBar } from "./settings-steps/bar";
import { stepReady } from "./settings-steps/ready";
const STEPS = 7;

export class CoolTripSettingTab extends PluginSettingTab {
  plugin: CoolTripPlugin;
  step = 1;
  barDevice: Device = thisDevice();
  ro: ResizeObserver | null = null;
  closePicker: (() => void) | null = null;
  constructor(app: App, plugin: CoolTripPlugin) { super(app, plugin); this.plugin = plugin; }

  save() { void this.plugin.saveSettings(); }
  folders(): string[] {
    return this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder && f.path !== "/").map(f => f.path).sort((a, b) => a.localeCompare(b));
  }
  vaultProps(): Set<string> {
    const out = new Set<string>();
    for (const f of this.app.vault.getMarkdownFiles()) for (const k of Object.keys(this.app.metadataCache.getFileCache(f)?.frontmatter || {})) out.add(k);
    return out;
  }
  /* el tipo que Obsidian tiene asignado a una propiedad («» si aún no tiene) */
  propType(name: string): string {
    const m = (this.app as unknown as { metadataTypeManager?: { getAssignedWidget?: (n: string) => string | null; properties?: Record<string, { type?: string; widget?: string }> } }).metadataTypeManager;
    const p = m?.properties?.[name.toLowerCase()];
    return m?.getAssignedWidget?.(name) || p?.widget || p?.type || "";
  }
  go(step: number) { this.step = step; this.display(); this.containerEl.scrollTop = 0; }

  display(): void {
    const el = this.containerEl, s = this.plugin.settings;
    this.closePicker?.();
    el.empty();
    el.addClass("ct-root", "ct-settings");
    el.toggleClass("is-phone", Platform.isPhone);
    const nav = h("nav", { cls: "ct-set-nav", attr: { "aria-label": t("s.subtitle") } },
      h("div", { cls: "ct-set-brand" }, h("span", { cls: "ct-set-logo" }, t("s.title")), h("span", { cls: "ct-sub" }, t("s.subtitle"))));
    const list = nav.createDiv({ cls: "ct-set-steps" });
    for (let i = 1; i <= STEPS; i++) {
      /* verde solo si el paso está hecho (se pasó con «Siguiente»); el actual, en violeta */
      const state = i === this.step ? "is-current" : s.done.includes(i) ? "is-done" : "";
      list.appendChild(button([h("span", { cls: "ct-set-num " + state }, String(i)),
        h("span", { cls: "ct-set-step-text" }, h("b", null, t(`s.${i}`)), h("span", null, t(`s.${i}d`)))],
      "ct-set-step" + (i === this.step ? " is-current" : ""), () => this.go(i), { "aria-current": i === this.step ? "step" : "false", "aria-label": t(`s.${i}`) }));
    }
    const body = h("div", { cls: "ct-set-body" });
    const steps = [stepNotes, stepProps, stepFiles, stepMaps, stepBases, stepBar, stepReady];
    steps[this.step - 1](this, body);
    const markDone = () => { if (!s.done.includes(this.step)) { s.done.push(this.step); this.save(); } };
    const last = this.step === STEPS;
    body.appendChild(h("div", { cls: "ct-set-foot" + (last ? " is-last" : "") },
      this.step > 1 ? button(t("s.back"), "ct-set-btn", () => this.go(this.step - 1)) : null,
      last ? h("span", { cls: "ct-set-foot-text is-ok" }, icon("circle-check"), h("span", { cls: "ct-if-wide" }, t("s7.done")), h("span", { cls: "ct-if-narrow" }, t("s7.doneShort")))
        : h("span", { cls: "ct-set-foot-text" }, t("saved")),
      last ? button(t("s.ready"), "ct-set-btn is-primary", () => { markDone(); new Notice(t("s7.done")); this.display(); })
        : button(t("s.next"), "ct-set-btn is-primary", () => { markDone(); this.go(this.step + 1); })));
    const wrap = h("div", { cls: "ct-set" }, nav, body);
    el.appendChild(wrap);
    this.watch(wrap);
  }
  hide(): void { this.ro?.disconnect(); this.ro = null; this.closePicker?.(); }

  /* el diseño según el ancho: estrecho (pasos arriba), medio (pasos más estrechos) o ancho; el ancho del contenido;
     y las vistas previas de la nota, escaladas para que quepan. El observador es el de la ventana de los ajustes
     (pueden abrirse en una ventana aparte) */
  watch(wrap: HTMLElement) {
    this.ro?.disconnect();
    const fit = () => {
      const w = wrap.clientWidth, el = this.containerEl;
      if (!w) return;
      const narrow = Platform.isPhone || w < 600, mid = !narrow && w < 900;
      el.toggleClass("is-narrow", narrow);
      el.toggleClass("is-mid", mid);
      const bw = narrow ? w : w - (mid ? 200 + 24 : 240 + 32);
      el.setAttribute("data-bw", bw < 520 ? "s" : bw < 760 ? "m" : "l");
      for (const real of Array.from(el.querySelectorAll<HTMLElement>(".ct-set-real"))) {
        const cw = real.clientWidth;
        if (!cw) continue;
        const desk = !Platform.isPhone;
        real.toggleClass("is-desk", desk);
        const box = real.querySelector<HTMLElement>(desk ? ".ct-set-scale.is-desk" : ".ct-set-scale.is-phone");
        const inner = box?.firstElementChild as HTMLElement | null;
        if (!box || !inner) continue;
        const width = Math.max(cw, Number(box.dataset.min));
        inner.style.width = width + "px";
        inner.style.transform = width > cw ? `scale(${cw / width})` : "";
        fitRoutes(inner);
        box.style.height = Math.ceil(inner.offsetHeight * cw / width) + "px";
      }
    };
    fit();
    const RO = (wrap.win as (typeof window) | undefined)?.ResizeObserver ?? ResizeObserver;
    this.ro = new RO(() => fit());
    this.ro.observe(wrap);
  }

  head(body: HTMLElement, title: string, p: string) {
    /* sin <h2>: Obsidian y los temas les ponen raya, sangría y márgenes propios en los ajustes */
    body.appendChild(h("div", { cls: "ct-set-head" }, h("div", { cls: "ct-set-title", attr: { role: "heading", "aria-level": "2" } }, title), h("p", null, this.lines(p))));
  }
  /* «\n» en un texto: salto de línea (los del boceto) */
  lines(text: string): (string | HTMLElement)[] { return text.split("\n").flatMap((l, i) => i ? [h("br"), l] : [l]); }
  /* el desplegable de carpetas del boceto: la carpeta elegida y, al abrirlo, el árbol del vault */
  folderPicker(value: string, onPick: (v: string) => void, label: string): HTMLElement {
    const shown = value || t("s1.rootShort", { v: this.app.vault.getName() });
    const btn = button([icon("folder"), h("span", { cls: "ct-set-picker-text" }, shown), icon("chevron-down")], "ct-set-picker-btn", () => open(),
      { "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": label });
    const box = h("div", { cls: "ct-set-picker" }, btn);
    const open = () => {
      if (box.querySelector(".ct-set-picker-list")) { this.closePicker?.(); return; }
      this.closePicker?.();
      const opt = (path: string, depth: number, text: (string | HTMLElement)[]) => button([icon("folder"), ...text], "ct-set-picker-opt" + (path === value ? " is-on" : ""),
        () => { this.closePicker?.(); onPick(path); }, { role: "option", "aria-selected": String(path === value), style: `--d: ${depth}` });
      const listEl = h("div", { cls: "ct-set-picker-list", attr: { role: "listbox", "aria-label": label } },
        opt("", 0, [this.app.vault.getName(), h("span", { cls: "ct-sub" }, " · " + t("s1.rootHint"))]),
        this.folders().map(f => opt(f, f.split("/").length, [f.split("/").pop() || f])));
      box.appendChild(listEl);
      btn.setAttribute("aria-expanded", "true");
      const away = (ev: Event) => { if (!box.contains(ev.target as Node)) this.closePicker?.(); };
      const esc = (ev: KeyboardEvent) => { if (ev.key === "Escape") this.closePicker?.(); };
      activeDocument.addEventListener("pointerdown", away, true);
      activeDocument.addEventListener("keydown", esc, true);
      this.closePicker = () => {
        listEl.remove(); btn.setAttribute("aria-expanded", "false");
        activeDocument.removeEventListener("pointerdown", away, true);
        activeDocument.removeEventListener("keydown", esc, true);
        this.closePicker = null;
      };
    };
    return box;
  }
  select(options: [string, string][], value: string, onPick: (v: string) => void, label: string): HTMLSelectElement {
    const sel = h("select", { cls: "ct-input ct-select", attr: { "aria-label": label } }, options.map(([v, l]) => h("option", { attr: { value: v } }, l)));
    sel.value = value;
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }
  text(value: string, onInput: (v: string) => void, attr: Record<string, string> = {}): HTMLInputElement {
    const el = h("input", { cls: "ct-input", attr: { type: "text", value, ...attr } });
    el.addEventListener("change", () => onInput(el.value.trim()));
    return el;
  }
  check(on: boolean, onChange: (v: boolean) => void, attr: Record<string, string> = {}): HTMLInputElement {
    const cb = h("input", { cls: "ct-tick", attr: { type: "checkbox", ...attr } });
    cb.checked = on;
    cb.addEventListener("change", () => onChange(cb.checked));
    return cb;
  }
  label(text: string) { return h("span", { cls: "ct-set-caps" }, text); }

  /* el viaje de ejemplo de las vistas previas (pasos 3 y 7), escrito en el Markdown de la nota y leído como cualquier viaje */
  demo(): Trip {
    const c1 = t("demo.c1"), c2 = t("demo.c2"), co = t("demo.country"), en = locale() === "en";
    /* en el idioma de Obsidian: la nota de ejemplo se enseña también en Markdown (paso 7) */
    const L = en
      ? { fm: ["type: trip", "start: 2027-04-03", "end: 2027-04-14", `destinations: [${c1}, ${c2}]`, "travelers: [Ana, Leo]"], n6: "6 nights", n5: "5 nights",
        d1: "Sat, Apr 3", d2: "Sun, Apr 4", flight: "- 11:50 **Flight MAD → NRT** · 920 € · for Ana, Leo",
        f: ["    - Departs: Sat, Apr 3 · 11:50 · T4S", "    - Arrives: Sun, Apr 4 · 08:30 · T1", "    - Flight: IB 281 · Luggage: 1 bag each", "    - Booking: K7QX2P", "    - Seats: Ana 32A · Leo 32B"] }
      : { fm: ["tipo: viaje", "inicio: 2027-04-03", "fin: 2027-04-14", `destinos: [${c1}, ${c2}]`, "viajeros: [Ana, Leo]"], n6: "6 noches", n5: "5 noches",
        d1: "Sáb 3 abr", d2: "Dom 4 abr", flight: "- 11:50 **Vuelo MAD → NRT** · 920 € · para Ana, Leo",
        f: ["    - Sale: sáb 3 abr · 11:50 · T4S", "    - Llega: dom 4 abr · 08:30 · T1", "    - Vuelo: IB 281 · Equipaje: 1 maleta cada uno", "    - Reserva: K7QX2P", "    - Asientos: Ana 32A · Leo 32B"] };
    const md = ["---", ...L.fm, "---",
      `> [!cool-trip|bermellon] ${t("demo.name")}`, `> ${c1} · ${co} · ${L.n6} · Ana, Leo`, `> ${c2} · ${co} · ${L.n5} · Ana, Leo`, "",
      "## Plan", "", `### ${L.d1} · ${c1}`, L.flight, ...L.f, "",
      `### ${L.d2} · ${c1}`, `- [ ] 09:00 [[${t("demo.p1")}]]`, `- [ ] 18:30 [[${t("demo.p2")}]]`, ""].join("\n");
    return parseTrip(md, t("demo.name"), defaultSettings(en ? "en" : "es"));
  }
  /* una pieza de la nota en sus dos versiones (ordenador y móvil); watch() enseña la del dispositivo y la escala si no cabe */
  real(cls: string, desk: [HTMLElement, number], phone: [HTMLElement, number], acc: string): HTMLElement {
    const view = (el: HTMLElement, isPhone: boolean) => h("div", { cls: "ct-view" + (isPhone ? " is-phone" : ""), attr: { style: `--ct-acc: ${acc}` } }, el);
    return h("div", { cls: "ct-set-real " + cls, attr: { "aria-hidden": "true" } },
      h("div", { cls: "ct-set-scale is-desk", attr: { "data-min": String(desk[1]) } }, view(desk[0], false)),
      h("div", { cls: "ct-set-scale is-phone", attr: { "data-min": String(phone[1]) } }, view(phone[0], true)));
  }

}
