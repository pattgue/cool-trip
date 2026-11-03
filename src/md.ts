/* La nota del viaje en Markdown: se lee a un Trip y se vuelve a escribir. El formato es el que se cerró con Patt
   (docs/propiedades.md). Lo que no se entiende se respeta: va a intro, outro, raw o extra y se vuelve a escribir. */
import { parseYaml, stringifyYaml } from "obsidian";
import { MD, vocab } from "./i18n";
import type { Vocab } from "./i18n";
import { addDays, dayLabel, dayLabelLower, diffDays, isIso, iso, isTime, normTime, range, readDay } from "./dates";
import type { Day, Dest, Doc, Field, Item, Kind, PropNames, Settings, Task, Trip, Where } from "./types";
import { isTransport } from "./types";
import { propKey, twinRecog } from "./settings";
import { PALETTE, paletteId } from "./ui";
import { priceRe, priceValue } from "./prices";
export * from "./prices";

export const MARKER = "%% cool-trip v1 %%";
/* las sugerencias de «Por hacer» que se han quitado: «%% cool-trip · ocultas: Mapas sin conexión de Roma | … %%» */
const HIDDEN_RE = /^%%\s*cool-trip\s*·\s*(?:ocultas|hidden):\s*(.*?)\s*%%$/i;
const BOTH = [MD.es, MD.en];
const low = (s: string) => s.toLowerCase().trim();

