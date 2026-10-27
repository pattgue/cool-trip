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
