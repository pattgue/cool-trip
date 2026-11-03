/* Los precios: su número, su moneda y cómo se escriben («60 €», «$60», «¥3.000», «45 CHF»). Los usan el plan, el coste y
   las fichas de lugar. */
import type { Trip } from "./types";

/* un número con su moneda: «60 €», «$60», «¥3.000», «45 CHF» (símbolo o código ISO en mayúsculas) */
export const CURRENCIES = ["€", "$", "£", "¥", "CHF", "₩", "฿", "kr", "zł", "R$", "MXN", "ARS", "COP", "CLP", "PEN", "MAD", "TRY", "CZK", "HUF", "INR", "AUD", "CAD"];
const PREFIX = new Set(["$", "£", "¥", "₩", "฿", "R$"]);
export const priceRe = /^(?:(?:R\$|[€$£¥₩฿])\s?\d[\d.,]*|\d[\d.,]*(?:\s?(?:€|\$|£|¥|₩|฿|kr|zł|[A-Z]{3}))?)$/;

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
const CODE_SYM: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", JPY: "¥" };
export const currencyOf = (p: string): string => {
  const m = /R\$|[€$£¥₩฿]|\bkr\b|zł|\b[A-Z]{3}\b/.exec(p);
  return m ? CODE_SYM[m[0]] || m[0] : "€";
};
const CUR_RE = /R\$|[€$£¥₩฿]|\bkr\b|zł|\b[A-Z]{3}\b/;
/* la moneda del viaje: la más usada en sus precios (si no hay ninguna escrita, el euro) */
export function tripCurrency(t: Trip): string {
  const n = new Map<string, number>();
  for (const d of t.days) for (const it of d.items) if (CUR_RE.test(it.price)) { const c = currencyOf(it.price); n.set(c, (n.get(c) || 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || "€";
}
/* un precio para enseñar: siempre con su moneda (la del viaje si no la lleva) */
export const showPrice = (price: string, cur: string): string => !price.trim() ? "" : CUR_RE.test(price) ? price : withCurrency(price, cur);
/* el número tal cual se escribió («30,98»), sin la moneda */
export const priceNumber = (p: string) => p.replace(/R\$|[€$£¥₩฿]|\bkr\b|zł|\b[A-Z]{3}\b/g, "").trim();
/* un precio con su moneda: «60 €», «$60», «45 CHF» */
export function withCurrency(num: string, cur: string): string {
  const n = num.trim();
  if (!n) return "";
  return PREFIX.has(cur) ? `${cur}${n}` : `${n} ${cur}`;
}
export function fmtMoney(n: number, cur = "€"): string {
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return withCurrency(s, cur);
}