/* ---------- utilidades de texto ---------- */
/* parte por « · » sin romper [[…]], […](…) ni **…** */
export function splitSeg(s: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[" || c === "(") depth++;
    else if ((c === "]" || c === ")") && depth > 0) depth--;
    if (depth === 0 && s.startsWith(" · ", i)) { out.push(cur.trim()); cur = ""; i += 2; continue; }
    cur += c;
  }
  if (cur.trim() || !out.length) out.push(cur.trim());
  return out;
}
const linkRe = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/;
const boldRe = /^\*\*(.+)\*\*$/;
/* «por pagar» después del precio: cuesta, pero aún no se ha pagado */
const UNPAID_RE = /^(?:por pagar|sin pagar|unpaid|to pay)$/i;
export const linkTarget = (s: string) => { const m = linkRe.exec(s.trim()); return m ? m[1] : ""; };
export function splitNames(s: string): string[] {
  return s.split(/,\s*|\s+y\s+|\s+and\s+|\s*&\s*/).map(x => x.trim()).filter(Boolean);
}
export function joinNames(list: string[]): string { return list.join(", "); }

/* ---------- documentos ----------
   «Pasaporte (en papel · Wallet · para Ana)», «[Billete](https://…) (en papel)», «[[Viajes/Archivos/x.pdf|Billete]]».
   Lo de dentro del paréntesis son los otros sitios donde lo llevas y de quién es; si no se entiende, es parte del nombre. */
const WHERE_WORDS: Record<string, Where> = { wallet: "wallet", nube: "cloud", cloud: "cloud", dispositivo: "device", device: "device", "móvil": "device",
  movil: "device", phone: "device", vault: "vault" };
function whereWord(w: string): Where | null {
  const x = low(w);
  if (BOTH.some(v => v.paper === x)) return "paper";
  return WHERE_WORDS[x] ?? null;
}
const linkDoc = (name: string, url: string): Doc => /^wallet$/i.test(url)
  ? { name, where: "wallet", url: "", also: [], para: [] }
  : { name, where: /^file:/i.test(url) ? "device" : "cloud", url, also: [], para: [] };
function parseOneDoc(text: string): Doc | null {
  const s = text.trim();
  if (!s) return null;
  let base = s, meta = "";
  const full = /^\[([^\]]+)\]\(([^)]*)\)$/.exec(s);
  if (!full) {
    const m = /^(\[[^\]]+\]\([^)]*\)|\[\[[^\]]+\]\]|.*?)\s*\(([^()]*)\)$/.exec(s);
    if (m) { base = m[1].trim(); meta = m[2]; }
  }
  /* el paréntesis: sitios y «para …» */
  const wheres: Where[] = [], para: string[] = [];
  let known = !!meta;
  for (const part of meta ? meta.split(/\s+·\s+|,\s*(?=(?:en papel|on paper|wallet|nube|cloud|dispositivo|device|vault)\b)/i) : []) {
    const pm = /^(?:para|for)\s+(.+)$/i.exec(part.trim());
    const w = whereWord(part);
    if (pm) para.push(...splitNames(pm[1]));
    else if (w) { if (!wheres.includes(w)) wheres.push(w); }
    else known = false;
  }
  if (meta && !known) { base = s; wheres.length = 0; para.length = 0; }
  let doc: Doc;
  const v = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(base), l = /^\[([^\]]+)\]\(([^)]*)\)$/.exec(base);
  if (v) doc = { name: (v[2] || v[1].split("/").pop() || v[1]).trim(), where: "vault", url: v[1].trim(), also: [], para: [] };
  else if (l) doc = linkDoc(l[1].trim(), l[2].trim());
  else doc = { name: base.replace(/^[\s·]+/, "").trim(), where: wheres.shift() || "cloud", url: "", also: [], para: [] };
  doc.also = wheres.filter(w => w !== doc.where);
  doc.para = para;
  return doc.name ? doc : null;
}
/* una lista de documentos separados por « · » (los nombres pueden llevar « · » si terminan en su paréntesis o su enlace) */
export function parseDocs(value: string): Doc[] {
  const out: Doc[] = [];
  let cur: string[] = [];
  const close = () => { const d = parseOneDoc(cur.join(" · ")); if (d) out.push(d); cur = []; };
  for (const seg of splitSeg(value)) {
    cur.push(seg);
    if (/\)$|\]\]$/.test(seg.trim())) close();
  }
  if (cur.length) close();
  return out;
}
export function docMd(d: Doc, v: Vocab = vocab()): string {
  const word = (w: Where) => w === "paper" ? v.paper : w === "wallet" ? "Wallet" : w === "device" ? v.device : w === "vault" ? "vault" : v.cloud;
  let base: string;
  const meta: string[] = [];
  if (d.where === "vault" && d.url) base = `[[${d.url}|${d.name}]]`;
  else if ((d.where === "cloud" || d.where === "device") && d.url) base = `[${d.name}](${d.url})`;
  else { base = d.name; if (d.where !== "cloud" || d.also.length) meta.push(word(d.where)); }
  for (const w of d.also) if (w !== d.where) meta.push(word(w));
  if (d.para.length) meta.push(`${v.for} ${joinNames(d.para)}`);
  return meta.length ? `${base} (${meta.join(" · ")})` : base;
}
/* una línea de la mochila: «Pasaporte (en papel · para Ana)», «[Seguro](url)» o la forma antigua «Pasaporte · Ana · en papel» */
function parseBagLine(text: string): Doc {
  const segs = splitSeg(text);
  const last = segs.length > 1 ? whereWord(segs[segs.length - 1]) : null;
  if (last === "paper" || last === "wallet") return { name: segs.slice(0, -1).join(" · "), where: last, url: "", also: [], para: [] };
  return parseOneDoc(text) || { name: text.trim(), where: "cloud", url: "", also: [], para: [] };
}

/* ---------- campos «Clave: valor» ---------- */
const KEY_CANON: Record<string, string> = {};
for (const v of BOTH) {
  for (const [k, label] of Object.entries(v.keys)) KEY_CANON[low(label)] = k;
  for (const label of Object.values(v.kinds)) KEY_CANON[low(label)] ??= "code";     // «Coche» es antes el vagón que el número
}
Object.assign(KEY_CANON, { "necesitas": "docs", "archivo": "docs", "archivos": "docs", "file": "docs", "files": "docs", "you need": "docs",
  "llegada": "arrive", "salida": "depart", "entrada": "checkin", "habitacion": "room", "bano": "bath", "nº": "code", "número": "code" });
