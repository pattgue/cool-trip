import { h } from "./dom";
import { t } from "./i18n";
import { button, icon } from "./ui";
import type { PlanCtx } from "./plan";

/* ---------- mover pasos: se arrastran por el asa (ratón o dedo) a otro sitio del mismo día o de otro ---------- */
export function grip(ctx: PlanCtx, di: number, index: number): HTMLElement {
  const g = button(icon("grip-vertical"), "ct-grip", undefined, { "aria-label": t("move"), title: t("move") });
  g.addEventListener("pointerdown", ev => startDrag(ctx, ev, di, index, g));
  return g;
}
function startDrag(ctx: PlanCtx, ev: PointerEvent, di: number, index: number, handle: HTMLElement) {
  const row = handle.closest<HTMLElement>(".ct-row");
  const root = handle.closest<HTMLElement>(".ct-days");
  const scroller = handle.closest<HTMLElement>(".ct-view") || document.scrollingElement as HTMLElement | null;
  if (!row || !root) return;
  ev.preventDefault();
  handle.setPointerCapture(ev.pointerId);
  const rect = row.getBoundingClientRect(), dy = ev.clientY - rect.top, base = root.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;              // una copia que sigue al dedo, dentro de la lista de días
  ghost.addClass("ct-drag-ghost");
  ghost.setCssProps({ "--ct-ghost-w": rect.width + "px", "--ct-ghost-x": rect.left - base.left + "px", "--ct-ghost-y": rect.top - base.top + "px" });
  root.appendChild(ghost);
  row.addClass("is-dragging");
  const line = h("div", { cls: "ct-drop-line" });
  let target: { day: number; index: number } | null = null, raf = 0, lastY = ev.clientY;
  const place = (x: number, y: number) => {
    ghost.setCssProps({ "--ct-ghost-y": y - dy - root.getBoundingClientRect().top + "px" });
    const under = root.ownerDocument.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop]");
    if (!under || under === row) return;
    const day = Number(under.dataset.day), idx = Number(under.dataset.index), r = under.getBoundingClientRect();
    const after = under.dataset.drop === "item" && y > r.top + r.height / 2;
    target = { day, index: idx + (after ? 1 : 0) };
    if (after) under.after(line); else under.before(line);
  };
  const scroll = () => {                                     // cerca del borde, la vista se desplaza sola
    if (!scroller) return;
    const b = scroller.getBoundingClientRect();
    const v = lastY < b.top + 60 ? -12 : lastY > b.bottom - 60 ? 12 : 0;
    if (v) scroller.scrollTop += v;
    raf = window.requestAnimationFrame(scroll);
  };
  raf = window.requestAnimationFrame(scroll);
  const move = (e: PointerEvent) => { lastY = e.clientY; place(e.clientX, e.clientY); };
  const end = () => {
    window.cancelAnimationFrame(raf);
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    ghost.remove(); line.remove(); row.removeClass("is-dragging");
    if (target && !(target.day === di && (target.index === index || target.index === index + 1))) ctx.move(di, index, target.day, target.index);
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
