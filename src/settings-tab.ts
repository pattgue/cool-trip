/* Ajustes › Cool Trip: los siete pasos del boceto (Tus notas, Propiedades, Archivos, Mapas, Bases, Cool Bar, Listo).
   Cada cambio se guarda al momento. */
import { App, Notice, Platform, PluginSettingTab, TFile, TFolder, normalizePath } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t } from "./i18n";
import { renderCoolBarSettings } from "./cool-kit/settings";
import { AUTO_FOLDERS, suggestedProps } from "./settings";
import { ensureFolder } from "./places";
import type { MapsApp, PropNames, Recog, RecogMode } from "./types";
import { button, icon } from "./ui";

const STEPS = 7;

export class CoolTripSettingTab extends PluginSettingTab {
  plugin: CoolTripPlugin;
  step = 1;
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

  display(): void {
    const el = this.containerEl;
    el.empty();
    el.addClass("ct-root", "ct-settings");
    el.toggleClass("is-phone", Platform.isPhone);
    const s = this.plugin.settings;
    if (!s.visited.includes(this.step)) { s.visited.push(this.step); this.save(); }
    const nav = h("nav", { cls: "ct-set-nav", attr: { "aria-label": t("s.subtitle") } });
    if (!Platform.isPhone) nav.appendChild(h("div", { cls: "ct-set-brand" }, h("span", { cls: "ct-set-logo" }, t("s.title")), h("span", { cls: "ct-sub" }, t("s.subtitle"))));
    const list = nav.createDiv({ cls: "ct-set-steps" });
    for (let i = 1; i <= STEPS; i++) {
      const state = i === this.step ? "is-current" : s.visited.includes(i) ? "is-done" : "";
      list.appendChild(button([h("span", { cls: "ct-set-num " + state }, String(i)),
        Platform.isPhone ? null : h("span", { cls: "ct-set-step-text" }, h("b", null, t(`s.${i}`)), h("span", null, t(`s.${i}d`)))],
      "ct-set-step" + (i === this.step ? " is-current" : ""), () => { this.step = i; this.display(); }, { "aria-current": i === this.step ? "step" : "false", "aria-label": t(`s.${i}`) }));
    }
    const body = h("div", { cls: "ct-set-body" });
    const steps: ((b: HTMLElement) => void)[] = [b => this.s1(b), b => this.s2(b), b => this.s3(b), b => this.s4(b), b => this.s5(b), b => this.s6(b), b => this.s7(b)];
    steps[this.step - 1](body);
    body.appendChild(h("div", { cls: "ct-set-foot" },
      this.step > 1 ? button(t("s.back"), "ct-set-btn", () => { this.step--; this.display(); }) : h("span"),
      h("span", { cls: "ct-sub" }, this.step === STEPS ? t("s7.done") : t("saved")),
      this.step < STEPS ? button(t("s.next"), "ct-set-btn is-primary", () => { this.step++; this.display(); })
        : button(t("s.ready"), "ct-set-btn is-primary", () => { new Notice(t("s7.done")); })));
    el.appendChild(h("div", { cls: "ct-set" }, nav, body));
  }

