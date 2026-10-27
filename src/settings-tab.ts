/* Ajustes › Cool Trip: los siete pasos del boceto (Tus notas, Propiedades, Archivos, Mapas, Bases, Cool Bar, Listo),
   cada uno con su vista previa. Cada cambio se guarda al momento.
   Se adaptan al hueco que da Obsidian: con sitio, los pasos van a la izquierda; si es estrecho (o en el móvil), en una fila
   de números arriba. El ancho se mide con un ResizeObserver (no con container queries: Obsidian dimensiona esta pestaña
   por su contenido y una «container query» la encogería). */
import { App, Notice, Platform, PluginSettingTab, TFile, TFolder, normalizePath } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t } from "./i18n";
import { KIT_VERSION, devicePrefs, registry, saveBarSettings, sortedTools, thisDevice } from "./cool-kit/kit";
import type { BarAlign, BarLocation, BarMode, Device, ToolVisibility } from "./cool-kit/kit";
import { kt } from "./cool-kit/i18n";
import { AUTO_FOLDERS, propKey, suggestedProps } from "./settings";
import { allPlaces, ensureFolder, iconFor, isTripFile } from "./places";
import { promptText } from "./prompt";
import { spanLabel } from "./dates";
import { blankTrip, newItem, serializeTrip, toList } from "./md";
import { docButton, blankDoc } from "./docs";
import { ticket } from "./ticket";
import type { MapsApp, PropNames, Recog, RecogMode, Trip, Where } from "./types";
import { PALETTE, button, coverHex, icon } from "./ui";

const STEPS = 7;
const NOTE_W = 760;                 // el ancho al que se pinta la portada de ejemplo (luego se escala a su hueco)

