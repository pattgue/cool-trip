/* La nota del viaje en Markdown: se lee a un Trip y se vuelve a escribir. El formato es el que se cerró con Patt
   (replica/architecture.md › «Markdown»). Lo que no se entiende se respeta: va a intro, outro, raw o extra y se vuelve a escribir. */
import { parseYaml, stringifyYaml } from "obsidian";
import { MD, vocab } from "./i18n";
import type { Vocab } from "./i18n";
import { addDays, dayLabel, diffDays, isIso, iso, isTime, normTime, range, readDay } from "./dates";
import type { Day, Dest, Doc, Field, Item, Kind, Settings, Task, Trip } from "./types";
import { isTransport } from "./types";

export const MARKER = "%% cool-trip v1 %%";
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
const priceRe = /^(?:[€$£¥]\s?\d[\d.,]*|\d[\d.,]*\s?(?:€|\$|£|¥|EUR|USD|GBP|JPY))$/i;
export const linkTarget = (s: string) => { const m = linkRe.exec(s.trim()); return m ? m[1] : ""; };
export function splitNames(s: string): string[] {
  return s.split(/,\s*|\s+y\s+|\s+and\s+|\s*&\s*/).map(x => x.trim()).filter(Boolean);
}
export function joinNames(list: string[]): string { return list.join(", "); }

/* el número de un precio («1.435,50 €» → 1435.5) y su moneda */
export function priceValue(p: string): number {
  const s = p.replace(/[^\d.,]/g, "");
  if (!s) return 0;
  let n = s;
  if (/,\d{1,2}$/.test(n)) n = n.replace(/\./g, "").replace(",", ".");          // 1.435,50
  else if (/\.\d{1,2}$/.test(n) && /,/.test(n)) n = n.replace(/,/g, "");         // 1,435.50
  else n = n.replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".");                  // 1.435 / 1,435
  const v = parseFloat(n);
  return isFinite(v) ? v : 0;
}
export const currencyOf = (p: string) => (/[€$£¥]/.exec(p) || /\b(EUR|USD|GBP|JPY)\b/i.exec(p) || ["€"])[0];
export function fmtMoney(n: number, cur = "€"): string {
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return cur === "€" ? `${s} €` : `${cur}${s}`;
}

