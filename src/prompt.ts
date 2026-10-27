/* Una ventanita para pedir un texto (un destino, un viajero, el nombre de la nota…). */
import { App, Modal } from "obsidian";
import { h } from "./dom";
import { t } from "./i18n";

export function promptText(app: App, title: string, placeholder: string, value = ""): Promise<string | null> {
  return new Promise(resolve => {
    let done = false;
    const m = new Modal(app);
    m.modalEl.addClass("ct-root", "ct-prompt");
    m.titleEl.setText(title);
    const input = h("input", { cls: "ct-input", attr: { type: "text", value, placeholder } });
    const ok = () => { done = true; resolve(input.value.trim() || null); m.close(); };
    input.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); ok(); } });
    const save = h("button", { cls: "ct-btn-primary", attr: { type: "button" } }, t("f.save"));
    save.addEventListener("click", ok);
    m.contentEl.append(input, h("div", { cls: "ct-form-foot" }, h("span", { cls: "ct-grow" }), save));
    m.onClose = () => { if (!done) resolve(null); };
    m.open();
    window.setTimeout(() => { input.focus(); input.select(); }, 30);
  });
}

/* los países, en el idioma de Obsidian (Intl, sin descargar nada) */
const ISO = ("AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ " +
  "OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW").split(" ");
let countryCache: string[] | null = null;
export function countries(lang: string): string[] {
  if (countryCache) return countryCache;
  try {
    const dn = new Intl.DisplayNames([lang], { type: "region" });
    countryCache = ISO.map(c => dn.of(c) || c).sort((a, b) => a.localeCompare(b, lang));
  } catch { countryCache = []; }
  return countryCache;
}

/* un destino: la ciudad y su país (con el país ya puesto si se sabe) */
export function promptDest(app: App, title: string, lang: string, city: string, country: string, guess: (city: string) => string): Promise<{ city: string; country: string } | null> {
  return new Promise(resolve => {
    let done = false, touched = !!country;
    const m = new Modal(app);
    m.modalEl.addClass("ct-root", "ct-prompt");
    m.titleEl.setText(title);
    const listId = "ct-countries";
    const cityIn = h("input", { cls: "ct-input", attr: { type: "text", value: city, placeholder: t("new.cityPh") } });
    const countryIn = h("input", { cls: "ct-input", attr: { type: "text", value: country, placeholder: t("new.countryPh"), list: listId } });
    const list = h("datalist", { attr: { id: listId } }, countries(lang).map(c => h("option", { attr: { value: c } })));
    cityIn.addEventListener("input", () => { if (!touched) countryIn.value = guess(cityIn.value.trim()); });
    countryIn.addEventListener("input", () => { touched = true; });
    const ok = () => {
      const c = cityIn.value.trim();
      if (!c) return;
      done = true; resolve({ city: c, country: countryIn.value.trim() }); m.close();
    };
    for (const el of [cityIn, countryIn]) el.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); ok(); } });
    const save = h("button", { cls: "ct-btn-primary", attr: { type: "button" } }, t("f.save"));
    save.addEventListener("click", ok);
    m.contentEl.append(h("div", { cls: "ct-grid ct-grid-2" },
      h("label", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("new.cityPh")), cityIn),
      h("label", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("new.countryPh")), countryIn, list)),
      h("div", { cls: "ct-form-foot" }, h("span", { cls: "ct-grow" }), save));
    m.onClose = () => { if (!done) resolve(null); };
    m.open();
    window.setTimeout(() => cityIn.focus(), 30);
  });
}
