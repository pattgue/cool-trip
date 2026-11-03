/* Ajustes › 3 · Archivos: dónde llevas los billetes y documentos. */
import { h } from "../dom";
import { t } from "../i18n";
import { blankDoc } from "../docs";
import { bookingCard } from "../plan";
import type { PlanCtx } from "../plan";
import type { Doc, Where } from "../types";
import { coverHex, icon } from "../ui";
import type { CoolTripSettingTab } from "../settings-tab";

/* 3 · Archivos */
export function stepFiles(tab: CoolTripSettingTab, body: HTMLElement) {
  const s = tab.plugin.settings, f = s.files;
  tab.head(body, t("s3.h"), t("s3.p"));
  const TAG: Record<string, string> = { cloud: "is-accent", wallet: "is-green", device: "", vault: "is-amber" };
  const opt = (k: "cloud" | "wallet" | "device" | "vault", tag: string, sub: string, extra: HTMLElement | null) =>
    h("label", { cls: "ct-set-card is-check" + (f[k] ? " is-on" : "") }, tab.check(f[k], v => { f[k] = v; tab.save(); tab.display(); }),
      h("span", { cls: "ct-set-card-text" },
        h("span", { cls: "ct-set-opt-title" }, h("b", null, t("s3." + k)), sub ? h("span", { cls: "ct-sub" }, sub) : null),
        h("span", { cls: "ct-set-tag " + TAG[k] }, tag),
        h("span", null, t(`s3.${k}D`)), extra));
  /* la vista previa: la reserva de verdad del plan, con los documentos en los sitios que marques */
  const tr = tab.demo(), it = tr.days[0].items[0];
  const files = (["cloud", "device", "vault"] as Where[]).filter(w => f[w as "cloud"]);
  const docs: Doc[] = [];
  if (files.length) docs.push(blankDoc(files[0], { name: t("demo.file"), url: files[0] === "cloud" ? "https://drive.google.com/" : "", also: files.slice(1) }));
  if (f.wallet) docs.push(blankDoc("wallet", { name: t("demo.pass"), para: ["Ana"] }), blankDoc("wallet", { name: t("demo.pass2"), para: ["Leo"] }));
  it.docs = docs;
  const ctx = (phone: boolean): PlanCtx => ({
    app: tab.app, s, trip: tr, file: null, phone, form: null, collapsed: new Set(), docAdd: null,
    setDocAdd: () => {}, commit: () => {}, rerender: () => {}, openForm: () => {}, renderForm: () => h("div"), openLink: () => {}, openDoc: () => {}, openUrl: () => {}, move: () => {},
  });
  const acc = coverHex(tr.cover);
  body.append(
    h("div", { cls: "ct-set-files-prev" }, tab.label(t("s3.preview")),
      tab.real("ct-set-real-card", [bookingCard(ctx(false), 0, 0), 560], [bookingCard(ctx(true), 0, 0), 320], acc)),
    h("div", { cls: "ct-set-files-opts" }, tab.label(t("s3.where")),
      opt("cloud", t("s3.rec"), t("s3.cloudSub"), h("span", { cls: "ct-set-warn", attr: { role: "note" } }, icon("triangle-alert"), h("span", null, h("b", null, t("s3.careful")), " ", t("s3.cloudWarn")))),
      opt("wallet", t("s3.offline"), t("s3.walletSub"), null),
      opt("device", t("s3.only"), "", null),
      opt("vault", t("s3.space"), "", f.vault ? h("div", { cls: "ct-f" }, h("span", { cls: "ct-label" }, t("s3.vaultFolder")),
        tab.folderPicker(f.vaultFolder, v => { f.vaultFolder = v; tab.save(); tab.display(); }, t("s3.vaultFolder"))) : null)));
}
