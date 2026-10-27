/* Las dos bases que crea Cool Trip (viajes y lugares), tal como se cerraron en el canvas (filas 5 y 5b, design/bases/):
   fórmulas, vistas nativas de Bases y, si está Cool Bases, sus vistas con el modelo `coolbases` y el CSS libre que pide el
   diseño (el troquel del billete, el billete apaisado del móvil, el color de cada viaje). Si está el plugin Maps, cada base
   lleva también su vista Mapa. Todo es YAML normal de Bases: la base sigue funcionando sin Cool Trip y se puede cambiar a mano.
   Lo que Cool Trip vuelve a tocar después (syncBase) es solo lo suyo: el bloque marcado del CSS libre y las vistas de ciudades nuevas. */
import type { Recog, Settings } from "./types";
import { ICONS, OTHER_ICON } from "./places";
import { twinRecog } from "./settings";
import type { Family } from "./places";
import { locale } from "./i18n";

export type BaseKind = "trips" | "places";
/* lo que la base necesita saber del vault y de los otros plugins */
export interface BaseEnv { cool: boolean; maps: boolean; iconSvg: (name: string) => string }
export interface View { type: string; name: string; [k: string]: unknown }
export interface BaseDoc { filters?: unknown; formulas?: Record<string, string>; properties?: Record<string, { displayName: string }>; views: View[]; [k: string]: unknown }

const HEX: Record<string, string> = { bermellon: "#E8613C", mostaza: "#EDC14B", pistacho: "#B5D69A", cielo: "#9CC9F0", lavanda: "#C2B3F5", rosa: "#F5AFC0" };
const PAL_RE: [string, string][] = [["bermellon", "bermell|vermil"], ["mostaza", "mostaza|mustard"], ["pistacho", "pistach"], ["cielo", "cielo|sky"], ["lavanda", "lavand"], ["rosa", "rosa|pink"]];
const INK = "#141414", DARK = "#2a2a2c";

/* las palabras de las fórmulas y los nombres de las vistas */
const W = {
  es: { upcoming: "Próximos", travelled: "Viajados", all: "Todos", map: "Mapa", guide: "Guía por ciudad",
    days: "días", day: "día", nights: "noches", night: "noche", months: "meses", month: "mes", years: "años", year: "año",
    left: n => `"Faltan " + ${n} + " días"`, left1: '"Falta 1 día"', dayOf: (d, n) => `"Día " + ${d} + " de " + ${n}`,
    ago: (n, u) => `"Hace " + ${n} + " " + ${u}`, inN: n => `"En " + ${n} + " días"`, in1: '"Mañana"', now: '"En curso"', agoTop: '"Hace"', agoBottom: (u: string) => u,
    visited: "Visitado", toVisit: "Por visitar", and: " y ",
    fam: { see: "Ver", eat: "Comer", walk: "Pasear", sleep: "Dormir", other: "Otros" },
    col: { trip: "Viaje", dates: "Fechas", nights: "Noches", when: "Cuándo", place: "Lugar", category: "Categoría", rating: "Valoración", trips: "Viajes", city: "Ciudad" } },
  en: { upcoming: "Upcoming", travelled: "Travelled", all: "All", map: "Map", guide: "Guide by city",
    days: "days", day: "day", nights: "nights", night: "night", months: "months", month: "month", years: "years", year: "year",
    left: n => `${n} + " days to go"`, left1: '"1 day to go"', dayOf: (d, n) => `"Day " + ${d} + " of " + ${n}`,
    ago: (n, u) => `${n} + " " + ${u} + " ago"`, inN: n => `"In " + ${n} + " days"`, in1: '"Tomorrow"', now: '"Now"', agoTop: '""', agoBottom: (u: string) => `${u} + " ago"`,
    visited: "Visited", toVisit: "To visit", and: " and ",
    fam: { see: "See", eat: "Eat", walk: "Walk", sleep: "Sleep", other: "Other" },
    col: { trip: "Trip", dates: "Dates", nights: "Nights", when: "When", place: "Place", category: "Category", rating: "Rating", trips: "Trips", city: "City" } },
} satisfies Record<"es" | "en", { left: (n: string) => string; dayOf: (d: string, n: string) => string; ago: (n: string, u: string) => string; inN: (n: string) => string; [k: string]: unknown }>;
const words = () => W[locale()];
export const viewNames = () => { const w = words(); return { upcoming: w.upcoming, travelled: w.travelled, all: w.all, map: w.map, guide: w.guide }; };