  private head(body: HTMLElement, title: string, p: string) {
    body.appendChild(h("div", { cls: "ct-set-head" }, h("h2", null, title), h("p", null, p)));
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
  private text(value: string, onInput: (v: string) => void, attr: Record<string, string> = {}): HTMLInputElement {
    const el = h("input", { cls: "ct-input", attr: { type: "text", value, ...attr } });
    el.addEventListener("change", () => onInput(el.value.trim()));
    return el;
  }

  /* 1 · Tus notas */
  private s1(body: HTMLElement) {
    const s = this.plugin.settings;
    this.head(body, t("s1.h"), t("s1.p"));
    const card = (title: string, desc: string, iconName: string, r: Recog, kind: string, folder: () => string, setFolder: (v: string) => void) => {
      const modes: [RecogMode, string][] = [["property", t("s1.property")], ["tag", t("s1.tag")], ["folder", t("s1.folder")]];
      const how = h("div", { cls: "ct-set-how" });
      if (r.mode === "property") how.append(this.text(r.key, v => { r.key = v; this.save(); }, { placeholder: "tipo" }), h("span", { cls: "ct-eq" }, "="),
        this.text(r.value, v => { r.value = v; this.save(); }, { placeholder: kind }));
      else if (r.mode === "tag") how.append(h("span", { cls: "ct-eq" }, "#"), this.text(r.value.replace(/^#/, ""), v => { r.value = v.replace(/^#/, ""); this.save(); }, { placeholder: kind }));
      else how.append(this.folderSelect(r.folder, v => { r.folder = v; this.save(); }, "—"), h("span", { cls: "ct-sub" }, t("s1.folderHint", { k: kind })));
      return h("div", { cls: "ct-set-card" },
        h("div", { cls: "ct-set-card-top" }, h("span", { cls: "ct-set-icon" }, icon(iconName)),
          h("span", { cls: "ct-set-card-text" }, h("b", null, title), h("span", null, desc))),
        h("div", { cls: "ct-seg" }, modes.map(([m, l]) => button(l, "ct-pill" + (r.mode === m ? " is-solid" : ""), () => { r.mode = m; this.save(); this.display(); }))),
        how,
        h("label", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s1.saveIn")),
          s.autoOrganize ? h("span", { cls: "ct-set-auto" }, icon("sparkles"), folder()) : this.folderSelect(folder(), v => { setFolder(v); this.save(); }, t("s1.root"))));
    };
    body.appendChild(h("div", { cls: "ct-set-grid" },
      card(t("s1.trips"), t("s1.tripsD"), "plane", s.trips, t("s1.trip"), () => s.autoOrganize ? AUTO_FOLDERS[s.language].trips : s.tripFolder, v => { s.tripFolder = v; }),
      card(t("s1.places"), t("s1.placesD"), "map-pin", s.places, t("s1.place"), () => s.autoOrganize ? AUTO_FOLDERS[s.language].places + "/…" : s.placeFolder, v => { s.placeFolder = v; })));
    body.appendChild(h("div", { cls: "ct-set-card is-row" },
      h("span", { cls: "ct-set-card-text" }, h("b", null, t("s1.auto")), h("span", null, t("s1.autoD"))),
      button([icon(s.autoOrganize ? "check" : "smile"), s.autoOrganize ? t("s1.usingAuto") : t("s1.useAuto")], "ct-set-btn" + (s.autoOrganize ? " is-on" : " is-primary"),
        () => { s.autoOrganize = !s.autoOrganize; this.save(); this.display(); })));
  }

  /* 2 · Propiedades */
  private s2(body: HTMLElement) {
    const s = this.plugin.settings, used = this.vaultProps(), sug = suggestedProps(s.language);
    this.head(body, t("s2.h"), t("s2.p"));
    const row = (k: keyof PropNames, type: string, req: boolean) => {
      const val = s.props[k];
      const state = used.has(val) ? t("s2.used") : t("s2.new");
      const list = h("datalist", { attr: { id: "ct-props-" + k } }, [...used].sort().map(p => h("option", { attr: { value: p } })));
      return h("div", { cls: "ct-set-prop" },
        h("span", { cls: "ct-set-prop-name" }, h("b", null, t("p." + k), req ? h("span", { cls: "ct-req" }, "*") : null), h("span", null, t(`p.${k}D`))),
        h("span", { cls: "ct-set-type" }, t("t." + type)),
        h("span", { cls: "ct-set-prop-in" }, this.text(val, v => { s.props[k] = v || sug[k]; this.save(); this.display(); }, { list: "ct-props-" + k, placeholder: sug[k] }), list),
        h("span", { cls: "ct-set-state" + (used.has(val) ? " is-used" : "") }, state));
    };
    body.append(
      h("div", { cls: "ct-set-table" }, h("span", { cls: "ct-set-group" }, t("s2.trip")),
        row("start", "date", true), row("end", "date", true), row("destinations", "list", true), row("travelers", "list", false), row("cover", "text", false),
        h("span", { cls: "ct-set-group" }, t("s2.place")),
        row("location", "list", true), row("city", "text", true), row("country", "text", false), row("category", "text", false),
        row("price", "text", false), row("rating", "number", false), row("visited", "checkbox", false)),
      h("p", { cls: "ct-sub" }, h("span", { cls: "ct-req" }, "* "), t("s2.req")));
  }

  /* 3 · Archivos */
  private s3(body: HTMLElement) {
    const f = this.plugin.settings.files;
    this.head(body, t("s3.h"), t("s3.p"));
    const opt = (k: "cloud" | "wallet" | "device" | "vault", tag: string, extra: HTMLElement | null) => {
      const cb = h("input", { attr: { type: "checkbox" } });
      cb.checked = f[k];
      cb.addEventListener("change", () => { f[k] = cb.checked; this.save(); this.display(); });
      return h("label", { cls: "ct-set-card is-check" + (f[k] ? " is-on" : "") }, cb,
        h("span", { cls: "ct-set-card-text" }, h("b", null, t("s3." + k), h("span", { cls: "ct-set-tag" }, tag)), h("span", null, t(`s3.${k}D`)), extra));
    };
    body.append(h("p", { cls: "ct-label" }, t("s3.where")),
      h("div", { cls: "ct-set-list" },
        opt("cloud", t("s3.rec"), h("span", { cls: "ct-set-warn" }, icon("triangle-alert"), t("s3.cloudWarn"))),
        opt("wallet", t("s3.offline"), null),
        opt("device", t("s3.only"), null),
        opt("vault", t("s3.space"), f.vault ? h("label", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s3.vaultFolder")),
          this.folderSelect(f.vaultFolder, v => { f.vaultFolder = v; this.save(); }, t("s1.root"))) : null)),
      h("p", { cls: "ct-sub" }, t("s3.paper")));
  }

  /* 4 · Mapas */
  private s4(body: HTMLElement) {
    const m = this.plugin.settings.maps;
    this.head(body, t("s4.h"), t("s4.p"));
    const app = (k: MapsApp) => button([h("b", null, t("s4." + k)), h("span", null, t(`s4.${k}D`))], "ct-set-card is-radio" + (m.app === k ? " is-on" : ""),
      () => { m.app = k; this.save(); this.display(); }, { role: "radio", "aria-checked": String(m.app === k) });
    const mode = (k: string) => {
      const on = m.modes.includes(k);
      return button([icon(on ? "check" : "plus"), t("m." + k)], "ct-pill" + (on ? " is-solid" : " is-dashed"), () => {
        m.modes = on ? m.modes.filter(x => x !== k) : [...m.modes, k]; this.save(); this.display();
      });
    };
    body.append(h("div", { cls: "ct-set-grid is-3", attr: { role: "radiogroup" } }, app("google"), app("apple"), app("organic")),
      h("p", { cls: "ct-set-subhead" }, h("b", null, t("s4.modes")), h("span", { cls: "ct-sub" }, " · " + t("s4.modesHint"))),
      h("div", { cls: "ct-row-btns" }, ["walk", "transit", "car", "bike", "taxi"].map(mode)));
  }

  /* 5 · Bases */
  private s5(body: HTMLElement) {
    const s = this.plugin.settings;
    this.head(body, t("s5.h"), t("s5.p"));
    const path = (name: string) => normalizePath((s.bases.folder ? s.bases.folder + "/" : "") + name + ".base");
    const card = (kind: "trips" | "places") => {
      const name = t("s5." + kind), p = path(name), exists = this.app.vault.getAbstractFileByPath(p) instanceof TFile;
      return h("div", { cls: "ct-set-card" },
        h("div", { cls: "ct-set-card-top" }, h("span", { cls: "ct-set-icon" }, icon(kind === "trips" ? "plane" : "map-pin")),
          h("span", { cls: "ct-set-card-text" }, h("b", null, name), h("span", null, t(`s5.${kind}D`)))),
        h("span", { cls: "ct-sub" }, p),
        button(exists ? t("s5.exists") : t("s5.create"), "ct-set-btn" + (exists ? "" : " is-primary"), () => void (async () => {
          if (!exists) {
            await ensureFolder(this.app, s.bases.folder);
            await this.app.vault.create(p, this.baseYaml(kind, name));
            new Notice(t("s5.created", { p }));
          }
          const f = this.app.vault.getAbstractFileByPath(p);
          if (f instanceof TFile) await this.app.workspace.getLeaf("tab").openFile(f);
          this.display();
        })()));
    };
    body.append(
      h("label", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s5.folder")), this.folderSelect(s.bases.folder, v => { s.bases.folder = v; this.save(); this.display(); }, t("s1.root"))),
      h("div", { cls: "ct-set-grid" }, card("trips"), card("places")),
      h("p", { cls: "ct-set-note" }, icon("id-card"), t("s5.coolBases")));
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

  /* 6 · Cool Bar */
  private s6(body: HTMLElement) {
    this.head(body, t("s6.h"), t("s6.p"));
    renderCoolBarSettings(body.createDiv({ cls: "ct-set-coolbar" }));
  }

  /* 7 · Listo */
  private s7(body: HTMLElement) {
    this.head(body, t("s7.h"), t("s7.p"));
    const step = (n: number) => h("div", { cls: "ct-set-card" }, h("span", { cls: "ct-set-num is-current" }, String(n)),
      h("span", { cls: "ct-set-card-text" }, h("b", null, t(`s7.${n}`)), h("span", null, t(`s7.${n}d`))));
    const list = (title: string, keys: string[], ico: string) => h("div", { cls: "ct-set-card" }, h("b", null, title),
      h("ul", { cls: "ct-set-ul" }, keys.map(k => h("li", null, icon(ico), t(k)))));
    body.append(h("div", { cls: "ct-set-grid is-3" }, step(1), step(2), step(3)),
      h("div", { cls: "ct-set-grid" }, list(t("s7.adds"), ["s7.adds1", "s7.adds2", "s7.adds3"], "plus"), list(t("s7.keeps"), ["s7.keeps1", "s7.keeps2", "s7.keeps3"], "shield-check")));
  }
}
