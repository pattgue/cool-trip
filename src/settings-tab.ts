/* Ajustes › Cool Trip: los siete pasos del boceto (Tus notas, Propiedades, Archivos, Mapas, Bases, Cool Bar, Listo).
   Se sigue el boceto; solo cambia lo que no cabe en el hueco que da Obsidian. Cada cambio se guarda al momento.
   Con sitio, los pasos van a la izquierda; si es estrecho (o en el móvil), en una fila de números arriba. El ancho se mide
   con un ResizeObserver (no con container queries: Obsidian dimensiona esta pestaña por su contenido y una «container
   query» la encogería). Las vistas previas de la nota (la reserva del paso 3 y la portada del paso 7) son las piezas de
   verdad de la vista del viaje, pintadas con un viaje de ejemplo que no se guarda en ninguna parte. */
import { App, Notice, Platform, PluginSettingTab, TFile, TFolder, normalizePath } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t } from "./i18n";
import { KIT_VERSION, devicePrefs, registry, saveBarSettings, sortedTools, thisDevice } from "./cool-kit/kit";
import type { BarAlign, BarLocation, BarMode, Device, ToolVisibility } from "./cool-kit/kit";
import { kt } from "./cool-kit/i18n";
import { AUTO_FOLDERS, defaultSettings, propKey, suggestedProps, tripFolder } from "./settings";
import { allPlaces, ensureFolder, iconFor, isTripFile } from "./places";
import { promptText } from "./prompt";
import { spanLabel } from "./dates";
import { parseTrip, serializeTrip, toList } from "./md";
import { blankDoc } from "./docs";
import { bookingCard, fitRoutes } from "./plan";
import type { PlanCtx } from "./plan";
import { ticket } from "./ticket";
import type { Doc, MapsApp, PropNames, Recog, RecogMode, Trip, Where } from "./types";
import { PALETTE, button, coverHex, icon } from "./ui";

const STEPS = 7;
const NOTE_PHONE = 760;             // como en la vista del viaje: por debajo de este ancho, la nota se pinta como en el móvil

export class CoolTripSettingTab extends PluginSettingTab {
  plugin: CoolTripPlugin;
  step = 1;
  private barDevice: Device = thisDevice();
  private ro: ResizeObserver | null = null;
  private closePicker: (() => void) | null = null;
  constructor(app: App, plugin: CoolTripPlugin) { super(app, plugin); this.plugin = plugin; }

  private save() { void this.plugin.saveSettings(); }
  private folders(): string[] {
    return this.app.vault.getAllLoadedFiles().filter((f): f is TFolder => f instanceof TFolder && f.path !== "/").map(f => f.path).sort((a, b) => a.localeCompare(b));
  }
  private vaultProps(): Set<string> {
    const out = new Set<string>();
    for (const f of this.app.vault.getMarkdownFiles()) for (const k of Object.keys(this.app.metadataCache.getFileCache(f)?.frontmatter || {})) out.add(k);
    return out;
  }
  private go(step: number) { this.step = step; this.display(); this.containerEl.scrollTop = 0; }

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
    const steps: ((b: HTMLElement) => void)[] = [b => this.s1(b), b => this.s2(b), b => this.s3(b), b => this.s4(b), b => this.s5(b), b => this.s6(b), b => this.s7(b)];
    steps[this.step - 1](body);
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
     y las vistas previas de la nota, con la versión (ordenador o móvil) que tocaría a ese ancho */
  private watch(wrap: HTMLElement) {
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
        const desk = !Platform.isPhone && cw >= Number(real.dataset.break);
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
    this.ro = new ResizeObserver(() => fit());
    this.ro.observe(wrap);
  }