/* ---------- piezas de las fórmulas ---------- */
const q = (v: string) => JSON.stringify(v);
const note = (p: string) => `note[${q(p)}]`;
/* un if() encadenado: [condición, valor]… y lo que queda */
const chain = (cases: [string, string][], last: string) => cases.reduceRight((acc, [c, v]) => `if(${c}, ${v}, ${acc})`, last);
const DAY = 86400000;
const days = (a: string, b: string) => `((number(${a}) - number(${b})) / ${DAY}).round()`;

/* el filtro de la base: cómo reconoce los ajustes cada tipo de nota. Con «tipo: viaje», también «type: trip» (lo mismo que
   reconoce Cool Trip: el móvil y el ordenador pueden tener Obsidian en idiomas distintos) y sin distinguir mayúsculas */
const one = (r: Recog, f: string) => r.mode === "folder" ? `${f}.inFolder(${q(r.folder)})` : r.mode === "tag" ? `${f}.hasTag(${q(r.value.replace(/^#/, ""))})`
  : `list(${f === "file" ? note(r.key) : `${f}.properties[${q(r.key)}]`}).map(value.toString().lower()).contains(${q(r.value.trim().toLowerCase())})`;
export function recogFilter(r: Recog, kind: "trip" | "place"): string {
  const twin = twinRecog(r, kind);
  return twin ? `${one(r, "file")} || ${one(twin, "file")}` : one(r, "file");
}
/* lo mismo, para otra nota (en las fórmulas que miran los viajes que enlazan un lugar) */
function recogOf(r: Recog, f: string): string {
  const twin = twinRecog(r, "trip");
  return twin ? `(${one(r, f)} || ${one(twin, f)})` : one(r, f);
}
/* el filtro que escribían las versiones anteriores (solo la propiedad tal cual): se cambia por el de ahora */
export function oldFilter(r: Recog): string {
  return r.mode === "folder" ? `file.inFolder(${q(r.folder)})` : r.mode === "tag" ? `file.hasTag(${q(r.value.replace(/^#/, ""))})` : `${note(r.key)} == ${q(r.value)}`;
}

/* ---------- base de viajes ---------- */
function tripFormulas(s: Settings): Record<string, string> {
  const P = s.props, w = words();
  const S = `date(${note(P.start)})`, E = `date(${note(P.end || P.start)})`;
  const cover = P.cover ? note(P.cover) : '""';
  const swatch = chain([[`!${cover}`, q(HEX.bermellon)], ...PAL_RE.map(([id, re]) => [`/${re}/i.matches(${cover}.toString())`, q(HEX[id])] as [string, string])], '""');
  const f: Record<string, string> = {
    nights: days(E, S),
    days: "formula.nights + 1",
    until: days(S, "today()"),
    since: days("today()", E),
    dayNum: `${days("today()", S)} + 1`,
    /* hace cuánto acabó, redondeado como lo diría una persona: días (menos de 26), meses (menos de 320) o años */
    agoN: chain([["formula.since < 26", "formula.since"], ["formula.since < 320", "max(1, (formula.since / 30.44).round())"]], "max(1, (formula.since / 365.25).floor())"),
    agoU: chain([["formula.since < 26", `if(formula.agoN == 1, ${q(w.day)}, ${q(w.days)})`], ["formula.since < 320", `if(formula.agoN == 1, ${q(w.month)}, ${q(w.months)})`]],
      `if(formula.agoN == 1, ${q(w.year)}, ${q(w.years)})`),
    ago: w.ago("formula.agoN", "formula.agoU"),
    when: chain([["formula.until == 1", w.left1], ["formula.until > 0", w.left("formula.until")], ["formula.since <= 0", w.dayOf("formula.dayNum", "formula.days")]], "formula.ago"),
    /* la pastilla del billete (en mayúsculas en la tarjeta) y la matriz del billete apaisado */
    pill: chain([["formula.until == 1", w.in1], ["formula.until > 0", w.inN("formula.until")], ["formula.since <= 0", w.now]], "formula.ago"),
    stubNow: `if(formula.until <= 0 && formula.since <= 0, ${w.now}, "")`,
    stubTop: `if(formula.since > 0, ${w.agoTop}, "")`,
    stubN: chain([["formula.until > 0", "formula.until"], ["formula.since > 0", "formula.agoN"]], '""'),
    stubUnit: chain([["formula.until > 0", `if(formula.until == 1, ${q(w.day)}, ${q(w.days)})`], ["formula.since > 0", w.agoBottom("formula.agoU")]], '""'),
    daysLabel: `formula.days + " " + ${q(w.days)}`,
    nightsLabel: `formula.nights + " " + if(formula.nights == 1, ${q(w.night)}, ${q(w.nights)})`,
    /* «Italia y Grecia» (el nombre sin el año) y «LISBOA → OPORTO» */
    title: 'file.basename.replace(/^\\d{4}\\s*-\\s*/, "")',
    route: `list(${note(P.destinations)}).join(" → ")`,
    /* «24 – 30 oct» y el año aparte; en el móvil, «24 – 30 oct 2026 · 6 noches» */
    dates: `(if(${S}.format("YYYY-MM") == ${E}.format("YYYY-MM"), ${S}.format("D"), ${S}.format("D MMM")) + " – " + ${E}.format("D MMM")).replace(".", "")`,
    year: `${S}.format("YYYY")`,
    datesYear: 'formula.dates + " " + formula.year',
    datesNights: 'formula.datesYear + " · " + formula.nightsLabel',
    yearRoute: 'formula.year + " · " + formula.route',
    who: P.travelers ? `list(${note(P.travelers)}).join(", ")` : '""',
    nightsWho: `formula.nightsLabel + if(formula.who, " · " + formula.who, "")`,
    /* el color del viaje (#rrggbb, el de su paleta) y la portada: el color, o la imagen si la portada es una foto */
    swatch,
    color: `if(formula.swatch, formula.swatch, ${q(HEX.bermellon)})`,
    cover: `if(formula.swatch, formula.swatch, ${cover})`,
    photo: `if(formula.swatch, "", ${cover})`,
    pin: '"plane"',
  };
  return f;
}
const TRIP_PROPS = () => {
  const c = words().col;
  return { "file.name": c.trip, "formula.datesYear": c.dates, "formula.nights": c.nights, "formula.when": c.when };
};

