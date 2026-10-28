/* Los documentos: el botón fino que los abre y la ventanita para añadir uno (la misma en la mochila y en cada reserva). */
import { h } from "./dom";
import { t } from "./i18n";
import { cloudName } from "./places";
import type { Doc, Settings, Where } from "./types";
import { avatar, button, icon, label, miniPerson } from "./ui";

const LINKED: Where[] = ["cloud", "device", "vault"];
export const blankDoc = (where: Where, over: Partial<Doc> = {}): Doc => ({ name: "", where, url: "", also: [], para: [], ...over });
export const docWheres = (d: Doc): Where[] => [d.where, ...d.also.filter(w => w !== d.where)];
/* los sitios que usas (los de los ajustes) y el papel, que siempre está */
export function wheresOf(s: Settings): Where[] {
  const out = (["cloud", "wallet", "device", "vault"] as Where[]).filter(w => s.files[w as "cloud"]);
  out.push("paper");
  return out;
}
export const firstWhere = (s: Settings): Where => wheresOf(s)[0];
const whereIcon = (w: Where) => w === "wallet" ? "wallet" : w === "vault" ? "file" : w === "paper" ? "file-text" : w === "device" ? "smartphone" : "cloud";

/* un documento: un botón fino de una línea (los viajeros, como etiqueta; los sitios, a la derecha) */
export function docButton(ctx: { openDoc(d: Doc): void }, d: Doc, travelers: string[] = []): HTMLElement {
  const all = docWheres(d), paper = all.includes("paper");
  const others = all.filter(w => w !== "paper");
  /* solo el formato, como icono (el nombre del servicio, sin el enlace, queda en la etiqueta) */
  const whereText = (w: Where) => { const n = w === "cloud" ? cloudName(d.url) : ""; return n && !n.includes(".") ? n : t("w." + w); };
  return button([
    icon(d.where === "wallet" ? "wallet" : d.where === "vault" ? "file" : "file-text"),
    h("span", { cls: "ct-doc-name" }, d.name),
    d.para.length ? h("span", { cls: "ct-doc-para", attr: { "aria-label": d.para.join(", ") } },
      d.para.map(p => avatar(p, Math.max(0, travelers.indexOf(p)), "ct-avatar ct-avatar-tag"))) : null,
    h("span", { cls: "ct-grow" }),
    others.length ? h("span", { cls: "ct-doc-where", attr: { "aria-label": others.map(whereText).join(" · ") } },
      others.map(w => { const e = icon(whereIcon(w)); e.setAttr("title", whereText(w)); return e; })) : null,
    paper ? h("span", { cls: "ct-paper-tag", attr: { title: t("w.paper") } }, icon("file-text"), h("span", { cls: "ct-paper-t" }, t("paper"))) : null,
    d.where !== "paper" ? icon("arrow-up-right", "ct-ico ct-ico-xs") : null,
  ], "ct-doc" + (paper ? " is-paper" : ""), () => ctx.openDoc(d));
}

export interface DocFormOpts {
  s: Settings;
  travelers: string[];
  draft: Doc;                       // lo guarda quien la abre (así no se pierde al repintar)
  title?: string;
  bag?: Doc[];                      // los documentos de la mochila, para traerlos con un clic
  small?: boolean;
  onSave(d: Doc): void;
  onCancel(): void;
}
/* la ventanita de un documento: nombre, de quién es, dónde está (uno o varios sitios) y su enlace */
export function docForm(o: DocFormOpts): HTMLElement {
  const d = o.draft;
  const sel: Where[] = docWheres(d);
  const box = h("form", { cls: "ct-form ct-form-small ct-docform" + (o.small ? " is-pop" : ""), attr: { autocomplete: "off" } });
  box.addEventListener("submit", ev => { ev.preventDefault(); save(); });
  const save = () => {
    if (!d.name.trim()) { box.querySelector<HTMLInputElement>("input")?.focus(); return; }
    const url = d.url.trim();
    const linked = sel.find(w => LINKED.includes(w));
    const primary = url && linked ? linked : sel[0] || "paper";
    o.onSave({ name: d.name.trim(), where: primary, url: LINKED.includes(primary) ? url : "", also: sel.filter(w => w !== primary), para: [...d.para] });
  };
  const draw = () => {
    box.empty();
    if (o.title) box.appendChild(h("span", { cls: "ct-form-title" }, o.title));
    const name = h("input", { cls: "ct-input", attr: { type: "text", value: d.name, placeholder: t("f.docName") } });
    name.addEventListener("input", () => { d.name = name.value; });
    box.appendChild(h("label", { cls: "ct-f" }, label(t("f.docName")), name));
    if (o.travelers.length) {
      box.appendChild(h("div", { cls: "ct-f" }, label(t("f.whose")), h("span", { cls: "ct-people" }, o.travelers.map((p, i) => miniPerson(p, i, d.para.includes(p), () => {
        d.para = d.para.includes(p) ? d.para.filter(x => x !== p) : o.travelers.filter(x => x === p || d.para.includes(x));
        draw();
      })))));
    }
    box.appendChild(h("div", { cls: "ct-f" }, label(t("f.whereMany")), h("span", { cls: "ct-seg" }, wheresOf(o.s).map(w => {
      const on = sel.includes(w);
      return button([icon(on ? "check" : whereIcon(w)), t("w." + w)], "ct-pill is-small" + (on ? " is-solid" : "") + (w === "paper" ? " is-paper" : ""), () => {
        if (on && sel.length > 1) sel.splice(sel.indexOf(w), 1); else if (!on) sel.push(w);
        d.where = sel[0]; d.also = sel.slice(1);
        draw();
      }, { "aria-pressed": String(on) });
    }))));
    const linked = sel.find(w => LINKED.includes(w));
    if (linked) {
      const url = h("input", { cls: "ct-input", attr: { type: "text", value: d.url, placeholder: linked === "vault" ? o.s.files.vaultFolder + "/…" : linked === "device" ? "file:///…" : "https://…" } });
      url.addEventListener("input", () => { d.url = url.value; });
      box.appendChild(h("label", { cls: "ct-f" }, label(linked === "vault" ? t("f.vaultPath") : t("f.link")), url));
    }
    const bag = (o.bag || []).filter(b => b.name);
    box.appendChild(h("div", { cls: "ct-form-foot" },
      bag.length ? h("details", { cls: "ct-bag-pick" }, h("summary", { cls: "ct-link-btn" }, icon("backpack"), t("f.fromBag")),
        h("div", { cls: "ct-bag-menu" }, bag.map(b => button([h("span", { cls: "ct-grow" }, b.name), b.para.length ? h("span", { cls: "ct-sub" }, b.para.join(", ")) : null], "ct-option", () => o.onSave({ ...b, also: [...b.also], para: [...b.para] }))))) : null,
      h("span", { cls: "ct-grow" }),
      button(t("f.cancel"), "ct-btn-ghost is-small", () => o.onCancel()),
      h("button", { cls: "ct-btn-primary is-small", attr: { type: "submit" } }, t("f.save"))));
  };
  draw();
  window.setTimeout(() => { const i = box.querySelector<HTMLInputElement>("input"); if (i && !i.value && box.isConnected) i.focus(); }, 30);
  return box;
}