const keyOf = (seg: string): [string, string] | null => {
  const m = /^([^:]{1,30}):\s*(.*)$/.exec(seg);
  return m ? [m[1].trim(), m[2]] : null;
};
function parseFieldLine(text: string, line: number, item: Item) {
  /* primero las parejas (un trozo sin «Clave:» va con la anterior), luego los documentos aparte */
  const pairs: { k: string; v: string }[] = [];
  splitSeg(text).forEach((seg, i) => {
    const kv = keyOf(seg);
    const canon = kv ? KEY_CANON[low(kv[0])] : undefined;
    if (kv && (i === 0 || canon)) pairs.push({ k: canon || kv[0], v: kv[1] });
    else if (pairs.length) pairs[pairs.length - 1].v += " · " + seg;
    else pairs.push({ k: "", v: seg });
  });
  for (const p of pairs) {
    if (p.k === "docs") item.docs.push(...parseDocs(p.v));
    else item.fields.push({ k: p.k, v: p.v, line });
  }
}
export const field = (it: Item, k: string) => it.fields.find(f => f.k === k)?.v ?? "";
export function setField(it: Item, k: string, v: string, line: number) {
  const f = it.fields.find(x => x.k === k);
  if (!v.trim()) { if (f) it.fields.splice(it.fields.indexOf(f), 1); return; }
  if (f) f.v = v.trim(); else it.fields.push({ k, v: v.trim(), line });
}
/* «sáb 3 abr · 11:50 · T4S» → fecha, hora y sitio */
export function splitWhen(v: string, near: string): { date: string; time: string; at: string } {
  const segs = splitSeg(v);
  let date = "", time = "";
  const rest: string[] = [];
  for (const s of segs) {
    if (!time && isTime(s)) time = normTime(s);
    else if (!date && readDay(s, near)) date = readDay(s, near);
    else rest.push(s);
  }
  return { date, time, at: rest.join(" · ") };
}
export function joinWhen(date: string, time: string, at: string): string {
  return [date ? dayLabelLower(date) : "", time, at.trim()].filter(Boolean).join(" · ");
}

/* ---------- un paso del plan ---------- */
export const newItem = (kind: Kind, over: Partial<Item> = {}): Item => ({
  kind, check: !isTransport(kind) && kind !== "lodging", done: false, time: "", title: "", link: "", place: "", price: "", unpaid: false, para: [],
  fields: [], docs: [], extra: [], ...over,
});
function mealWord(s: string): string | null {
  for (const v of BOTH) for (const m of Object.values(v.meals)) if (low(s) === low(m)) return m;
  return null;
}
function transportOf(title: string): Kind | null {
  const w = low(title.split(/\s+/)[0] || "");
  for (const v of BOTH) for (const [k, label] of Object.entries(v.kinds)) if (w === low(label)) return k as Kind;
  if (w === "ferry") return "boat";
  return null;
}
const isRestTitle = (s: string) => /^(vuelta|volver|descanso|descansar|dormir|llegada|back|rest|return to|sleep|arrival)\b/i.test(s.trim());

export function parseItem(line: string): Item {
  let rest = line.replace(/^-\s+/, "");
  const it = newItem("note", { check: false });
  const cb = /^\[([ xX])\]\s+/.exec(rest);
  if (cb) { it.check = true; it.done = cb[1] !== " "; rest = rest.slice(cb[0].length); }
  const tm = /^(\d{1,2}[:.]\d{2})\s+/.exec(rest);
  if (tm) { it.time = normTime(tm[1]); rest = rest.slice(tm[0].length); }
  const segs = splitSeg(rest);
  const first = segs.shift() || "";
  const bold = boldRe.exec(first);
  if (bold) {
    const inner = bold[1].trim(), target = linkTarget(inner);
    const kw = segs.findIndex(s => BOTH.some(v => low(s) === v.lodging || low(s) === v.ticket));
    if (kw >= 0 || target) {
      it.kind = kw >= 0 && BOTH.some(v => low(segs[kw]) === v.lodging) ? "lodging" : "ticket";
      if (kw >= 0) segs.splice(kw, 1);
      it.link = target; it.title = target || inner;              // un alojamiento sin nota: «**Casa de Ana** · alojamiento»
    } else {
      it.title = inner;
      it.kind = transportOf(inner) || "car";
    }
  } else if (linkTarget(first)) {
    it.kind = "place"; it.link = linkTarget(first); it.title = it.link;
  } else if (mealWord(first)) {
    it.kind = "meal"; it.title = mealWord(first)!;
    if (segs.length && linkTarget(segs[0])) it.link = linkTarget(segs.shift()!);
    else if (segs.length && !priceRe.test(segs[0]) && !/^(para|for)\s/i.test(segs[0])) it.place = segs.shift()!;
  } else if (isRestTitle(first)) {
    it.kind = "rest"; it.title = first;
    if (segs.length && linkTarget(segs[0])) it.link = linkTarget(segs.shift()!);
    else if (segs.length && !priceRe.test(segs[0]) && !/^(para|for)\s/i.test(segs[0])) it.place = segs.shift()!;    // un alojamiento sin nota
  } else {
    it.kind = "note"; it.title = first;
  }
  for (const s of segs) {
    const para = /^(?:para|for)\s+(.+)$/i.exec(s);
    if (para) it.para = splitNames(para[1]);
    else if (priceRe.test(s)) it.price = s;
    else if (UNPAID_RE.test(s)) it.unpaid = true;
    else it.extra.push(s);
  }
  return it;
}