/* el billete de Cool Bases: el modelo (lo que se edita en su panel) y el CSS libre que pide el diseño */
const item = (prop: string, o: Record<string, unknown> = {}, tt: Record<string, unknown> = {}) =>
  ({ id: "ct" + prop.replace(/\W/g, ""), kind: "dato", prop, type: "texto", spaceT: 0, spaceB: 0, ...o, t: tt });
export const CSS_START = "/* cool-trip:colores */", CSS_END = "/* cool-trip:fin */";
const TICKET_CSS = `/* Cool Trip · el billete: en el ordenador, vertical, con el troquel y una muesca a cada lado; en el móvil, apaisado, con la matriz a la derecha */
& .cb-card { --ct: ${HEX.cielo}; background: var(--ct) !important; }
& .cb-card .cb-body { height: 100%; box-sizing: border-box; padding: 18px 20px; gap: 5px; }
& .cb-l { margin: 0 !important; padding: 0 !important; line-height: 1.3; }
& .cb-l:has([data-prop="formula.nightsLabel"]) { margin-top: -2px !important; }
& .cb-l:has([data-prop="formula.pill"]) { position: absolute; top: 18px; right: 20px; }
& [data-prop="formula.pill"] { display: inline-block; letter-spacing: .14em; padding: 5px 8px 4px; border-radius: 999px; background: ${INK}; --cb-x-c: var(--ct) !important; white-space: nowrap; line-height: 1; }
& .cb-l:has([data-prop="file.name"]) { margin-top: auto !important; text-align: center; line-height: .95; letter-spacing: -1.5px; }
& .cb-l:has([data-prop="formula.route"]) { letter-spacing: .12em; line-height: 1.35; text-align: center; margin-bottom: 13px !important; }
& .cb-l:has([data-prop="note.{{travelers}}"]) { border-top: 2px dashed rgba(20, 20, 20, .45); margin: 0 -6px !important; padding: 8px 6px 4px !important; }
& .cb-l:has([data-prop="note.{{travelers}}"]) .cb-pill { letter-spacing: .1em; padding: 2px 6px; margin-right: 5px; border-radius: 999px; border: 1.5px solid ${INK}; background: none; }
& .cb-l:has([data-prop="formula.dates"]) { display: flex; justify-content: space-between; margin-top: 2px !important; }
& .cb-l:has([data-prop="formula.dates"]) .cb-sep { display: none; }
& [data-prop="formula.year"] { margin-left: auto; }
/* las muescas: dos agujeros a la altura del troquel (a 78 px del pie), que dejan ver el fondo */
& .cb-card { -webkit-mask: radial-gradient(circle 10px at 0 calc(100% - 78px), transparent 98%, #000 100%) left / 51% 100% no-repeat, radial-gradient(circle 10px at 100% calc(100% - 78px), transparent 98%, #000 100%) right / 51% 100% no-repeat;
  mask: radial-gradient(circle 10px at 0 calc(100% - 78px), transparent 98%, #000 100%) left / 51% 100% no-repeat, radial-gradient(circle 10px at 100% calc(100% - 78px), transparent 98%, #000 100%) right / 51% 100% no-repeat; }
/* con foto: arriba, fundida en el color del viaje */
& .cb-card .cb-media { inset: 0 0 36% 0 !important; }
& .cb-card .cb-media::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 30%, var(--ct) 96%); }
/* lo que solo sale en el móvil */
& .cb-l:has([data-prop="formula.yearRoute"]), & .cb-l:has([data-prop="formula.datesNights"]), & .cb-l:has([data-prop^="formula.stub"]) { display: none; }
.is-phone & .cb-grid { --cb-cw: 300px !important; gap: 12px !important; }
.is-phone & .cb-card::before { padding-top: 0 !important; height: 150px !important; }
.is-phone & .cb-card { -webkit-mask: radial-gradient(circle 9px at calc(100% - 92px) 0, transparent 98%, #000 100%) top / 100% 51% no-repeat, radial-gradient(circle 9px at calc(100% - 92px) 100%, transparent 98%, #000 100%) bottom / 100% 51% no-repeat;
  mask: radial-gradient(circle 9px at calc(100% - 92px) 0, transparent 98%, #000 100%) top / 100% 51% no-repeat, radial-gradient(circle 9px at calc(100% - 92px) 100%, transparent 98%, #000 100%) bottom / 100% 51% no-repeat; }
.is-phone & .cb-card .cb-body { padding: 14px 104px 14px 16px; gap: 4px; }
.is-phone & .cb-card .cb-body::after { content: ""; position: absolute; top: 0; bottom: 0; right: 92px; border-left: 2px dashed rgba(20, 20, 20, .45); }
.is-phone & .cb-l:has([data-prop="formula.daysLabel"]), .is-phone & .cb-l:has([data-prop="formula.nightsLabel"]), .is-phone & .cb-l:has([data-prop="formula.pill"]), .is-phone & .cb-l:has([data-prop="formula.route"]), .is-phone & .cb-l:has([data-prop="formula.dates"]) { display: none; }
.is-phone & .cb-l:has([data-prop="formula.yearRoute"]) { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.is-phone & [data-prop="formula.yearRoute"] { --cb-x-fs: 10px !important; letter-spacing: .14em; }
.is-phone & .cb-l:has([data-prop="file.name"]) { text-align: left; letter-spacing: -1.2px; }
.is-phone & [data-prop="file.name"] { --cb-x-fs: calc(var(--k, 1) * 30px) !important; }
.is-phone & .cb-l:has([data-prop="formula.datesNights"]) { display: block; }
.is-phone & [data-prop="formula.datesNights"] { --cb-x-fs: 12px !important; }
.is-phone & .cb-l:has([data-prop="note.{{travelers}}"]) { border: 0; margin: 0 !important; padding: 0 !important; }
.is-phone & [data-prop="note.{{travelers}}"] { --cb-x-fs: 9px !important; }
.is-phone & .cb-l:has([data-prop^="formula.stub"]) { display: block; position: absolute; right: 0; width: 92px; text-align: center; top: 50%; line-height: 1; }
.is-phone & .cb-l:has([data-prop="formula.stubNow"]) { transform: translateY(-50%); }
.is-phone & [data-prop="formula.stubNow"] { display: inline-block; box-sizing: border-box; width: 65px; padding: 8px 7px; border-radius: 8px; background: ${INK}; --cb-x-c: var(--ct) !important; --cb-x-fs: 11px !important; letter-spacing: .14em; line-height: 1.3; white-space: normal; }
.is-phone & .cb-l:has([data-prop="formula.stubN"]) { transform: translateY(-62%); }
.is-phone & [data-prop="formula.stubN"] { --cb-x-fs: 34px !important; letter-spacing: -1.2px; }
.is-phone & .cb-l:has([data-prop="formula.stubTop"]) { transform: translateY(-37px); }
.is-phone & .cb-l:has([data-prop="formula.stubUnit"]) { transform: translateY(12px); }
.is-phone & [data-prop="formula.stubTop"], .is-phone & [data-prop="formula.stubUnit"] { --cb-x-fs: 10px !important; letter-spacing: .14em; }
.is-phone & .cb-card:has([data-prop="formula.stubTop"]) .cb-l:has([data-prop="formula.stubN"]) { transform: translateY(-45%); }
.is-phone & .cb-card:has([data-prop="formula.stubTop"]) .cb-l:has([data-prop="formula.stubUnit"]) { transform: translateY(19px); }
.is-phone & .cb-card .cb-media { inset: 0 30% 0 0 !important; }
.is-phone & .cb-card .cb-media::after { background: linear-gradient(to right, transparent 35%, var(--ct)); }`;

