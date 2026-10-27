/* «Nuevo viaje»: la tarjeta de embarque vacía. Crea la nota con las propiedades elegidas en los ajustes y la abre. */
import { Modal, Notice, Platform, normalizePath } from "obsidian";
import type CoolTripPlugin from "./main";
import { h } from "./dom";
import { t } from "./i18n";
import { isIso } from "./dates";
import { blankTrip, serializeTrip } from "./md";
import { ensureFolder } from "./places";
import { tripFolder } from "./settings";
import { ticket } from "./ticket";
import { promptText } from "./prompt";
import type { Trip } from "./types";
import { VIEW_TYPE } from "./view";
import { iconButton, paletteId } from "./ui";

export class NewTripModal extends Modal {
  plugin: CoolTripPlugin;
  trip: Trip;
  nameTouched = false;
  constructor(plugin: CoolTripPlugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.trip = blankTrip("", "", "", [], [], t("palette.bermellon").toLowerCase());
  }
  onOpen() {
    this.modalEl.addClass("ct-root", "ct-modal");
    this.modalEl.toggleClass("is-phone", Platform.isPhone);
    this.modalEl.querySelector(".modal-close-button")?.addClass("ct-hidden");        /* ya hay una ✕ junto al título */
    this.draw();
  }
  /* «2026 - Italia», «2026 - Italia y Grecia» o, sin país, «2026 - Roma y Palermo» */
  private autoName() {
    if (this.nameTouched) return;
    const y = isIso(this.trip.start) ? this.trip.start.slice(0, 4) : "";
    const ds = this.trip.dests;
    const list = ds.every(d => d.country) ? [...new Set(ds.map(d => d.country))] : ds.map(d => d.city);
    const and = t("bag") === "Mochila" ? " y " : " and ";
    const what = list.length > 1 ? list.slice(0, -1).join(", ") + and + list[list.length - 1] : list[0] || "";
    this.trip.name = [y, what].filter(Boolean).join(" - ");
  }
  private draw() {
    this.autoName();
    const el = this.contentEl;
    el.empty();
    const folder = tripFolder(this.plugin.settings);
    el.appendChild(h("div", { cls: "ct-modal-head" },
      h("span", { cls: "ct-h-modal" }, Platform.isPhone ? t("new.title") : `COOL TRIP  ·  ${t("new.title")}`),
      iconButton("x", t("close"), () => this.close(), "ct-ibtn")));
    el.appendChild(ticket({
      mode: "create", phone: Platform.isPhone, trip: this.trip,
      path: [folder, (this.trip.name || "…") + ".md"].filter(Boolean).join(" / "),
      changed: () => this.draw(),
      prompt: (title, ph, value) => promptText(this.app, title, ph, value),
      promptDest: (city, country, fb) => this.plugin.askDest(city, country, fb),
      coverSrc: cover => this.plugin.coverSrc(cover, ""),
      rename: name => { this.trip.name = name; this.nameTouched = true; this.draw(); },
      create: () => void this.create(),
    }));
  }
  private async create() {
    const tr = this.trip, s = this.plugin.settings;
    if (!tr.dests.length) { new Notice(t("new.needDest")); return; }
    if (!isIso(tr.start) || !isIso(tr.end)) { new Notice(t("new.needDates")); return; }
    const done = blankTrip(tr.name || tr.dests[0].city, tr.start, tr.end, tr.dests, tr.travelers, tr.cover, paletteId(tr.cover) ? "" : tr.accent);
    const folder = tripFolder(s);
    const path = normalizePath((folder ? folder + "/" : "") + done.name.replace(/[\\/:*?"<>|]/g, "") + ".md");
    if (this.app.vault.getAbstractFileByPath(path)) { new Notice(t("new.exists")); return; }
    await ensureFolder(this.app, folder);
    const file = await this.app.vault.create(path, serializeTrip(done, s));
    this.close();
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, state: { file: file.path }, active: true });
  }
}