/* las líneas de los campos de cada tipo, en el orden en que se escriben */
const FIELD_LINES: Partial<Record<Kind, string[][]>> = {
  flight: [["depart"], ["arrive"], ["mode", "company", "code", "car", "cabin", "luggage"], ["seats", "driver"], ["booking"], ["note"]],
  lodging: [["type"], ["checkin"], ["checkout"], ["room", "beds", "bath"], ["includes"], ["booking", "keys", "pitch"], ["address"], ["note"]],
  ticket: [["tickets"], ["note"]],
};
for (const k of ["train", "bus", "car", "boat"] as Kind[]) FIELD_LINES[k] = FIELD_LINES.flight;
export function lineFor(kind: Kind, key: string): number {
  const groups = FIELD_LINES[kind];
  const i = groups ? groups.findIndex(g => g.includes(key)) : -1;
  return i >= 0 ? i : 9;
}

function keyLabel(k: string, it: Item, v: Vocab): string {
  if (k === "code" && isTransport(it.kind)) return v.kinds[it.kind];
  return (v.keys as Record<string, string>)[k] || k;
}
export function itemMd(it: Item, v: Vocab = vocab()): string[] {
  /* el alojamiento no lleva hora: la suya es la del check-in (y la de llegar, un paso aparte) */
  const time = it.kind === "lodging" ? "" : it.time;
  let head = "- " + (it.check ? `[${it.done ? "x" : " "}] ` : "") + (time ? time + " " : "");
  const L = it.link ? `[[${it.link}]]` : "";
  switch (it.kind) {
    case "place": head += L || it.title; break;
    case "meal": head += it.title + (L ? ` · ${L}` : it.place ? ` · ${it.place}` : ""); break;
    case "rest": head += it.title + (L ? ` · ${L}` : it.place ? ` · ${it.place}` : ""); break;
    case "lodging": head += `**${L || it.title}** · ${v.lodging}`; break;
    case "ticket": head += `**${L || it.title}** · ${v.ticket}`; break;
    case "note": head += it.title; break;
    default: head += `**${it.title}**`;
  }
  for (const e of it.extra) head += ` · ${e}`;
  if (it.price) head += ` · ${it.price}` + (it.unpaid ? ` · ${v.unpaid}` : "");
  if (it.para.length) head += ` · ${v.for} ${joinNames(it.para)}`;
  const out = [head];
  const lines = new Map<number, Field[]>();
  for (const f of it.fields) { if (!lines.has(f.line)) lines.set(f.line, []); lines.get(f.line)!.push(f); }
  for (const n of [...lines.keys()].sort((a, b) => a - b)) {
    out.push("    - " + lines.get(n)!.map(f => f.k ? `${keyLabel(f.k, it, v)}: ${f.v}` : f.v).join(" · "));
  }
  if (it.docs.length) out.push(`    - ${v.keys.docs}: ` + it.docs.map(d => docMd(d, v)).join(" · "));
  return out;
}