function ticketModel(s: Settings): Record<string, unknown> {
  const P = s.props;
  /* los tamaños, en cqi de la tarjeta (sobre los 273 px de la del canvas): 10 px = 3,66 */
  const px = (n: number) => +(n / 2.73).toFixed(2);
  const items = [
    item("formula.daysLabel", { upper: true, size: px(10), weight: 700 }), item("formula.nightsLabel", { upper: true, size: px(10), weight: 700 }),
    item("formula.pill", { upper: true, size: px(9), weight: 800 }),
    item("formula.yearRoute", { upper: true, size: px(10), weight: 800 }),
    { ...item("file.name", { kind: "title", upper: true, weight: 900, size: 23, fit: true }, { tsrc: "formula.title" }) },
    item("formula.route", { upper: true, size: px(11), weight: 800 }), item("formula.datesNights", { size: px(12), weight: 700 }),
    P.travelers ? item("note." + P.travelers, { type: "etiquetas", upper: true, size: px(9), weight: 800 }, { tagStyle: "outline", max: 6 }) : null,
    item("formula.dates", { upper: true, size: px(14), weight: 400 }), item("formula.year", { join: true, sep: "", size: px(14), weight: 700 }),
    item("formula.stubNow", { upper: true, weight: 800 }), item("formula.stubTop", { upper: true, weight: 800 }), item("formula.stubN", { weight: 900 }),
    item("formula.stubUnit", { upper: true, weight: 800 }),
  ].filter(Boolean);
  return {
    v: 1,
    card: { w: 240, fill: true, fmt: "3/4", pad: 0, radius: 14, gap: 20 },
    col: { bg: HEX.cielo, text: INK, det: INK, bw: 0 },
    font: { family: "Inter", weight: 700, size: 3.7, align: "left" },
    img: { src: "formula.photo", pos: "top", fit: "fondo", empty: "nada" },
    hover: { on: false },
    rate: { on: false }, states: { on: false, list: [] }, lines: { on: false, n: 0 }, foot: { on: false },
    items, fitems: [],
    css: TICKET_CSS.split("{{travelers}}").join(P.travelers || "-") + "\n" + CSS_START + "\n" + CSS_END,
  };
}