export class CoolTripSettingTab extends PluginSettingTab {
  plugin: CoolTripPlugin;
  step = 1;
  private barDevice: Device = thisDevice();
  private ro: ResizeObserver | null = null;
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
      last ? h("span", { cls: "ct-set-foot-text is-ok" }, icon("circle-check"), t("s7.done")) : h("span", { cls: "ct-set-foot-text" }, t("saved")),
      last ? button(t("s.ready"), "ct-set-btn is-primary", () => { markDone(); new Notice(t("s7.done")); this.display(); })
        : button(t("s.next"), "ct-set-btn is-primary", () => { markDone(); this.go(this.step + 1); })));
    const wrap = h("div", { cls: "ct-set" }, nav, body);
    el.appendChild(wrap);
    this.watch(wrap);
  }
  hide(): void { this.ro?.disconnect(); this.ro = null; }

  /* el diseño según el ancho: estrecho (pasos arriba), medio (pasos más estrechos) o ancho; y el ancho del contenido */
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
      for (const z of Array.from(el.querySelectorAll<HTMLElement>(".ct-set-zoom"))) {
        const inner = z.firstElementChild as HTMLElement | null;
        if (inner && z.clientWidth && !Platform.isPhone) inner.style.zoom = String(Math.min(1, z.clientWidth / NOTE_W));
      }
    };
    fit();
    this.ro = new ResizeObserver(() => fit());
    this.ro.observe(wrap);
  }

  private head(body: HTMLElement, title: string, p: string) {
    /* sin <h2>: Obsidian y los temas les ponen raya, sangría y márgenes propios en los ajustes */
    body.appendChild(h("div", { cls: "ct-set-head" }, h("div", { cls: "ct-set-title", attr: { role: "heading", "aria-level": "2" } }, title), h("p", null, p)));
  }
  private folderSelect(value: string, onPick: (v: string) => void, rootLabel: string): HTMLSelectElement {
    const sel = h("select", { cls: "ct-input ct-select" });
    sel.appendChild(h("option", { attr: { value: "" } }, rootLabel));
    for (const f of this.folders()) sel.appendChild(h("option", { attr: { value: f } }, f));
    if (value && !this.folders().includes(value)) sel.appendChild(h("option", { attr: { value } }, value));
    sel.value = value;
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
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

  /* el viaje de ejemplo de las vistas previas (pasos 3 y 7): no se guarda en ninguna parte */
  private demo(): Trip {
    const tr = blankTrip(t("demo.name"), "2027-04-03", "2027-04-14", [
      { city: t("demo.c1"), country: t("demo.country"), nights: 6, travelers: ["Ana", "Leo"] },
      { city: t("demo.c2"), country: t("demo.country"), nights: 5, travelers: ["Ana", "Leo"] }], ["Ana", "Leo"], "bermellon");
    tr.days[0].items.push(newItem("flight", { time: "11:55", title: "MAD → NRT" }));
    tr.days[1].items.push(newItem("place", { time: "09:00", link: t("demo.p1"), title: t("demo.p1") }), newItem("place", { time: "18:30", link: t("demo.p2"), title: t("demo.p2") }));
    return tr;
  }

  /* 1 · Tus notas */
  private s1(body: HTMLElement) {
    const s = this.plugin.settings;
    this.head(body, t("s1.h"), t("s1.p"));
    const block = (title: string, desc: string, iconName: string, r: Recog, kind: string, folderLabel: string, folder: () => string, setFolder: (v: string) => void) => {
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
      } else if (r.mode === "tag") how = h("div", { cls: "ct-set-how" }, this.text(r.value ? "#" + r.value.replace(/^#/, "") : "", v => { r.value = v.replace(/^#/, ""); this.save(); }, { placeholder: "#" + kind, "aria-label": t("s1.tag") }));
      else how = h("span", { cls: "ct-sub" }, t("s1.folderHint", { k: kind }));
      /* con «Carpeta», el desplegable de abajo elige esa carpeta (y ahí se guardan los nuevos) */
      const inFolder = r.mode === "folder";
      const pick = s.autoOrganize ? h("span", { cls: "ct-set-auto" }, icon("sparkles"), folder())
        : this.folderSelect(inFolder ? r.folder : folder(), v => { if (inFolder) r.folder = v; setFolder(v); this.save(); }, inFolder ? "—" : t("s1.root"));
      return [
        h("div", { cls: "ct-set-card ct-set-recog" },
          h("div", { cls: "ct-set-card-top" }, h("span", { cls: "ct-set-icon" }, icon(iconName)),
            h("span", { cls: "ct-set-card-text" }, h("b", { cls: "is-caps" }, title), h("span", null, desc))),
          h("div", { cls: "ct-set-recog-how" }, radios, how)),
        h("label", { cls: "ct-f ct-set-save" }, h("span", { cls: "ct-label" }, inFolder && !s.autoOrganize ? folderLabel : t("s1.saveIn")), pick),
      ];
    };
    body.append(...block(t("s1.trips"), t("s1.tripsD"), "plane", s.trips, t("s1.trip"), t("s1.tripsFolder"),
      () => s.autoOrganize ? AUTO_FOLDERS[s.language].trips : s.tripFolder, v => { s.tripFolder = v; }));
    body.append(...block(t("s1.places"), t("s1.placesD"), "map-pin", s.places, t("s1.place"), t("s1.placesFolder"),
      () => s.autoOrganize ? AUTO_FOLDERS[s.language].places + "/…" : s.placeFolder, v => { s.placeFolder = v; }));
    body.appendChild(h("div", { cls: "ct-set-autoorg" },
      h("b", { cls: "ct-set-autoorg-title" }, t("s1.auto"), h("span", { cls: "ct-sub" }, " · " + t("s1.optional"))),
      h("p", { cls: "ct-set-autoorg-text" }, h("b", null, t("s1.autoB")), " ", t("s1.autoD")),
      this.tree(),
      button([icon(s.autoOrganize ? "check" : "sparkles"), s.autoOrganize ? t("s1.usingAuto") : t("s1.useAuto")], "ct-set-btn ct-set-autoorg-btn" + (s.autoOrganize ? " is-on" : ""),
        () => { s.autoOrganize = !s.autoOrganize; this.save(); this.display(); })));
  }
  private basePath(kind: "trips" | "places") {
    const folder = this.plugin.settings.bases[kind];
    return normalizePath((folder ? folder + "/" : "") + t("s5." + kind) + ".base");
  }
  private baseExists(kind: "trips" | "places") { return this.app.vault.getAbstractFileByPath(this.basePath(kind)) instanceof TFile; }
  /* lo que quedaría en el vault con la organización automática, con los viajes y lugares que ya tienes */
  private tree(): HTMLElement {
    const s = this.plugin.settings, F = AUTO_FOLDERS[s.language];
    const trips = this.app.vault.getMarkdownFiles().filter(f => isTripFile(this.app, s, f)).map(f => f.basename).sort().reverse().slice(0, 3);
    const cities = new Map<string, string[]>();
    for (const p of allPlaces(this.app, s)) if (p.city) cities.set(p.city, [...(cities.get(p.city) || []), p.name]);
    const row = (depth: number, ico: string, name: string, base = false) => h("span", { cls: "ct-set-tree-row", attr: { style: `--d: ${depth}` } },
      icon(ico), name, base ? h("span", { cls: "ct-set-tree-tag" }, "BASE") : null);
    const more = (depth: number) => h("span", { cls: "ct-set-tree-row is-faint", attr: { style: `--d: ${depth}` } }, "…");
    const kids: HTMLElement[] = [row(0, "folder", F.trips)];
    kids.push(...(trips.length ? trips.map(n => row(1, "file", n)) : [more(1)]));
    if (this.baseExists("trips")) kids.push(row(1, "table", t("s5.trips"), true));
    kids.push(row(0, "folder", F.places));
    const cs = [...cities.keys()].sort().slice(0, 2);
    if (!cs.length) kids.push(more(1));
    for (const c of cs) kids.push(row(1, "folder", c), ...(cities.get(c) || []).sort().slice(0, 2).map(n => row(2, "file", n)));
    if (this.baseExists("places")) kids.push(row(1, "table", t("s5.places"), true));
    return h("div", { cls: "ct-set-tree", attr: { "aria-label": t("s1.preview") } }, kids);
  }

  /* 2 · Propiedades */
  private s2(body: HTMLElement) {
    const s = this.plugin.settings, used = this.vaultProps(), sug = suggestedProps(s.language);
    this.head(body, t("s2.h"), t("s2.p"));
    const TYPE_ICON: Record<string, string> = { date: "calendar", list: "list", text: "type", number: "hash", checkbox: "square-check" };
    const req = h("p", { cls: "ct-set-req" }, h("span", { cls: "ct-req" }, "*"), " ", t("s2.req"));
    const row = (k: keyof PropNames, type: string, need: boolean) => {
      const val = s.props[k], isUsed = used.has(val);
      const others = [...used].filter(p => p !== sug[k]).sort((a, b) => a.localeCompare(b));
      const opts: [string, string][] = [[sug[k], t("s2.suggested", { p: sug[k] })], ...others.map(p => [p, p] as [string, string])];
      if (val && !opts.some(([v]) => v === val)) opts.push([val, val]);
      opts.push(["\u0000other", t("s2.other")]);
      const sel = this.select(opts, val, v => {
        if (v !== "\u0000other") { s.props[k] = v; this.save(); this.display(); return; }
        void promptText(this.app, t("p." + k), sug[k], val).then(name => {
          if (name?.trim()) { s.props[k] = name.trim(); this.save(); }
          this.display();
        });
      }, t("s2.yours") + " · " + t("p." + k));
      return h("div", { cls: "ct-set-prop" },
        h("span", { cls: "ct-set-prop-name" }, t("p." + k), need ? h("span", { cls: "ct-req", attr: { "aria-label": t("s2.reqShort") } }, "*") : null),
        h("span", { cls: "ct-set-prop-desc" }, t(`p.${k}D`)),
        h("span", { cls: "ct-set-type" }, icon(TYPE_ICON[type]), t("t." + type)),
        h("span", { cls: "ct-set-prop-in" }, sel),
        h("span", { cls: "ct-set-state" + (isUsed ? " is-used" : "") }, isUsed ? t("s2.used") : t("s2.new")));
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
    const f = this.plugin.settings.files;
    this.head(body, t("s3.h"), t("s3.p"));
    const TAG: Record<string, string> = { cloud: "is-accent", wallet: "is-green", device: "", vault: "is-amber" };
    const opt = (k: "cloud" | "wallet" | "device" | "vault", tag: string, sub: string, extra: HTMLElement | null) =>
      h("label", { cls: "ct-set-card is-check" + (f[k] ? " is-on" : "") }, this.check(f[k], v => { f[k] = v; this.save(); this.display(); }),
        h("span", { cls: "ct-set-card-text" },
          h("span", { cls: "ct-set-opt-title" }, h("b", null, t("s3." + k)), sub ? h("span", { cls: "ct-sub" }, sub) : null),
          h("span", { cls: "ct-set-tag " + TAG[k] }, tag),
          h("span", null, t(`s3.${k}D`)), extra));
    const opts = h("div", { cls: "ct-set-files-opts" }, this.label(t("s3.where")),
      opt("cloud", t("s3.rec"), t("s3.cloudSub"), h("span", { cls: "ct-set-warn", attr: { role: "note" } }, icon("triangle-alert"), h("span", null, h("b", null, t("s3.careful")), " ", t("s3.cloudWarn")))),
      opt("wallet", t("s3.offline"), t("s3.walletSub"), null),
      opt("device", t("s3.only"), "", null),
      opt("vault", t("s3.space"), "", f.vault ? h("label", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s3.vaultFolder")),
        this.folderSelect(f.vaultFolder, v => { f.vaultFolder = v; this.save(); }, t("s1.root"))) : null));
    /* la vista previa: una reserva de la nota con los botones de los sitios que marques */
    const tr = this.demo();
    const wheres = (["cloud", "wallet", "device", "vault"] as Where[]).filter(w => f[w as "cloud"]);
    const docs = [...new Set(wheres.map(w => w === "vault" || w === "device" ? "cloud" : w))].map(w =>
      w === "wallet" ? blankDoc("wallet", { name: t("s3.wallet.btn") }) : blankDoc(wheres.includes("cloud") ? "cloud" : wheres.includes("vault") ? "vault" : "device", { name: t("s3.file") }));
    const preview = h("div", { cls: "ct-set-files-prev" }, this.label(t("s3.preview")),
      h("div", { cls: "ct-set-card ct-set-prev-card", attr: { role: "img", "aria-label": t("s3.preview") } },
        h("span", { cls: "ct-set-crumb" }, tr.name, h("span", { attr: { "aria-hidden": "true" } }, "›"), h("b", null, t("s3.bookings"))),
        h("div", { cls: "ct-set-booking" },
          h("div", { cls: "ct-set-booking-top" }, h("span", null, t("s3.flightLine")), h("b", null, "MAD → NRT")),
          h("div", { cls: "ct-set-booking-fields" }, ([["s3.locator", "K7QX2P"], ["s3.seat", "23A"], ["s3.gate", "S24"]] as const).map(([k, v]) => h("span", null, t(k), h("b", null, v)))),
          docs.length ? h("div", { cls: "ct-set-booking-docs" }, docs.map(d => docButton({ openDoc: () => {} }, d))) : null)));
    body.appendChild(h("div", { cls: "ct-set-files" }, opts, preview));
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

  /* 5 · Bases */
  private s5(body: HTMLElement) {
    const s = this.plugin.settings;
    this.head(body, t("s5.h"), t("s5.p"));
    body.appendChild(h("div", { cls: "ct-set-promo" },
      h("span", { cls: "ct-set-promo-icon" }, icon("layout-grid")),
      h("span", { cls: "ct-set-card-text" }, h("b", null, t("s5.promoH")), h("span", null, t("s5.promo"))),
      button(t("s5.promoBtn"), "ct-set-promo-btn", () => { window.open("https://github.com/pattgue/cool-bases"); })));
    const card = (kind: "trips" | "places") => {
      const p = this.basePath(kind), exists = this.baseExists(kind), name = t("s5." + kind);
      const open = () => { const f = this.app.vault.getAbstractFileByPath(p); if (f instanceof TFile) void this.app.workspace.getLeaf("tab").openFile(f); };
      const create = async () => {
        await ensureFolder(this.app, s.bases[kind]);
        await this.app.vault.create(p, this.baseYaml(kind, name));
        new Notice(t("s5.created", { p }));
        this.display();
      };
      const left = h("div", { cls: "ct-set-base-main" },
        h("label", { cls: "ct-set-base-on" }, this.check(exists, on => { if (on && !exists) void create(); }, exists ? { disabled: "" } : {}), h("b", { cls: "is-caps" }, name)),
        h("span", { cls: "ct-set-base-desc" }, t(`s5.${kind}D`)),
        exists ? h("span", { cls: "ct-set-base-path" }, icon("table"), h("span", null, p), button(t("s5.open"), "ct-set-btn is-small", open))
          : h("label", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s5.saveIn")),
            this.folderSelect(s.bases[kind], v => { s.bases[kind] = v; this.save(); }, t("s1.root"))));
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
    const cols = kind === "trips" ? ["file.name", `note.${P.start}`, `note.${P.end}`, `note.${P.destinations}`, `note.${P.travelers}`]
      : ["file.name", `note.${P.city}`, `note.${P.category}`, `note.${P.rating}`, `note.${P.visited}`];
    const sort = kind === "trips" ? `    sort:\n      - property: note.${P.start}\n        direction: DESC\n` : `    sort:\n      - property: note.${P.city}\n        direction: ASC\n`;
    return `filters:\n  and:\n    - ${filter}\nviews:\n  - type: table\n    name: ${q(name)}\n    order:\n${cols.map(c => `      - ${c}`).join("\n")}\n${sort}`;
  }

  /* 6 · Cool Bar: los ajustes compartidos del Cool Kit (los mismos datos que en los demás plugins Cool), con su vista previa */
  private s6(body: HTMLElement) {
    this.head(body, t("s6.h"), t("s6.p"));
    const p = devicePrefs(this.barDevice), tools = sortedTools(p);
    const save = () => { void saveBarSettings(); this.display(); };
    /* la barra tal como queda en una nota de viaje (con las clases de la barra de verdad) */
    const bar = h("div", { cls: "cool-bar" + (p.collapsed ? " is-collapsed" : ""), attr: { "data-ck": String(KIT_VERSION), "data-align": p.align, "data-loc": p.location } },
      h("span", { cls: "cool-fold" }, icon(p.collapsed ? "chevron-down" : "chevron-up")),
      p.collapsed ? null : h("div", { cls: "cool-tools" }, tools.flatMap(tl => {
        const vis = p.tools[tl.id]?.visibility || "always", mine = tl.id === this.plugin.manifest.id;
        if (vis === "never" || (!mine && vis === "applies")) return [];
        return [h("span", { cls: "cool-tool", attr: mine ? { "data-state": "active", "data-kind": "view" } : { "data-state": "locked" } }, tl.label())];
      })));
    const note = h("div", { cls: "ct-set-bar-note" }, h("b", null, t("demo.name")));
    const preview = h("div", { cls: "ct-set-bar-prev is-" + p.location, attr: { role: "img", "aria-label": t("s6.preview") } },
      p.location === "bottom" ? [note, bar] : [bar, note]);
    const tabs = h("div", { cls: "ct-set-tabs", attr: { role: "tablist", "aria-label": kt("s.device") } }, (["desktop", "phone"] as Device[]).map(d =>
      button(kt("s." + d), "ct-set-tab" + (d === this.barDevice ? " is-on" : ""), () => { this.barDevice = d; this.display(); }, { role: "tab", "aria-selected": String(d === this.barDevice) })));
    const row = (name: string, desc: string | null, control: HTMLElement, cls = "") => h("div", { cls: "ct-set-row " + cls },
      h("span", { cls: "ct-set-row-text" }, h("b", null, name), desc ? h("span", null, desc) : null), control);
    const barCard = h("div", { cls: "ct-set-card ct-set-rows" },
      h("div", { cls: "ct-set-row is-head" }, h("b", null, t("s6.bar")), tabs),
      row(kt("s.location"), null, this.select([["top", kt("s.top")], ["bottom", kt("s.bottom")], ["float", kt("s.float")]], p.location, v => { p.location = v as BarLocation; save(); }, kt("s.location"))),
      row(kt("s.align"), null, this.select([["right", kt("s.right")], ["center", kt("s.center")], ["left", kt("s.left")]], p.align, v => { p.align = v as BarAlign; save(); }, kt("s.align"))),
      row(kt("s.mode"), kt("s.modeDesc"), this.select([["fixed", kt("s.fixed")], ["context", kt("s.context")], ["hidden", kt("s.hidden")]], p.mode, v => { p.mode = v as BarMode; registry().toggled = false; save(); }, kt("s.mode"))),
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
    body.append(h("div", { cls: "ct-set-bar-block" }, this.label(t("s6.preview")), preview), h("div", { cls: "ct-set-grid is-bar" }, barCard, btnCard));
  }

  /* 7 · Listo */
  private s7(body: HTMLElement) {
    this.head(body, t("s7.h"), t("s7.p"));
    const tr = this.demo();
    /* lo que se guarda: el Markdown de verdad del viaje de ejemplo (sin las secciones y días vacíos) */
    const md = serializeTrip(tr, this.plugin.settings).split("\n");
    const lines: HTMLElement[] = [];
    const level = (l: string) => /^(#{2,3}) /.exec(l)?.[1].length ?? 0;
    const hasContent = (i: number) => {
      for (let j = i + 1; j < md.length; j++) { const lj = level(md[j]); if (lj && lj <= level(md[i])) return false; if (!lj && md[j].trim()) return true; }
      return false;
    };
    let fm = 0;
    for (let i = 0; i < md.length && lines.length < 22; i++) {
      const l = md[i];
      if (l === "---") fm++;
      if (!l.trim() || (level(l) && !hasContent(i))) continue;
      const cls = fm < 2 || l === "---" || l.startsWith(">") ? "is-fm" : level(l) === 2 ? "is-h2" : level(l) === 3 ? "is-h3" : "";
      lines.push(h("span", { cls }, l.split(/(\[\[[^\]]+\]\])/).map(x => x.startsWith("[[") ? h("span", { cls: "is-link" }, x) : x)));
    }
    const zoom = h("div", { cls: "ct-set-zoom" }, h("div", { cls: "ct-view" + (Platform.isPhone ? " is-phone" : ""), attr: { style: `--ct-acc: ${coverHex(tr.cover)}; width: ${Platform.isPhone ? "100%" : NOTE_W + "px"}` } },
      ticket({ mode: "note", phone: Platform.isPhone, trip: tr, path: "", locked: true, changed: () => {}, prompt: () => Promise.resolve(null), promptDest: () => Promise.resolve(null), coverSrc: () => null })));
    body.appendChild(h("div", { cls: "ct-set-how-it" },
      h("div", { cls: "ct-set-card ct-set-md" }, this.label(t("s7.saved")), h("span", { cls: "ct-set-md-lines" }, lines)),
      h("span", { cls: "ct-set-how-arrow", attr: { "aria-hidden": "true" } }, icon("arrow-right")),
      h("div", { cls: "ct-set-card ct-set-sees" }, this.label(t("s7.sees")), h("div", { cls: "ct-set-sees-ticket", attr: { role: "img", "aria-label": t("s7.sees") } }, zoom))));
    const bar = h("span", { cls: "cool-bar ct-set-mini-bar", attr: { "data-ck": String(KIT_VERSION), "data-align": "right" } }, h("span", { cls: "cool-fold" }, icon("chevron-up")),
      h("span", { cls: "cool-tools" }, h("span", { cls: "cool-tool" }, "Cool Trip")));
    const form = h("span", { cls: "ct-set-mini-form" }, h("span", null, "09:00"), h("span", { cls: "is-grow" }, icon("map-pin"), t("demo.p1")), h("span", { cls: "is-add" }, t("s7.add")));
    const chips = h("span", { cls: "ct-set-mini-chips" }, ([["calendar", "s7.chipPlan"], ["ticket", "s7.chipBook"], ["file-text", "s7.chipDocs"]] as const).map(([i, k]) => h("span", null, icon(i), t(k))));
    const step = (n: number, visual: HTMLElement) => h("div", { cls: "ct-set-card ct-set-howstep" },
      h("span", { cls: "ct-set-howstep-head" }, h("span", { cls: "ct-set-num is-current" }, String(n)), h("b", null, t(`s7.${n}`))),
      h("span", { cls: "ct-set-howstep-visual" }, visual), h("span", { cls: "ct-set-howstep-desc" }, t(`s7.${n}d`)));
    const list = (title: string, keys: string[], ico: string, cls: string) => h("div", { cls: "ct-set-ul " + cls }, h("b", null, title),
      keys.map(k => h("span", null, icon(ico), t(k))));
    body.append(h("div", { cls: "ct-set-grid is-3 is-steps" }, step(1, bar), step(2, form), step(3, chips)),
      h("div", { cls: "ct-set-grid is-lists" }, list(t("s7.adds"), ["s7.adds1", "s7.adds2", "s7.adds3"], "plus", "is-adds"), list(t("s7.keeps"), ["s7.keeps1", "s7.keeps2", "s7.keeps3"], "shield-check", "is-keeps")));
  }
}