/* ---------- la nota entera ---------- */
const fmRe = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
export function toIso(x: unknown): string {
  if (x instanceof Date) return iso(x);
  if (typeof x === "string" && isIso(x.trim().slice(0, 10))) return x.trim().slice(0, 10);
  return "";
}
export function toList(x: unknown): string[] {
  if (Array.isArray(x)) return x.map(v => String(v ?? "").replace(/^\[\[|\]\]$/g, "").trim()).filter(Boolean);
  if (typeof x === "string" && x.trim()) return x.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
const SECTION = (title: string): "bag" | "pack" | "todo" | "plan" | null => {
  const t = low(title);
  for (const v of BOTH) {
    if (t === low(v.bag)) return "bag";
    if (t === low(v.pack)) return "pack";
    if (t === low(v.todo)) return "todo";
    if (t === low(v.plan)) return "plan";
  }
  return null;
};

export function nightsTotal(t: Trip): number { return isIso(t.start) && isIso(t.end) ? Math.max(0, diffDays(t.start, t.end)) : 0; }
/* reparte las noches para que sumen las del viaje (el sobrante o la falta, al último destino que pueda) */
export function balanceNights(t: Trip) {
  const total = nightsTotal(t);
  if (!t.dests.length) return;
  let sum = t.dests.reduce((a, d) => a + Math.max(0, d.nights | 0), 0);
  if (sum === 0) {
    const base = Math.floor(total / t.dests.length);
    t.dests.forEach((d, i) => { d.nights = base + (i < total % t.dests.length ? 1 : 0); });
    return;
  }
  t.dests.forEach(d => { d.nights = Math.max(0, d.nights | 0); });
  for (let i = t.dests.length - 1; sum !== total && i >= 0; i--) {
    const d = t.dests[i];
    const change = Math.max(-d.nights, total - sum);
    d.nights += change; sum += change;
  }
}
/* en qué destino se duerme cada noche: el día i es de dests[k]; el día de cambio, de los dos */
export function citiesOfDay(t: Trip, date: string): Dest[] {
  if (!isIso(t.start) || !t.dests.length) return [];
  const i = diffDays(t.start, date);
  let acc = 0;
  for (let k = 0; k < t.dests.length; k++) {
    const d = t.dests[k];
    if (i < acc + d.nights || k === t.dests.length - 1) {
      const prev = i === acc && k > 0 ? t.dests[k - 1] : null;
      return prev ? [prev, d] : [d];
    }
    acc += d.nights;
  }
  return [t.dests[t.dests.length - 1]];
}
export const tripDates = (t: Trip) => range(t.start, t.end);

/* los nombres de las propiedades del viaje tal y como los usa esta nota */
const props = (s: Settings, fm: Record<string, unknown>) =>
  Object.fromEntries((["start", "end", "destinations", "travelers", "cover"] as const).map(k => [k, propKey(s, k, fm)])) as Pick<PropNames, "start" | "end" | "destinations" | "travelers" | "cover">;
/* las versiones 0.2.x guardaban el presupuesto en una propiedad (la de sus ajustes): se lee y pasa al bloque del viaje */
const oldBudget = (s: Settings) => (s.props as unknown as Record<string, string | undefined>).budget || "";

export function parseTrip(text: string, name: string, s: Settings): Trip {
  const t: Trip = { fm: {}, name, start: "", end: "", dests: [], travelers: [], cover: "", budget: 0, accent: "", mochila: [], packing: [], tasks: [], hidden: [], days: [], intro: [], outro: [] };
  let body = text;
  const m = fmRe.exec(text);
  if (m) {
    try { t.fm = (parseYaml(m[1]) as Record<string, unknown>) || {}; } catch { t.fm = {}; }
    t.fmRaw = { text: m[1], snap: JSON.stringify(t.fm) };
    body = text.slice(m[0].length);
  }
  const P = props(s, t.fm);
  t.start = toIso(t.fm[P.start]);
  t.end = toIso(t.fm[P.end]) || t.start;
  t.travelers = toList(t.fm[P.travelers]);
  t.cover = typeof t.fm[P.cover] === "string" ? String(t.fm[P.cover]) : "";
  const bk = oldBudget(s), bv = bk ? t.fm[bk] : null;
  t.budget = typeof bv === "number" ? bv : typeof bv === "string" ? priceValue(bv) : 0;
  const fmDests = toList(t.fm[P.destinations]);
  if (t.cover && paletteId(t.cover)) t.cover = paletteId(t.cover) || "";      // un color en la propiedad (versiones 0.2.x)

  const lines = body.split(/\r?\n/);
  const calloutDests: Dest[] = [];
  let section: "intro" | "bag" | "pack" | "todo" | "plan" | "outro" = "intro";
  let day: Day | null = null, item: Item | null = null;
  const parsedDays: Day[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === MARKER) continue;
    const hid = HIDDEN_RE.exec(line.trim());
    if (hid) { t.hidden.push(...hid[1].split(" | ").map(x => x.trim()).filter(Boolean)); continue; }
    const callout = /^>\s*\[!cool-trip(?:\|([^\]]*))?\]/i.exec(line);
    if (callout) {
      t.accent = (callout[1] || "").trim();
      while (i + 1 < lines.length && /^>/.test(lines[i + 1])) {
        const raw = lines[++i].replace(/^>\s?/, "");
        const bud = new RegExp(`^(?:${BOTH.map(v => v.budget).join("|")})\\s*:\\s*(.+)$`, "i").exec(raw.trim());
        if (bud) { t.budget = priceValue(bud[1]); continue; }
        const segs = splitSeg(raw);
        const ni = segs.findIndex(x => /^\d+\s+\S+$/.test(x) && BOTH.some(v => [v.nights, v.night].includes(low(x.split(/\s+/)[1]))));
        if (!segs[0]) continue;
        calloutDests.push({
          city: segs[0], country: ni > 1 ? segs.slice(1, ni).join(" · ") : "",
          nights: ni >= 0 ? parseInt(segs[ni], 10) : 0,
          travelers: ni >= 0 && segs[ni + 1] ? splitNames(segs.slice(ni + 1).join(" · ")) : [],
        });
      }
      continue;
    }
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2 && !/^###/.test(line)) {
      const sec = SECTION(h2[1]);
      if (sec) { section = sec; day = null; item = null; continue; }
      section = "outro";
    }
    if (section === "intro") { if (line.trim() || t.intro.length) t.intro.push(line); continue; }
    if (section === "outro") { t.outro.push(line); continue; }
    if (section === "bag") {
      const b = /^\s*-\s+(.+)$/.exec(line);
      if (b && !/^\s{2,}/.test(line)) t.mochila.push(parseBagLine(b[1]));
      continue;
    }
    if (section === "pack") {
      const b = /^\s*-\s+\[([ xX])\]\s+(.+)$/.exec(line) || /^\s*-\s+()(.+)$/.exec(line);
      if (b) t.packing.push({ text: b[2].trim(), done: !!b[1] && b[1] !== " " });
      continue;
    }
    if (section === "todo") {
      const b = /^\s*-\s+\[([ xX])\]\s+(.+)$/.exec(line) || /^\s*-\s+()(.+)$/.exec(line);
      /* la fecha límite, como la escribe el plugin Tasks: «📅 2026-11-02» */
      const due = b ? /\s*📅\s*(\d{4}-\d{2}-\d{2})\s*$/.exec(b[2]) : null;
      if (b) t.tasks.push({ text: (due ? b[2].slice(0, due.index) : b[2]).trim(), done: !!b[1] && b[1] !== " ", ...(due ? { due: due[1] } : {}) });
      continue;
    }
    /* plan */
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      const date = readDay(h3[1], t.start);
      day = { date, items: [], raw: date ? [] : [line] };
      parsedDays.push(day); item = null;
      continue;
    }
    if (!day) { if (line.trim()) { day = { date: "", items: [], raw: [] }; parsedDays.push(day); } else continue; }
    if (/^-\s+/.test(line)) { item = parseItem(line); day.items.push(item); continue; }
    const sub = /^\s{2,}[-*]\s+(.+)$/.exec(line);
    if (sub && item) { parseFieldLine(sub[1], item.fields.length ? Math.max(...item.fields.map(f => f.line)) + 1 : 0, item); continue; }
    if (line.trim()) { day.raw.push(line); item = null; }
  }
  while (t.outro.length && !t.outro[t.outro.length - 1].trim()) t.outro.pop();
  while (t.intro.length && !t.intro[t.intro.length - 1].trim()) t.intro.pop();

  /* destinos: los de la propiedad, con las noches y los viajeros del resumen */
  const cities = fmDests.length ? fmDests : calloutDests.map(d => d.city);
  t.dests = cities.map(city => {
    const c = calloutDests.find(d => low(d.city) === low(city));
    return { city, country: c?.country || "", nights: c?.nights || 0, travelers: c ? c.travelers : [...t.travelers] };
  });
  balanceNights(t);

  /* días: uno por fecha del viaje; lo que no encaja se queda al final */
  const byDate = new Map<string, Day>();
  const leftovers: Day[] = [];
  for (const d of parsedDays) {
    if (d.date && !byDate.has(d.date)) byDate.set(d.date, d);
    else if (d.date && byDate.has(d.date)) { const o = byDate.get(d.date)!; o.items.push(...d.items); o.raw.push(...d.raw); }
    else leftovers.push(d);
  }
  const dates = tripDates(t);
  t.days = dates.map(date => byDate.get(date) || { date, items: [], raw: [] });
  for (const [date, d] of byDate) if (!dates.includes(date) && (d.items.length || d.raw.length)) leftovers.push(d);
  t.days.push(...leftovers.filter(d => d.items.length || d.raw.length));
  /* «DNI · patt» (formato antiguo): el viajero del final pasa a «para» */
  const who = new Map(t.travelers.map(p => [low(p), p]));
  for (const d of [...t.mochila, ...t.days.flatMap(x => x.items.flatMap(it => it.docs))]) {
    const m = /^(.+?)\s+·\s+(.+)$/.exec(d.name);
    const names = m ? m[2].split(/\s*,\s*|\s+(?:y|and)\s+/) : [];
    if (m && !d.para.length && names.every(n => who.has(low(n)))) { d.name = m[1]; d.para = names.map(n => who.get(low(n))!); }
  }
  /* sin portada de imagen, el color del viaje es el de su bloque */
  if (!t.cover && PALETTE.some(p => p.id === t.accent)) t.cover = t.accent;
  return t;
}