export function tripsBase(s: Settings, env: BaseEnv): BaseDoc {
  const P = s.props, v = viewNames();
  const S = note(P.start), E = note(P.end || P.start);
  const cards = (name: string, filter: string, o: Record<string, unknown>, ratio: number, lines: string[]): View => env.cool
    ? { type: "cool-bases", name, filters: { and: [filter] }, ...o, order: ["file.name"], coolbases: ticketModel(s) }
    : { type: "cards", name, filters: { and: [filter] }, ...o, order: ["file.name", ...lines], image: "formula.cover", imageFit: "cover", imageAspectRatio: ratio, cardSize: 240 };
  const dests = "note." + P.destinations, who = P.travelers ? "note." + P.travelers : null;
  const views: View[] = [
    cards(v.upcoming, `date(${E}) >= today()`, { sort: [{ property: `note.${P.start}`, direction: "ASC" }] }, 0.48,
      ["formula.when", "formula.datesNights", dests, who].filter((x): x is string => !!x)),
    cards(v.travelled, `date(${E}) < today()`, { groupBy: { property: "formula.year", direction: "DESC" }, sort: [{ property: `note.${P.start}`, direction: "DESC" }] }, 0.4,
      ["formula.datesYear", "formula.nightsWho"]),
    { type: "table", name: v.all, order: ["file.name", "formula.datesYear", "formula.nights", dests, who, "formula.when"].filter(Boolean),
      sort: [{ property: `note.${P.start}`, direction: "DESC" }], summaries: { "formula.nights": "Sum" } },
  ];
  if (env.maps) views.push(mapView(s, "trips"));
  return { filters: { and: [recogFilter(s.trips, "trip"), `${S}`] }, formulas: tripFormulas(s), properties: displayNames(TRIP_PROPS()), views };
}

