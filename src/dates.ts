/* Fechas sin zona horaria: «AAAA-MM-DD» de principio a fin (un día de viaje es un día del calendario, no un instante). */
import { locale } from "./i18n";

const WD = { es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const MON = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};
/* todas las formas que se aceptan al leer (las dos lenguas, con y sin punto, «sept») */
const MON_READ: Record<string, number> = {};
[MON.es, MON.en].forEach(list => list.forEach((m, i) => { MON_READ[m.toLowerCase()] = i; }));
Object.assign(MON_READ, { sept: 8, set: 8, ene: 0, enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7,
  septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11, january: 0, february: 1, march: 2, april: 3, june: 5, july: 6, august: 7,
  september: 8, october: 9, november: 10, december: 11 });

export const isIso = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function parseIso(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
export function iso(d: Date): string { return d.toISOString().slice(0, 10); }
export function addDays(s: string, n: number): string { const d = parseIso(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
export function diffDays(a: string, b: string): number { return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000); }
export function todayIso(): string { const d = new Date(); return iso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); }
export function range(start: string, end: string): string[] {
  const out: string[] = [];
  if (!isIso(start) || !isIso(end) || end < start) return out;
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

const L = () => locale();
export const weekday = (s: string) => WD[L()][parseIso(s).getUTCDay()];
export const monthShort = (s: string) => MON[L()][parseIso(s).getUTCMonth()];
export const dayNum = (s: string) => parseIso(s).getUTCDate();
/* «Sáb 3 abr» (encabezado de día) · «sáb 3 abr» (dentro de un campo) */
export const dayLabel = (s: string) => L() === "es" ? `${weekday(s)} ${dayNum(s)} ${monthShort(s)}` : `${weekday(s)}, ${monthShort(s)} ${dayNum(s)}`;
export const dayLabelLower = (s: string) => L() === "es" ? dayLabel(s).toLowerCase() : dayLabel(s);
/* «Sáb 3 abr 2027» */
export const longDate = (s: string) => `${dayLabel(s)} ${parseIso(s).getUTCFullYear()}`;
/* «3 – 14 abr» / «28 mar – 4 abr» */
export function spanLabel(a: string, b: string): string {
  if (!isIso(a) || !isIso(b)) return "";
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  if (L() === "es") return sameMonth ? `${dayNum(a)} – ${dayNum(b)} ${monthShort(b)}` : `${dayNum(a)} ${monthShort(a)} – ${dayNum(b)} ${monthShort(b)}`;
  return sameMonth ? `${monthShort(a)} ${dayNum(a)} – ${dayNum(b)}` : `${monthShort(a)} ${dayNum(a)} – ${monthShort(b)} ${dayNum(b)}`;
}

/* lee «sáb 3 abr», «3 abr», «Sat, Apr 3», «2027-04-03»: devuelve la fecha más cercana al viaje (el año lo pone el viaje) */
export function readDay(text: string, near: string): string {
  const s = text.trim();
  const isoM = /(\d{4}-\d{2}-\d{2})/.exec(s);
  if (isoM) return isoM[1];
  let day = 0, mon = -1;
  const a = /(\d{1,2})\s+(?:de\s+)?([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\.?/.exec(s);       // 3 abr
  const b = /([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\.?\s+(\d{1,2})\b/.exec(s);                // Apr 3
  if (a && MON_READ[a[2].toLowerCase()] != null) { day = +a[1]; mon = MON_READ[a[2].toLowerCase()]; }
  else if (b && MON_READ[b[1].toLowerCase()] != null) { day = +b[2]; mon = MON_READ[b[1].toLowerCase()]; }
  if (mon < 0 || !day) return "";
  const base = isIso(near) ? parseIso(near).getUTCFullYear() : new Date().getFullYear();
  let best = "", bestD = Infinity;
  for (const y of [base - 1, base, base + 1]) {
    const cand = iso(new Date(Date.UTC(y, mon, day)));
    const d = isIso(near) ? Math.abs(diffDays(near, cand)) : 0;
    if (d < bestD) { best = cand; bestD = d; }
  }
  return best;
}
export const isTime = (s: string) => /^\d{1,2}[:.]\d{2}$/.test(s.trim());
export const normTime = (s: string) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(s.trim()); return m ? m[1].padStart(2, "0") + ":" + m[2] : ""; };