/* ---------- documentos ---------- */
const docTok = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\(([^)]*)\)|([^()[\]]+?)\s*\(([^()]+)\)/g;
function whereOfUrl(url: string): Doc["where"] {
  if (/^file:/i.test(url)) return "device";
  if (/^https?:/i.test(url)) return "cloud";
  return "cloud";
}
export function parseDocs(value: string): Doc[] {
  const out: Doc[] = [];
  const isPaper = (w: string) => BOTH.some(v => low(w) === v.paper);
  for (const m of value.matchAll(docTok)) {
    if (m[1]) out.push({ name: (m[2] || m[1].split("/").pop() || m[1]).trim(), where: "vault", url: m[1].trim() });
    else if (m[3]) {
      const url = m[4].trim();
      if (/^wallet$/i.test(url)) out.push({ name: m[3].trim(), where: "wallet", url: "" });
      else out.push({ name: m[3].trim(), where: whereOfUrl(url), url });
    } else if (m[5]) {
      const name = m[5].replace(/^[\s·]+/, "").trim(), w = m[6].trim();
      if (isPaper(w)) out.push({ name, where: "paper", url: "" });
      else if (/wallet/i.test(w)) out.push({ name, where: "wallet", url: "" });
      else out.push({ name, where: "cloud", url: "" });
    }
  }
  return out;
}
export function docMd(d: Doc, v: Vocab = vocab()): string {
  switch (d.where) {
    case "paper": return `${d.name} (${v.paper})`;
    case "wallet": return `${d.name} (Wallet)`;
    case "vault": return d.url ? `[[${d.url}|${d.name}]]` : d.name;
    default: return d.url ? `[${d.name}](${d.url})` : d.name;
  }
}
/* una línea de la mochila: «Pasaporte · Ana (en papel)», «[Seguro](url)» o la forma antigua «Pasaporte · Ana · en papel» */
function parseBagLine(text: string): Doc {
  const docs = parseDocs(text);
  if (docs.length === 1 && text.trim().endsWith(")") || docs.length === 1 && /^\[/.test(text.trim())) return docs[0];
  const segs = splitSeg(text);
  const last = low(segs[segs.length - 1] || "");
  if (segs.length > 1 && BOTH.some(v => v.paper === last)) return { name: segs.slice(0, -1).join(" · "), where: "paper", url: "" };
  if (segs.length > 1 && last === "wallet") return { name: segs.slice(0, -1).join(" · "), where: "wallet", url: "" };
  return docs[0] || { name: text.trim(), where: "cloud", url: "" };
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
  return [date ? dayLabel(date).toLowerCase() : "", time, at.trim()].filter(Boolean).join(" · ");
}

/* ---------- un paso del plan ---------- */
export const newItem = (kind: Kind, over: Partial<Item> = {}): Item => ({
  kind, check: !isTransport(kind) && kind !== "lodging", done: false, time: "", title: "", link: "", place: "", price: "", para: [],
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
const isRestTitle = (s: string) => /^(vuelta|volver|descanso|descansar|dormir|back|rest|return to|sleep)\b/i.test(s.trim());

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
    if (target) {
      it.link = target; it.title = target;
      const kw = segs.findIndex(s => BOTH.some(v => low(s) === v.lodging || low(s) === v.ticket));
      it.kind = kw >= 0 && BOTH.some(v => low(segs[kw]) === v.lodging) ? "lodging" : "ticket";
      if (kw >= 0) segs.splice(kw, 1);
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
  } else {
    it.kind = "note"; it.title = first;
  }
  for (const s of segs) {
    const para = /^(?:para|for)\s+(.+)$/i.exec(s);
    if (para) it.para = splitNames(para[1]);
    else if (priceRe.test(s)) it.price = s;
    else it.extra.push(s);
  }
  return it;
}

/* las líneas de los campos de cada tipo, en el orden en que se escriben */
const FIELD_LINES: Partial<Record<Kind, string[][]>> = {
  flight: [["depart"], ["arrive"], ["code", "car", "luggage"], ["seats"], ["note"]],
  lodging: [["checkin"], ["checkout"], ["room", "beds", "bath"], ["includes"], ["note"]],
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
  let head = "- " + (it.check ? `[${it.done ? "x" : " "}] ` : "") + (it.time ? it.time + " " : "");
  const L = it.link ? `[[${it.link}]]` : "";
  switch (it.kind) {
    case "place": head += L || it.title; break;
    case "meal": head += it.title + (L ? ` · ${L}` : it.place ? ` · ${it.place}` : ""); break;
    case "rest": head += it.title + (L ? ` · ${L}` : ""); break;
    case "lodging": head += `**${L || it.title}** · ${v.lodging}`; break;
    case "ticket": head += `**${L || it.title}** · ${v.ticket}`; break;
    case "note": head += it.title; break;
    default: head += `**${it.title}**`;
  }
  for (const e of it.extra) head += ` · ${e}`;
  if (it.price) head += ` · ${it.price}`;
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
function toIso(x: unknown): string {
  if (x instanceof Date) return iso(x);
  if (typeof x === "string" && isIso(x.trim().slice(0, 10))) return x.trim().slice(0, 10);
  return "";
}
export function toList(x: unknown): string[] {
  if (Array.isArray(x)) return x.map(v => String(v ?? "").replace(/^\[\[|\]\]$/g, "").trim()).filter(Boolean);
  if (typeof x === "string" && x.trim()) return x.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}
const SECTION = (title: string): "bag" | "todo" | "plan" | null => {
  const t = low(title);
  for (const v of BOTH) {
    if (t === low(v.bag)) return "bag";
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

export function parseTrip(text: string, name: string, s: Settings): Trip {
  const P = s.props;
  const t: Trip = { fm: {}, name, start: "", end: "", dests: [], travelers: [], cover: "", mochila: [], tasks: [], days: [], intro: [], outro: [] };
  let body = text;
  const m = fmRe.exec(text);
  if (m) {
    try { t.fm = (parseYaml(m[1]) as Record<string, unknown>) || {}; } catch { t.fm = {}; }
    body = text.slice(m[0].length);
  }
  t.start = toIso(t.fm[P.start]);
  t.end = toIso(t.fm[P.end]) || t.start;
  t.travelers = toList(t.fm[P.travelers]);
  t.cover = typeof t.fm[P.cover] === "string" ? String(t.fm[P.cover]) : "";
  const fmDests = toList(t.fm[P.destinations]);

  const lines = body.split(/\r?\n/);
  const calloutDests: Dest[] = [];
  let section: "intro" | "bag" | "todo" | "plan" | "outro" = "intro";
  let day: Day | null = null, item: Item | null = null;
  const parsedDays: Day[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === MARKER) continue;
    if (/^>\s*\[!cool-trip\]/i.test(line)) {
      while (i + 1 < lines.length && /^>/.test(lines[i + 1])) {
        const segs = splitSeg(lines[++i].replace(/^>\s?/, ""));
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
    if (section === "todo") {
      const b = /^\s*-\s+\[([ xX])\]\s+(.+)$/.exec(line) || /^\s*-\s+()(.+)$/.exec(line);
      if (b) t.tasks.push({ text: b[2].trim(), done: !!b[1] && b[1] !== " " });
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
  return t;
}

export function dayHeading(t: Trip, date: string): string {
  const cs = citiesOfDay(t, date).map(d => d.city);
  return `### ${dayLabel(date)}` + (cs.length ? ` · ${cs.join(" → ")}` : "");
}

export function serializeTrip(t: Trip, s: Settings): string {
  const P = s.props, v = vocab();
  const fm = t.fm;
  if (s.trips.mode === "property" && s.trips.key && fm[s.trips.key] == null) fm[s.trips.key] = s.trips.value;
  if (s.trips.mode === "tag" && s.trips.value) {
    const tags = toList(fm.tags);
    if (!tags.some(x => low(x.replace(/^#/, "")) === low(s.trips.value.replace(/^#/, "")))) fm.tags = [...tags, s.trips.value.replace(/^#/, "")];
  }
  if (t.start) fm[P.start] = t.start;
  if (t.end) fm[P.end] = t.end;
  fm[P.destinations] = t.dests.map(d => d.city);
  if (P.travelers) fm[P.travelers] = [...t.travelers];
  if (P.cover) { if (t.cover) fm[P.cover] = t.cover; else delete fm[P.cover]; }
  const out: string[] = ["---", stringifyYaml(fm).trimEnd(), "---"];
  out.push(`> [!cool-trip] ${t.name}`);
  for (const d of t.dests) {
    out.push("> " + [d.city, d.country, `${d.nights} ${d.nights === 1 ? v.night : v.nights}`, joinNames(d.travelers)].filter(Boolean).join(" · "));
  }
  out.push("");
  if (t.intro.length) out.push(...t.intro, "");
  out.push(`## ${v.bag}`, ...t.mochila.map(d => "- " + docMd(d, v)), "");
  out.push(`## ${v.todo}`, ...t.tasks.map((x: Task) => `- [${x.done ? "x" : " "}] ${x.text}`), "");
  out.push(`## ${v.plan}`, "");
  for (const d of t.days) {
    if (d.date) out.push(dayHeading(t, d.date));
    else if (!d.raw.length || !/^###/.test(d.raw[0])) out.push("### ?");
    for (const it of d.items) out.push(...itemMd(it, v));
    out.push(...d.raw, "");
  }
  if (t.outro.length) out.push(...t.outro, "");
  out.push(MARKER, "");
  return out.join("\n");
}

/* un viaje nuevo (Nuevo viaje) */
export function blankTrip(name: string, start: string, end: string, dests: Dest[], travelers: string[], cover: string): Trip {
  const t: Trip = { fm: {}, name, start, end, dests, travelers, cover, mochila: [], tasks: [], days: [], intro: [], outro: [] };
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