/* ---------- base de lugares ---------- */
/* la imagen de un lugar sin foto: el color de su categoría con su icono en el centro (un SVG en una URL data:) */
function tileUrls(env: BaseEnv, w: number, h: number, size: number): string {
  const all = [...ICONS.map(([, i, c]) => [i, c] as [string, string]), [OTHER_ICON[0], OTHER_ICON[1]] as [string, string]];
  const seen = new Set<string>(), cases: [string, string][] = [];
  for (const [ico, col] of all) {
    if (seen.has(ico)) continue;
    seen.add(ico);
    const k = size / 24, x = (w - size) / 2, y = (h - size) / 2;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w * 4}' height='${h * 4}' viewBox='0 0 ${w} ${h}'><rect width='${w}' height='${h}' fill='${HEX[col]}'/>` +
      `<g transform='translate(${x} ${y}) scale(${k})' fill='none' stroke='${INK}' stroke-width='${size > 30 ? 1.8 : 1.9}' stroke-linecap='round' stroke-linejoin='round'>${env.iconSvg(ico).replace(/"/g, "'")}</g></svg>`;
    cases.push([`formula.icon == ${q(ico)}`, q("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg).replace(/'/g, "%27"))]);
  }
  return chain(cases.slice(0, -1), cases[cases.length - 1][1]);
}
function placeFormulas(s: Settings, env: BaseEnv): Record<string, string> {
  const P = s.props, w = words();
  const cat = P.category ? `${note(P.category)}.toString()` : '""';
  const byCat = (pick: (e: (typeof ICONS)[number]) => string, last: string) =>
    P.category ? chain(ICONS.map(e => [`/${e[0].source}/i.matches(${cat})`, pick(e)] as [string, string]), last) : last;
  const rating = P.rating ? `number(list(${note(P.rating)})[0])` : "0";
  const f: Record<string, string> = {
    icon: byCat(e => q(e[1]), q(OTHER_ICON[0])),
    color: byCat(e => q(HEX[e[2]]), q(HEX[OTHER_ICON[1]])),
    family: byCat(e => q(w.fam[e[3]]), q(w.fam[OTHER_ICON[2]])),
    cityCountry: P.country ? `${note(P.city)} + if(${note(P.country)}, " · " + ${note(P.country)}, "")` : note(P.city),
    catPrice: P.category && P.price ? `[${note(P.category)}, ${note(P.price)}].filter(value).join(" · ")` : P.category ? `${cat}` : '""',
    stars: P.rating ? `if(${note(P.rating)}, "★".repeat(${rating}) + "☆".repeat(5 - ${rating}), "")` : '""',
    seen: P.visited ? `if(${note(P.visited)}, ${q(w.visited)}, ${q(w.toVisit)})` : '""',
    /* los viajes que enlazan este lugar (los reconoce igual que los ajustes) */
    trips: `file.backlinks.filter(${recogOf(s.trips, "file(value)")})`,
    tripNames: "formula.trips.map(file(value).basename).join(\", \")",
    tile: tileUrls(env, 52, 52, 24),
    thumb: tileUrls(env, 212, 130, 34),
    photo: P.photo ? `if(${note(P.photo)}, ${note(P.photo)}, formula.thumb)` : "formula.thumb",
    cover: P.photo ? `if(${note(P.photo)}, ${note(P.photo)}, formula.color)` : "formula.color",
  };
  return f;
}
const PLACE_PROPS = () => {
  const c = words().col;
  return { "file.name": c.place, "formula.catPrice": c.category, "formula.stars": c.rating, "formula.trips": c.trips, "formula.cityCountry": c.city };
};

const ROW_CSS = `/* Cool Trip · filas oscuras: el icono de la categoría en su color, las estrellas y la casilla */
& .cb-card .cb-main { align-items: center; gap: 12px; padding: 10px 50px 10px 10px; }
& .cb-card .cb-media { flex: none !important; width: 52px !important; height: 52px; border-radius: 9px; }
& .cb-card .cb-body { padding: 0 !important; gap: 3px; }
& .cb-l { margin: 0 !important; padding: 0 !important; line-height: 1.25; }
& [data-prop="file.name"] { --cb-x-fs: 15px !important; --cb-x-c: #fff !important; font-weight: 800 !important; }
& .cb-l:has([data-prop="file.name"]) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
& [data-prop="formula.catPrice"] { --cb-x-fs: 12px !important; --cb-x-c: #a8a8a8 !important; font-weight: 600 !important; }
& [data-prop="formula.tripNames"] { --cb-x-fs: 11px !important; --cb-x-c: #9a9a9a !important; font-weight: 700 !important; letter-spacing: .08em; }
& .cb-card:has(.cb-rl) .cb-l:has([data-prop="formula.tripNames"]) { display: none; }
& .cb-rl { font-size: 12px; }
& .cb-ck { width: 26px !important; height: 26px !important; border-radius: 7px; border-width: 2px !important; }
& .cb-st:not(.is-on) .cb-ck { border-color: #5a5a5e; }
.is-phone & .cb-grid { gap: 8px !important; }`;
const CITY_CSS = `/* Cool Trip · tarjetas de una ciudad: la foto (o el color de la categoría) arriba y la casilla encima */
& .cb-card .cb-media { flex: none !important; height: 130px; min-height: 0 !important; }
& .cb-card .cb-body { padding: 12px 14px 14px !important; gap: 6px; }
& .cb-l { margin: 0 !important; padding: 0 !important; line-height: 1.25; }
& [data-prop="formula.catPrice"] { --cb-x-fs: 10px !important; --cb-x-c: #a8a8a8 !important; font-weight: 800 !important; letter-spacing: .14em; }
& [data-prop="file.name"] { --cb-x-fs: 17px !important; --cb-x-c: #fff !important; font-weight: 800 !important; letter-spacing: -.2px; }
& .cb-l:has([data-prop="file.name"]) { line-height: 1.15; }
& .cb-rule { margin: 2px 0 0 !important; }
& [data-prop="formula.tripNames"] { --cb-x-fs: 11px !important; --cb-x-c: #9a9a9a !important; font-weight: 700 !important; letter-spacing: .06em; }
& .cb-ck { width: 26px !important; height: 26px !important; border-radius: 7px; border-width: 2px !important; }
& .cb-st:not(.is-on) .cb-ck { background: rgba(20, 20, 20, .35); }
.is-phone & .cb-grid { --cb-cw: 150px !important; gap: 10px !important; }
.is-phone & .cb-card .cb-media { height: 104px; }`;

function placeModel(s: Settings, city: boolean): Record<string, unknown> {
  const P = s.props;
  const check = P.visited ? [{ id: "ctseen", prop: "note." + P.visited, show: "always", yes: "", no: "", fmt: "check", place: city ? "tr" : "mr", onImg: city, mx: city ? 4.5 : 3.5, my: city ? 4.5 : 0, color: "#ffffff", size: 7 }] : [];
  const items = city
    ? [item("formula.catPrice", { upper: true }), item("file.name", { kind: "title" }), { id: "ctline", kind: "line" }, item("formula.tripNames", { upper: true })]
    : [item("file.name", { kind: "title" }), item("formula.catPrice"), { id: "rating", kind: "rating" }, item("formula.tripNames", { upper: true })];
  return {
    v: 1,
    card: city ? { w: 212, fill: true, fmt: "libre", h: 200, pad: 0, radius: 12, gap: 16 } : { w: 300, fill: true, fmt: "libre", h: 72, pad: 0, radius: 12, gap: 12 },
    col: { bg: DARK, text: "#dcddde", det: "#a8a8a8", bw: 0 },
    font: { family: "Inter", weight: 600, size: 4, align: "left" },
    img: { src: city ? "formula.photo" : "formula.tile", pos: city ? "top" : "left", fit: "encajar", frame: 0, empty: "nada" },
    hover: { on: false },
    rate: { on: !!P.rating && !city, prop: P.rating ? "note." + P.rating : "auto", type: "stars", place: "entre", color: HEX.mostaza, size: 4, empty: true },
    states: { on: check.length > 0, list: check },
    lines: { on: city, n: city ? 1 : 0, color: "#444444", w: 1.5, width: "full", mt: 0, mb: 0 },
    foot: { on: false },
    items: city ? items : items.filter(x => x.kind !== "rating" || P.rating), fitems: [],
    css: city ? CITY_CSS : ROW_CSS,
  };
}

/* la vista de una ciudad: sus lugares por tipo (ver, comer, pasear…) */
export function cityView(s: Settings, env: BaseEnv, city: string): View {
  const w = words(), P = s.props;
  const base = { name: city, filters: { and: [`${note(P.city)} == ${q(city)}`] },
    groupBy: { property: "formula.family", direction: "ASC" }, groupOrder: (["see", "eat", "walk", "sleep", "other"] as Family[]).map(f => w.fam[f]) };
  return env.cool
    ? { type: "cool-bases", ...base, order: ["file.name"], coolbases: placeModel(s, true) }
    : { type: "cards", ...base, order: ["file.name", "formula.catPrice", P.visited ? "formula.seen" : null].filter(Boolean),
      image: "formula.cover", imageFit: "cover", imageAspectRatio: 0.6, cardSize: 200 };
}
export function placesBase(s: Settings, env: BaseEnv, cities: string[]): BaseDoc {
  const P = s.props, v = viewNames();
  const group = { groupBy: { property: "formula.cityCountry", direction: "ASC" } };
  const guide: View = env.cool
    ? { type: "cool-bases", name: v.guide, ...group, order: ["file.name"], coolbases: placeModel(s, false) }
    : { type: "table", name: v.guide, ...group, order: ["file.name", "formula.catPrice", P.rating ? "formula.stars" : null, P.visited ? "note." + P.visited : null, "formula.trips"].filter(Boolean) };
  const views: View[] = [guide];
  if (env.maps) views.push(mapView(s, "places"));
  views.push(...cities.map(c => cityView(s, env, c)));
  return { filters: { and: [recogFilter(s.places, "place")] }, formulas: placeFormulas(s, env), properties: displayNames(PLACE_PROPS()), views };
}

/* ---------- el mapa (plugin Maps): un marcador por nota, con su icono y su color ---------- */
export function mapView(s: Settings, kind: BaseKind): View {
  const P = s.props;
  return { type: "map", name: viewNames().map, order: kind === "trips" ? ["file.name", "formula.datesNights", "note." + P.destinations] : ["file.name", "formula.catPrice"],
    coordinates: "note." + P.location, markerIcon: kind === "trips" ? "formula.pin" : "formula.icon", markerColor: "formula.color" };
}
const displayNames = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { displayName: v }]));