  private head(body: HTMLElement, title: string, p: string) {
    /* sin <h2>: Obsidian y los temas les ponen raya, sangría y márgenes propios en los ajustes */
    body.appendChild(h("div", { cls: "ct-set-head" }, h("div", { cls: "ct-set-title", attr: { role: "heading", "aria-level": "2" } }, title), h("p", null, this.lines(p))));
  }
  /* «\n» en un texto: salto de línea (los del boceto) */
  private lines(text: string): (string | HTMLElement)[] { return text.split("\n").flatMap((l, i) => i ? [h("br"), l] : [l]); }
  /* el desplegable de carpetas del boceto: la carpeta elegida y, al abrirlo, el árbol del vault */
  private folderPicker(value: string, onPick: (v: string) => void, label: string): HTMLElement {
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
  private select(options: [string, string][], value: string, onPick: (v: string) => void, label: string): HTMLSelectElement {
    const sel = h("select", { cls: "ct-input ct-select", attr: { "aria-label": label } }, options.map(([v, l]) => h("option", { attr: { value: v } }, l)));
    sel.value = value;
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }
  private text(value: string, onInput: (v: string) => void, attr: Record<string, string> = {}): HTMLInputElement {
    const el = h("input", { cls: "ct-input", attr: { type: "text", value, ...attr } });
    el.addEventListener("change", () => onInput(el.value.trim()));
    return el;
  }
  private check(on: boolean, onChange: (v: boolean) => void, attr: Record<string, string> = {}): HTMLInputElement {
    const cb = h("input", { cls: "ct-tick", attr: { type: "checkbox", ...attr } });
    cb.checked = on;
    cb.addEventListener("change", () => onChange(cb.checked));
    return cb;
  }
  private label(text: string) { return h("span", { cls: "ct-set-caps" }, text); }

  /* el viaje de ejemplo de las vistas previas (pasos 3 y 7), escrito en el Markdown de la nota y leído como cualquier viaje */
  private demo(): Trip {
    const c1 = t("demo.c1"), c2 = t("demo.c2"), co = t("demo.country");
    const md = ["---", "tipo: viaje", "inicio: 2027-04-03", "fin: 2027-04-14", `destinos: [${c1}, ${c2}]`, "viajeros: [Ana, Leo]", "portada: bermellon", "---",
      `> [!cool-trip] ${t("demo.name")}`, `> ${c1} · ${co} · 6 noches · Ana, Leo`, `> ${c2} · ${co} · 5 noches · Ana, Leo`, "",
      "## Plan", "", `### Sáb 3 abr · ${c1}`, "- 11:50 **Vuelo MAD → NRT** · 920 € · para Ana, Leo",
      "    - Sale: sáb 3 abr · 11:50 · T4S", "    - Llega: dom 4 abr · 08:30 · T1", "    - Vuelo: IB 281 · Equipaje: 1 maleta cada uno",
      "    - Reserva: K7QX2P", "    - Asientos: Ana 32A · Leo 32B", "",
      `### Dom 4 abr · ${c1}`, `- [ ] 09:00 [[${t("demo.p1")}]]`, `- [ ] 18:30 [[${t("demo.p2")}]]`, ""].join("\n");
    return parseTrip(md, t("demo.name"), defaultSettings("es"));
  }
  /* una pieza de la nota en sus dos versiones (ordenador y móvil); watch() enseña la que toca al ancho que hay y la escala si no cabe */
  private real(cls: string, breakAt: number, desk: [HTMLElement, number], phone: [HTMLElement, number], acc: string): HTMLElement {
    const view = (el: HTMLElement, isPhone: boolean) => h("div", { cls: "ct-view" + (isPhone ? " is-phone" : ""), attr: { style: `--ct-acc: ${acc}` } }, el);
    return h("div", { cls: "ct-set-real " + cls, attr: { "data-break": String(breakAt), "aria-hidden": "true" } },
      h("div", { cls: "ct-set-scale is-desk", attr: { "data-min": String(desk[1]) } }, view(desk[0], false)),
      h("div", { cls: "ct-set-scale is-phone", attr: { "data-min": String(phone[1]) } }, view(phone[0], true)));
  }

  /* 1 · Tus notas */
  private s1(body: HTMLElement) {
    const s = this.plugin.settings;
    this.head(body, t("s1.h"), t("s1.p"));
    const block = (title: string, desc: string, iconName: string, r: Recog, kind: string, tagPh: string, folder: () => string, setFolder: (v: string) => void) => {
      const modes: [RecogMode, string][] = [["property", t("s1.property")], ["tag", t("s1.tag")], ["folder", t("s1.folder")]];
      const radios = h("div", { cls: "ct-set-radios", attr: { role: "radiogroup", "aria-label": title } }, modes.map(([m, l]) => {
        const rb = h("input", { cls: "ct-radio", attr: { type: "radio", name: "ct-recog-" + kind } });
        rb.checked = r.mode === m;
        rb.addEventListener("change", () => { r.mode = m; this.save(); this.display(); });
        return h("label", null, rb, l);
      }));
      let how: HTMLElement;
      if (r.mode === "property") {
        const key = this.text(r.key, v => { r.key = v; this.save(); }, { placeholder: "tipo", "aria-label": t("s1.property") });
        key.classList.add("is-key");
        how = h("div", { cls: "ct-set-how" }, key, h("span", { cls: "ct-eq" }, "="), this.text(r.value, v => { r.value = v; this.save(); }, { placeholder: kind, "aria-label": kind }));
      } else if (r.mode === "tag") how = h("div", { cls: "ct-set-how" }, this.text(r.value ? "#" + r.value.replace(/^#/, "") : "", v => { r.value = v.replace(/^#/, ""); this.save(); }, { placeholder: tagPh, "aria-label": t("s1.tag") }));
      else how = h("span", { cls: "ct-sub" }, t("s1.folderHint", { k: kind }));
      /* con «Carpeta», el desplegable de abajo elige esa carpeta (y ahí se guardan los nuevos) */
      const inFolder = r.mode === "folder";
      const pick = s.autoOrganize ? h("span", { cls: "ct-set-auto" }, icon("smile"), folder())
        : this.folderPicker(inFolder ? r.folder : folder(), v => { if (inFolder) r.folder = v; setFolder(v); this.save(); this.display(); }, title);
      return [
        h("div", { cls: "ct-set-card ct-set-recog" },
          h("div", { cls: "ct-set-card-top" }, h("span", { cls: "ct-set-icon" }, icon(iconName)),
            h("span", { cls: "ct-set-card-text" }, h("b", { cls: "is-caps" }, title), h("span", null, this.lines(desc)))),
          h("div", { cls: "ct-set-recog-how" }, radios, how)),
        h("div", { cls: "ct-f ct-set-save" }, h("span", { cls: "ct-label" }, inFolder && !s.autoOrganize ? t("s1.folderLbl") : t("s1.saveIn")), pick),
      ];
    };
    body.append(...block(t("s1.trips"), t("s1.tripsD"), "plane", s.trips, t("s1.trip"), t("s1.tripTag"),
      () => s.autoOrganize ? AUTO_FOLDERS[s.language].trips : s.tripFolder, v => { s.tripFolder = v; }));
    body.append(...block(t("s1.places"), t("s1.placesD"), "map-pin", s.places, t("s1.place"), t("s1.placeTag"),
      () => s.autoOrganize ? AUTO_FOLDERS[s.language].places + "/…" : s.placeFolder, v => { s.placeFolder = v; }));
    body.appendChild(h("div", { cls: "ct-set-autoorg" },
      this.tree(),
      h("div", { cls: "ct-set-autoorg-side" },
        h("b", { cls: "ct-set-autoorg-title" }, t("s1.auto"), h("span", { cls: "ct-sub" }, " · " + t("s1.optional"))),
        h("p", { cls: "ct-set-autoorg-text ct-if-l" }, h("b", null, t("s1.autoB")), h("br"), h("br"), t("s1.autoD")),
        h("p", { cls: "ct-set-autoorg-text ct-if-ms" }, h("b", null, t("s1.autoB")), " ", t("s1.autoDShort")),
        button([icon(s.autoOrganize ? "check" : "smile"), h("span", null, s.autoOrganize ? t("s1.usingAuto") : t("s1.useAuto"))], "ct-set-btn ct-set-autoorg-btn" + (s.autoOrganize ? " is-on" : ""),
          () => { s.autoOrganize = !s.autoOrganize; this.save(); this.display(); }))));
  }
  /* el explorador de archivos con la organización automática (el ejemplo del boceto) */
  private tree(): HTMLElement {
    const F = AUTO_FOLDERS[this.plugin.settings.language];
    type R = [number, "open" | "closed" | null, string, string, boolean?];
    const rows: R[] = [[0, "open", "folder", F.trips], [1, null, "file", t("tree.t1")], [1, null, "file", t("tree.t2")], [1, null, "table", F.trips, true],
      [0, "open", "folder", F.places], [1, "open", "folder", t("tree.c1")], [2, null, "file", t("tree.p1")], [2, null, "file", t("tree.p2")],
      [1, "closed", "folder", t("tree.c2")], [1, null, "table", F.places, true]];
    return h("div", { cls: "ct-set-tree", attr: { role: "img", "aria-label": t("s1.preview") } }, rows.map(([d, fold, ico, name, base]) =>
      h("span", { cls: "ct-set-tree-row" + (d ? " is-in" : "") + (d === 2 ? " is-deep" : ""), attr: { style: `--d: ${d}` } },
        fold ? icon(fold === "open" ? "chevron-down" : "chevron-right", "ct-ico ct-set-tree-fold") : null,
        icon(ico, "ct-ico" + (ico === "folder" ? " is-folder" : "")), name, base ? h("span", { cls: "ct-set-tree-tag" }, "BASE") : null)));
  }

  /* 2 · Propiedades */
  private s2(body: HTMLElement) {
    const s = this.plugin.settings, used = this.vaultProps(), sug = suggestedProps(s.language);
    this.head(body, t("s2.h"), t("s2.p"));
    const TYPE_ICON: Record<string, string> = { date: "calendar", list: "list", text: "type", number: "hash", checkbox: "square-check" };
    const req = h("p", { cls: "ct-set-req" }, h("span", { cls: "ct-req" }, "*"), " ", t("s2.req"));
    const OTHER = "\u0000other", NONE = "\u0000none";
    const row = (k: keyof PropNames, type: string, need: boolean) => {
      const val = s.props[k], isUsed = !!val && used.has(val);
      const others = [...used].filter(p => p !== sug[k]).sort((a, b) => a.localeCompare(b));
      const opts: [string, string][] = [[sug[k], t("s2.suggested", { p: sug[k] })], ...others.map(p => [p, p] as [string, string])];
      if (val && !opts.some(([v]) => v === val)) opts.push([val, val]);
      if (!need) opts.push([NONE, t("s2.none")]);
      opts.push([OTHER, t("s2.other")]);
      const sel = this.select(opts, val || NONE, v => {
        if (v === NONE) { s.props[k] = ""; this.save(); this.display(); return; }
        if (v !== OTHER) { s.props[k] = v; this.save(); this.display(); return; }
        void promptText(this.app, t("p." + k), sug[k], val).then(name => {
          if (name?.trim()) { s.props[k] = name.trim(); this.save(); }
          this.display();
        });
      }, t("s2.yours") + " · " + t("p." + k));
      const state = !val ? ["", t("s2.unused")] : k === "country" ? ["is-auto", t("s2.auto")] : isUsed ? ["is-used", t("s2.used")] : ["", t("s2.new")];
      return h("div", { cls: "ct-set-prop" },
        h("span", { cls: "ct-set-prop-name" }, t("p." + k), need ? h("span", { cls: "ct-req", attr: { "aria-label": t("s2.reqShort") } }, "*") : null),
        h("span", { cls: "ct-set-prop-desc" }, t(`p.${k}D`)),
        h("span", { cls: "ct-set-type" }, icon(TYPE_ICON[type]), t("t." + type)),
        h("span", { cls: "ct-set-prop-in" }, sel),
        h("span", { cls: "ct-set-state " + state[0] + (val ? "" : " is-off") }, state[1]));
    };
    const group = (title: string, ico: string) => h("div", { cls: "ct-set-group" }, icon(ico), title);
    body.append(req, h("div", { cls: "ct-set-table" },
      h("div", { cls: "ct-set-thead" }, h("span", null, t("s2.data")), h("span", null, t("s2.type")), h("span", null, t("s2.yours")), h("span", null, t("s2.state"))),
      group(t("s2.trip"), "plane"), row("start", "date", true), row("end", "date", true), row("destinations", "list", true), row("travelers", "list", false), row("cover", "text", false),
      group(t("s2.place"), "map-pin"), row("location", "list", true), row("city", "text", true), row("country", "text", false), row("category", "text", false),
      row("price", "text", false), row("rating", "number", false), row("visited", "checkbox", false)));
  }

  /* 3 · Archivos */
  private s3(body: HTMLElement) {
    const s = this.plugin.settings, f = s.files;
    this.head(body, t("s3.h"), t("s3.p"));
    const TAG: Record<string, string> = { cloud: "is-accent", wallet: "is-green", device: "", vault: "is-amber" };
    const opt = (k: "cloud" | "wallet" | "device" | "vault", tag: string, sub: string, extra: HTMLElement | null) =>
      h("label", { cls: "ct-set-card is-check" + (f[k] ? " is-on" : "") }, this.check(f[k], v => { f[k] = v; this.save(); this.display(); }),
        h("span", { cls: "ct-set-card-text" },
          h("span", { cls: "ct-set-opt-title" }, h("b", null, t("s3." + k)), sub ? h("span", { cls: "ct-sub" }, sub) : null),
          h("span", { cls: "ct-set-tag " + TAG[k] }, tag),
          h("span", null, t(`s3.${k}D`)), extra));
    /* la vista previa: la reserva de verdad del plan, con los documentos en los sitios que marques */
    const tr = this.demo(), it = tr.days[0].items[0];
    const files = (["cloud", "device", "vault"] as Where[]).filter(w => f[w as "cloud"]);
    const docs: Doc[] = [];
    if (files.length) docs.push(blankDoc(files[0], { name: t("demo.file"), url: files[0] === "cloud" ? "https://drive.google.com/" : "", also: files.slice(1) }));
    if (f.wallet) docs.push(blankDoc("wallet", { name: t("demo.pass"), para: ["Ana"] }), blankDoc("wallet", { name: t("demo.pass2"), para: ["Leo"] }));
    it.docs = docs;
    const ctx = (phone: boolean): PlanCtx => ({
      app: this.app, s, trip: tr, file: null as unknown as TFile, phone, form: null, collapsed: new Set(), docAdd: null,
      setDocAdd: () => {}, commit: () => {}, rerender: () => {}, openForm: () => {}, renderForm: () => h("div"), openLink: () => {}, openDoc: () => {}, openUrl: () => {}, move: () => {},
    });
    const acc = coverHex(tr.cover);
    body.append(
      h("div", { cls: "ct-set-files-prev" }, this.label(t("s3.preview")),
        this.real("ct-set-real-card", 560, [bookingCard(ctx(false), 0, 0), 560], [bookingCard(ctx(true), 0, 0), 320], acc)),
      h("div", { cls: "ct-set-files-opts" }, this.label(t("s3.where")),
        opt("cloud", t("s3.rec"), t("s3.cloudSub"), h("span", { cls: "ct-set-warn", attr: { role: "note" } }, icon("triangle-alert"), h("span", null, h("b", null, t("s3.careful")), " ", t("s3.cloudWarn")))),
        opt("wallet", t("s3.offline"), t("s3.walletSub"), null),
        opt("device", t("s3.only"), "", null),
        opt("vault", t("s3.space"), "", f.vault ? h("div", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s3.vaultFolder")),
          this.folderPicker(f.vaultFolder, v => { f.vaultFolder = v; this.save(); this.display(); }, t("s3.vaultFolder"))) : null)));
  }

  /* 4 · Mapas */
  private s4(body: HTMLElement) {
    const m = this.plugin.settings.maps;
    this.head(body, t("s4.h"), t("s4.p"));
    const app = (k: MapsApp) => {
      const rb = h("input", { cls: "ct-radio", attr: { type: "radio", name: "ct-maps-app" } });
      rb.checked = m.app === k;
      rb.addEventListener("change", () => { m.app = k; this.save(); this.display(); });
      return h("label", { cls: "ct-set-card is-radio" + (m.app === k ? " is-on" : "") },
        h("span", { cls: "ct-set-radio-title" }, rb, h("b", null, t("s4." + k))),
        h("span", { cls: "ct-set-radio-desc" }, t(`s4.${k}D`)),
        h("span", { cls: "ct-set-radio-note" }, t(`s4.${k}O`)));
    };
    const mode = (k: string) => h("label", { cls: "ct-set-chip" }, this.check(m.modes.includes(k), on => {
      m.modes = on ? [...m.modes.filter(x => x !== k), k] : m.modes.filter(x => x !== k); this.save();
    }), t("m." + k));
    body.append(h("div", { cls: "ct-set-grid is-3", attr: { role: "radiogroup", "aria-label": t("s4.h") } }, app("google"), app("apple"), app("organic")),
      h("div", { cls: "ct-set-modes" },
        h("b", { cls: "ct-set-subhead" }, t("s4.modes"), h("span", { cls: "ct-sub" }, " · " + t("s4.modesHint"))),
        h("div", { cls: "ct-set-chips" }, ["walk", "transit", "car", "bike", "taxi"].map(mode))));
  }

  /* 5 · Bases: cada base va, si no se elige otra carpeta, con las notas que organiza (la carpeta del paso 1) */
  private baseFolder(kind: "trips" | "places") {
    const s = this.plugin.settings;
    if (s.bases[kind]) return s.bases[kind];
    if (kind === "trips") return tripFolder(s);
    return s.autoOrganize ? AUTO_FOLDERS[s.language].places : s.places.mode === "folder" ? s.places.folder : s.placeFolder;
  }
  private basePath(kind: "trips" | "places") {
    const folder = this.baseFolder(kind);
    return normalizePath((folder ? folder + "/" : "") + t("s5." + kind) + ".base");
  }
  private baseExists(kind: "trips" | "places") { return this.app.vault.getAbstractFileByPath(this.basePath(kind)) instanceof TFile; }
  private s5(body: HTMLElement) {
    const s = this.plugin.settings;
    this.head(body, t("s5.h"), t("s5.p"));
    body.appendChild(h("div", { cls: "ct-set-promo" },
      h("span", { cls: "ct-set-promo-icon" }, icon("id-card")),
      h("span", { cls: "ct-set-card-text" }, h("b", null, t("s5.promoH")), h("span", null, t("s5.promo"))),
      /* la ficha de Cool Bases en el buscador de plugins de la comunidad de Obsidian */
      button(t("s5.promoBtn"), "ct-set-promo-btn", () => { window.open("obsidian://show-plugin?id=cool-bases"); })));
    const card = (kind: "trips" | "places") => {
      const exists = this.baseExists(kind), name = t("s5." + kind);
      const open = () => { const f = this.app.vault.getAbstractFileByPath(this.basePath(kind)); if (f instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(f); };
      const create = async () => {
        const folder = this.baseFolder(kind), p = this.basePath(kind);
        await ensureFolder(this.app, folder);
        if (!(this.app.vault.getAbstractFileByPath(p) instanceof TFile)) await this.app.vault.create(p, this.baseYaml(kind, name));
        new Notice(t("s5.created", { p }));
        this.display();
      };
      const left = h("div", { cls: "ct-set-base-main" },
        h("label", { cls: "ct-set-base-on" }, this.check(exists, on => { if (on && !exists) void create(); }, exists ? { disabled: "" } : {}), h("b", { cls: "is-caps" }, name)),
        h("span", { cls: "ct-set-base-desc" }, t(`s5.${kind}D`)),
        exists ? h("span", { cls: "ct-set-base-path" }, icon("table"), h("span", null, this.basePath(kind)), button(t("s5.open"), "ct-set-btn is-small", open))
          : h("div", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s5.saveIn")),
            this.folderPicker(this.baseFolder(kind), v => { s.bases[kind] = v; this.save(); this.display(); }, t("s5.saveIn") + " · " + name)));
      return h("div", { cls: "ct-set-card ct-set-base" }, left,
        h("div", { cls: "ct-set-base-prev" }, this.label(t("s5.table")), kind === "trips" ? this.tripTable() : this.placeTable()),
        h("div", { cls: "ct-set-base-prev" }, this.label(t("s5.cards")), kind === "trips" ? this.tripCards() : this.placeCards()));
    };
    body.append(card("trips"), card("places"),
      h("div", { cls: "ct-set-why" }, h("b", null, t("s5.why")), h("ul", null, h("li", null, t("s5.why1")), h("li", null, t("s5.why2")))));
  }
  /* los viajes y lugares del vault para las vistas previas de las bases */
  private trips() {
    const s = this.plugin.settings;
    return this.app.vault.getMarkdownFiles().filter(f => isTripFile(this.app, s, f)).map(f => {
      const fm: Record<string, unknown> = this.app.metadataCache.getFileCache(f)?.frontmatter || {};
      const get = (k: keyof PropNames): unknown => fm[propKey(s, k, fm)];
      const str = (v: unknown) => typeof v === "string" ? v : "";
      return { name: f.basename, start: str(get("start")), end: str(get("end")), dests: toList(get("destinations")), cover: str(get("cover")) };
    }).sort((a, b) => b.start.localeCompare(a.start));
  }
  private miniTable(head: string[], rows: string[][]): HTMLElement {
    const cells = [...head.map(c => h("span", { cls: "is-head" }, c)), ...(rows.length ? rows : [["…", "", ""]]).slice(0, 2).flatMap(r => r.map((c, i) => h("span", { cls: i ? "" : "is-first" }, c)))];
    return h("span", { cls: "ct-set-mini-table" }, cells);
  }
  private tripTable() {
    return this.miniTable([t("s5.colTrip"), t("s5.colDates"), t("s5.colDests")], this.trips().map(tr => [tr.name, spanLabel(tr.start, tr.end), tr.dests.join(", ")]));
  }
  private placeTable() {
    return this.miniTable([t("s5.colPlace"), t("s5.colCity"), t("s5.colCat")], allPlaces(this.app, this.plugin.settings).map(p => [p.name, p.city, p.category]));
  }
  private tripCards() {
    const list = this.trips().slice(0, 3);
    return h("span", { cls: "ct-set-mini-cards" }, list.length ? list.map(tr => h("span", { cls: "ct-set-mini-trip", attr: { style: `background: ${coverHex(tr.cover)}` } },
      h("span", null, (spanLabel(tr.start, tr.end) || t("s5.noDates")).toUpperCase()), h("b", null, tr.name.replace(/^\d{4}\s*-\s*/, "").toUpperCase()), h("span", null, tr.dests.join(" · "))))
      : h("span", { cls: "ct-set-mini-empty" }, "…"));
  }
  private placeCards() {
    const list = allPlaces(this.app, this.plugin.settings).slice(0, 3);
    return h("span", { cls: "ct-set-mini-cards" }, list.length ? list.map((p, i) => h("span", { cls: "ct-set-mini-place" },
      h("span", { cls: "ct-set-mini-place-top", attr: { style: `background: ${PALETTE[(i + 1) % PALETTE.length].hex}` } }, icon(iconFor(p.category))),
      h("span", { cls: "ct-set-mini-place-text" }, h("b", null, p.name), h("span", null, [p.city, p.category].filter(Boolean).join(" · ")))))
      : h("span", { cls: "ct-set-mini-empty" }, "…"));
  }
  private baseYaml(kind: "trips" | "places", name: string): string {
    const s = this.plugin.settings, r = kind === "trips" ? s.trips : s.places, P = s.props;
    const q = (v: string) => JSON.stringify(v);
    const filter = r.mode === "folder" ? `file.inFolder(${q(r.folder)})` : r.mode === "tag" ? `file.hasTag(${q(r.value.replace(/^#/, ""))})` : `note[${q(r.key)}] == ${q(r.value)}`;
    const cols = (kind === "trips" ? ["file.name", P.start && `note.${P.start}`, P.end && `note.${P.end}`, P.destinations && `note.${P.destinations}`, P.travelers && `note.${P.travelers}`]
      : ["file.name", P.city && `note.${P.city}`, P.category && `note.${P.category}`, P.rating && `note.${P.rating}`, P.visited && `note.${P.visited}`]).filter(Boolean);
    const sortKey = kind === "trips" ? P.start : P.city;
    const sort = sortKey ? `    sort:\n      - property: note.${sortKey}\n        direction: ${kind === "trips" ? "DESC" : "ASC"}\n` : "";
    return `filters:\n  and:\n    - ${filter}\nviews:\n  - type: table\n    name: ${q(name)}\n    order:\n${cols.map(c => `      - ${c}`).join("\n")}\n${sort}`;
  }

  /* 6 · Cool Bar: los ajustes compartidos del Cool Kit (los mismos datos que en los demás plugins Cool) */
  private s6(body: HTMLElement) {
    this.head(body, t("s6.h"), t("s6.p"));
    const p = devicePrefs(this.barDevice), tools = sortedTools(p);
    const save = () => { void saveBarSettings(); this.display(); };
    /* cómo queda la barra con los plugins Cool que tienes y estas opciones (con sus clases de verdad) */
    const bar = h("div", { cls: "cool-bar ct-set-bar" + (p.collapsed ? " is-collapsed" : ""), attr: { "data-ck": String(KIT_VERSION), "data-align": p.align, role: "img", "aria-label": t("s6.preview") } },
      h("span", { cls: "cool-fold" }, icon(p.collapsed ? "chevron-down" : "chevron-up")),
      p.collapsed ? null : h("div", { cls: "cool-tools" }, tools.filter(tl => (p.tools[tl.id]?.visibility || "always") !== "never").map(tl =>
        h("span", { cls: "cool-tool", attr: { "data-state": "available" } }, tl.label()))));
    const tabs = h("div", { cls: "ct-set-tabs", attr: { role: "tablist", "aria-label": kt("s.device") } }, (["desktop", "phone"] as Device[]).map(d =>
      button(kt("s." + d), "ct-set-tab" + (d === this.barDevice ? " is-on" : ""), () => { this.barDevice = d; this.display(); }, { role: "tab", "aria-selected": String(d === this.barDevice) })));
    const row = (name: string, desc: string | null, control: HTMLElement, cls = "") => h("div", { cls: "ct-set-row " + cls },
      h("span", { cls: "ct-set-row-text" }, h("b", null, name), desc ? h("span", null, desc) : null), control);
    const barCard = h("div", { cls: "ct-set-card ct-set-rows" },
      h("div", { cls: "ct-set-row is-head" }, h("b", null, t("s6.bar")), tabs),
      row(kt("s.location"), null, this.select([["top", kt("s.top")], ["bottom", kt("s.bottom")], ["float", kt("s.float")]], p.location, v => { p.location = v as BarLocation; save(); }, kt("s.location"))),
      row(kt("s.align"), null, this.select([["right", kt("s.right")], ["center", kt("s.center")], ["left", kt("s.left")]], p.align, v => { p.align = v as BarAlign; save(); }, kt("s.align"))),
      row(kt("s.mode"), t("s6.modeD"), this.select([["fixed", kt("s.fixed")], ["context", kt("s.context")], ["hidden", kt("s.hidden")]], p.mode, v => { p.mode = v as BarMode; registry().toggled = false; save(); }, kt("s.mode"))),
      row(kt("s.collapsed"), kt("s.collapsedDesc"), this.check(p.collapsed, v => { p.collapsed = v; save(); }, { "aria-label": kt("s.collapsed") }), "is-check"));
    const move = (i: number, by: number) => {
      const ids = tools.map(x => x.id);
      [ids[i], ids[i + by]] = [ids[i + by], ids[i]];
      ids.forEach((id, k) => { (p.tools[id] ??= {}).order = k * 10; });
      save();
    };
    const arrow = (name: string, label: string, disabled: boolean, go: () => void) => {
      const b = button(icon(name), "ct-set-arrow", go, { "aria-label": label });
      b.disabled = disabled;
      return b;
    };
    const btnCard = h("div", { cls: "ct-set-card ct-set-rows" },
      h("div", { cls: "ct-set-row is-head" }, h("span", { cls: "ct-set-row-text" }, h("b", null, kt("s.buttons")), h("span", null, t("s6.buttonsD")))),
      tools.map((tl, i) => h("div", { cls: "ct-set-row is-tool" },
        h("span", { cls: "ct-set-tool-chip" }, tl.label()),
        h("span", { cls: "ct-set-tool-ctl" },
          this.select([["always", kt("s.always")], ["applies", kt("s.applies")], ["never", kt("s.never")]], p.tools[tl.id]?.visibility || "always",
            v => { (p.tools[tl.id] ??= {}).visibility = v as ToolVisibility; save(); }, tl.label()),
          arrow("arrow-up", kt("s.up"), i === 0, () => move(i, -1)), arrow("arrow-down", kt("s.down"), i === tools.length - 1, () => move(i, 1))))));
    body.append(h("div", { cls: "ct-set-bar-block" }, this.label(t("s6.preview")), h("div", { cls: "ct-set-bar-frame" }, bar)),
      h("div", { cls: "ct-set-grid is-bar" }, barCard, btnCard));
  }

  /* 7 · Listo */
  private s7(body: HTMLElement) {
    this.head(body, t("s7.h"), t("s7.p"));
    const tr = this.demo();
    /* lo que se guarda: el Markdown de verdad del viaje de ejemplo (sin las secciones y días vacíos ni la marca del final) */
    const md = serializeTrip(tr, this.plugin.settings).split("\n");
    const level = (l: string) => /^(#{2,3}) /.exec(l)?.[1].length ?? 0;
    const hasContent = (i: number) => {
      for (let j = i + 1; j < md.length; j++) { const lj = level(md[j]); if (lj && lj <= level(md[i])) return false; if (!lj && md[j].trim() && !md[j].startsWith("%%")) return true; }
      return false;
    };
    const lines: HTMLElement[] = [];
    let fm = 0;
    for (let i = 0; i < md.length && lines.length < 24; i++) {
      const l = md[i];
      if (l === "---") fm++;
      if (!l.trim() || l.startsWith("%%") || (level(l) && !hasContent(i))) continue;
      const cls = fm < 2 || l === "---" || l.startsWith(">") ? "is-fm" : level(l) === 2 ? "is-h2" : level(l) === 3 ? "is-h3" : "";
      lines.push(h("span", { cls }, l.split(/(\[\[[^\]]+\]\])/).map(x => x.startsWith("[[") ? h("span", { cls: "is-link" }, x) : x)));
    }
    const tk = (phone: boolean) => ticket({ mode: "note", phone, trip: tr, path: "", locked: true, changed: () => {}, prompt: () => Promise.resolve(null), promptDest: () => Promise.resolve(null), coverSrc: () => null });
    body.appendChild(h("div", { cls: "ct-set-how-it" },
      h("div", { cls: "ct-set-card ct-set-md" }, this.label(t("s7.saved")), h("span", { cls: "ct-set-md-lines" }, lines)),
      h("span", { cls: "ct-set-how-arrow", attr: { "aria-hidden": "true" } }, icon("arrow-down")),
      h("div", { cls: "ct-set-sees" }, this.label(t("s7.sees")), this.real("ct-set-real-ticket", NOTE_PHONE, [tk(false), 1000], [tk(true), 360], coverHex(tr.cover)))));
    const bar = h("span", { cls: "cool-bar ct-set-mini-bar", attr: { "data-ck": String(KIT_VERSION), "data-align": "right" } }, h("span", { cls: "cool-fold" }, icon("chevron-up")),
      h("span", { cls: "cool-tools" }, h("span", { cls: "cool-tool", attr: { "data-state": "available" } }, "Cool Trip")));
    const form = h("span", { cls: "ct-set-mini-form" }, h("span", null, "09:00"), h("span", { cls: "is-grow" }, icon("map-pin"), h("span", null, t("demo.p1"))), h("span", { cls: "is-add" }, t("s7.add")));
    const chips = h("span", { cls: "ct-set-mini-chips" }, ([["calendar", "s7.chipPlan"], ["ticket", "s7.chipBook"], ["file-text", "s7.chipDocs"]] as const).map(([i, k]) => h("span", null, icon(i), t(k))));
    const step = (n: number, visual: HTMLElement) => h("div", { cls: "ct-set-card ct-set-howstep" },
      h("span", { cls: "ct-set-num is-current" }, String(n)),
      h("span", { cls: "ct-set-howstep-text" }, h("b", null, t(`s7.${n}`)), h("span", { cls: "ct-set-howstep-visual" }, visual), h("span", { cls: "ct-set-howstep-desc" }, t(`s7.${n}d`))));
    const list = (title: string, keys: string[], ico: string, cls: string) => h("div", { cls: "ct-set-ul " + cls }, h("b", null, title),
      keys.map(k => h("span", null, icon(ico), t(k))));
    body.append(h("div", { cls: "ct-set-grid is-3 is-steps" }, step(1, bar), step(2, form), step(3, chips)),
      h("div", { cls: "ct-set-grid is-lists" }, list(t("s7.adds"), ["s7.adds1", "s7.adds2", "s7.adds3"], "check", "is-adds"), list(t("s7.keeps"), ["s7.keeps1", "s7.keeps2", "s7.keeps3"], "minus", "is-keeps")));
  }
}