export function dayHeading(t: Trip, date: string): string {
  const cs = citiesOfDay(t, date).map(d => d.city);
  return `### ${dayLabel(date)}` + (cs.length ? ` · ${cs.join(" → ")}` : "");
}

export function serializeTrip(t: Trip, s: Settings): string {
  const v = vocab();
  const fm = t.fm, P = props(s, fm), twin = twinRecog(s.trips, "trip");
  if (s.trips.mode === "property" && s.trips.key && fm[s.trips.key] == null && !(twin && fm[twin.key] != null)) fm[s.trips.key] = s.trips.value;
  if (s.trips.mode === "tag" && s.trips.value) {
    const tags = toList(fm.tags);
    if (!tags.some(x => low(x.replace(/^#/, "")) === low(s.trips.value.replace(/^#/, "")))) fm.tags = [...tags, s.trips.value.replace(/^#/, "")];
  }
  /* solo se escribe lo que tiene valor: ni propiedades vacías ni propiedades que no hayas rellenado */
  const put = (k: string, on: boolean, val: unknown) => { if (!k) return; if (on) fm[k] = val; else if (k in fm && fm[k] != null && fm[k] !== "" && !(Array.isArray(fm[k]) && !(fm[k] as unknown[]).length)) delete fm[k]; };
  /* y solo si ha cambiado, con la forma que ya tenía: una fecha con hora, una lista como texto o con [[enlaces]] se quedan como están */
  const date = (k: string, v: string) => { if (k && v && toIso(fm[k]) !== v) fm[k] = v; };
  const list = (k: string, v: string[]) => {
    if (!k || toList(fm[k]).join("\u0000") === v.join("\u0000")) return;
    put(k, v.length > 0, typeof fm[k] === "string" ? v.join(", ") : v);
  };
  date(P.start, t.start);
  date(P.end, t.end);
  list(P.destinations, t.dests.map(d => d.city));
  list(P.travelers, [...t.travelers]);
  /* la portada solo es propiedad si es una imagen; el color va en el bloque del viaje */
  const pal = paletteId(t.cover);
  if (P.cover) { if (t.cover && !pal) fm[P.cover] = t.cover; else if (typeof fm[P.cover] === "string" && paletteId(String(fm[P.cover]))) delete fm[P.cover]; }
  const bk = oldBudget(s);
  if (bk && bk in fm && bk !== P.cover) delete fm[bk];       // el presupuesto va en el bloque del viaje
  const accent = pal && t.cover ? pal : t.accent;
  /* si las propiedades no han cambiado, se escriben tal cual estaban (con su formato, sus comillas y sus comentarios) */
  const yaml = t.fmRaw && t.fmRaw.snap === JSON.stringify(fm) ? t.fmRaw.text.trimEnd() : Object.keys(fm).length ? stringifyYaml(fm).trimEnd() : "";
  const out: string[] = yaml ? ["---", yaml, "---"] : [];
  out.push(`> [!cool-trip${accent ? "|" + accent : ""}] ${t.name}`);
  for (const d of t.dests) {
    out.push("> " + [d.city, d.country, `${d.nights} ${d.nights === 1 ? v.night : v.nights}`, joinNames(d.travelers)].filter(Boolean).join(" · "));
  }
  if (t.budget > 0) out.push(`> ${v.budget}: ${t.budget}`);
  out.push("");
  if (t.intro.length) out.push(...t.intro, "");
  out.push(`## ${v.bag}`, ...t.mochila.map(d => "- " + docMd(d, v)), "");
  if (t.packing.length) out.push(`## ${v.pack}`, ...t.packing.map(x => `- [${x.done ? "x" : " "}] ${x.text}`), "");
  out.push(`## ${v.todo}`, ...t.tasks.map((x: Task) => `- [${x.done ? "x" : " "}] ${x.text}${x.due ? ` 📅 ${x.due}` : ""}`), "");
  out.push(`## ${v.plan}`, "");
  for (const d of t.days) {
    if (d.date) out.push(dayHeading(t, d.date));
    else if (!d.raw.length || !/^###/.test(d.raw[0])) out.push("### ?");
    for (const it of d.items) out.push(...itemMd(it, v));
    out.push(...d.raw, "");
  }
  if (t.outro.length) out.push(...t.outro, "");
  if (t.hidden.length) out.push(`%% cool-trip · ${v.hidden}: ${t.hidden.join(" | ")} %%`);
  out.push(MARKER, "");
  return out.join("\n");
}

/* un viaje nuevo (Nuevo viaje) */
export function blankTrip(name: string, start: string, end: string, dests: Dest[], travelers: string[], cover: string, accent = ""): Trip {
  const t: Trip = { fm: {}, name, start, end, dests, travelers, cover, budget: 0, accent, mochila: [], packing: [], tasks: [], hidden: [], days: [], intro: [], outro: [] };
  balanceNights(t);
  t.days = tripDates(t).map(date => ({ date, items: [], raw: [] }));
  return t;
}
/* las fechas cambian: los días se recolocan (lo que cae fuera se conserva al final) */
export function redate(t: Trip, start: string, end: string) {
  const keep = new Map(t.days.filter(d => d.date).map(d => [d.date, d] as const));
  const others = t.days.filter(d => !d.date);
  t.start = start; t.end = end < start ? start : end;
  balanceNights(t);
  const dates = tripDates(t);
  t.days = dates.map(date => keep.get(date) || { date, items: [], raw: [] });
  for (const [date, d] of keep) if (!dates.includes(date) && (d.items.length || d.raw.length)) t.days.push(d);
  t.days.push(...others);
}
export { addDays };