/* ---------- lo que Cool Trip vuelve a tocar en una base que ya existe ---------- */
/* el color de cada viaje en las vistas de Cool Bases (una regla por nota, con su data-path) */
export function tripColorsCss(trips: { path: string; color: string }[]): string {
  return trips.map(tr => `& .cb-card[data-path=${JSON.stringify(tr.path)}] { --ct: ${tr.color}; }`).join("\n");
}
function setBlock(css: string, block: string): string {
  const a = css.indexOf(CSS_START), b = css.indexOf(CSS_END);
  if (a < 0 || b < a) return css;
  return css.slice(0, a + CSS_START.length) + (block ? "\n" + block + "\n" : "\n") + css.slice(b);
}
/* devuelve true si ha cambiado algo: el bloque de colores de los billetes, las vistas de ciudades nuevas y el mapa que falte */
export function syncBase(doc: BaseDoc, kind: BaseKind, s: Settings, env: BaseEnv, o: { colors?: string; newCities?: string[]; addMap?: boolean; useCool?: boolean }): boolean {
  let changed = false;
  if (!Array.isArray(doc.views)) doc.views = [];
  const v = viewNames();
  if (o.useCool && env.cool) {
    /* las vistas de tarjetas o la tabla de la guía que creó Cool Trip pasan a Cool Bases */
    const fresh = kind === "trips" ? tripsBase(s, env) : placesBase(s, env, []);
    doc.views = doc.views.map(view => {
      const ours = kind === "trips" ? [v.upcoming, v.travelled].includes(view.name) && view.type === "cards"
        : (view.name === v.guide && view.type === "table") || (view.type === "cards" && s.baseCities.includes(view.name.toLowerCase()));
      if (!ours) return view;
      changed = true;
      const nv = fresh.views.find(x => x.name === view.name) || cityView(s, env, view.name);
      return { ...nv, filters: view.filters ?? nv.filters, sort: view.sort ?? nv.sort };
    });
    doc.formulas = { ...fresh.formulas, ...doc.formulas };
  }
  if (o.addMap && env.maps && !doc.views.some(x => x.type === "map")) {
    const at = kind === "trips" ? doc.views.length : Math.min(1, doc.views.length);
    doc.views.splice(at, 0, mapView(s, kind));
    changed = true;
  }
  for (const c of o.newCities || []) {
    if (doc.views.some(x => x.name === c)) continue;
    doc.views.push(cityView(s, env, c));
    changed = true;
  }
  if (o.colors != null) {
    for (const view of doc.views) {
      const m = view.coolbases as { css?: unknown } | undefined;
      if (view.type !== "cool-bases" || !m || typeof m.css !== "string") continue;
      const next = setBlock(m.css, o.colors);
      if (next !== m.css) { m.css = next; changed = true; }
    }
  }
  return changed;
}
