// Pruebas del Markdown de la nota del viaje: se lee el ejemplo cerrado con Patt, se escribe y se vuelve a leer.
// Uso: npm test (compila src/md.ts con un «obsidian» falso y lo ejecuta en Node).
import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, "out"), { recursive: true });
const outfile = join(here, "out", "md.mjs");
await esbuild.build({
  entryPoints: [join(here, "entry.ts")], bundle: true, format: "esm", platform: "node", outfile, logLevel: "error",
  plugins: [{ name: "stub", setup: b => b.onResolve({ filter: /^obsidian$/ }, () => ({ path: join(here, "obsidian-stub.mjs") })) }],
});
const md = await import(pathToFileURL(outfile).href + "?" + Date.now());
/* las pruebas reconocen las notas por la propiedad «tipo» (por defecto, Cool Trip usa carpetas) */
const prop = x => { x.trips.mode = x.places.mode = "property"; return x; };
const S = prop(md.defaultSettings("es"));
S.countries = { lisboa: "Portugal" };
const sample = readFileSync(join(here, "sample.md"), "utf8");

let fails = 0;
const ok = (name, cond, extra = "") => { if (!cond) fails++; console.log((cond ? "✓ " : "✗ ") + name + (extra ? " — " + extra : "")); };

const t = md.parseTrip(sample, "2027 - Japón", S);
ok("fechas", t.start === "2027-04-03" && t.end === "2027-04-14", t.start + " " + t.end);
ok("destinos y noches", t.dests.map(d => `${d.city}:${d.nights}`).join(",") === "Tokio:6,Kioto:5", JSON.stringify(t.dests));
ok("12 días", t.days.length === 12, String(t.days.length));
ok("mochila", t.mochila.length === 3 && t.mochila[0].where === "paper" && t.mochila[2].where === "cloud", JSON.stringify(t.mochila));
ok("por hacer", t.tasks.length === 8 && t.tasks.filter(x => x.done).length === 3);
const d3 = t.days[0].items[0];
ok("vuelo", d3.kind === "flight" && d3.time === "11:50" && d3.price === "920 €" && d3.para.join() === "Ana,Leo", JSON.stringify(d3));
ok("vuelo: campos", md.field(d3, "depart").startsWith("sáb 3 abr") && md.field(d3, "seats") === "Ana 32A · Leo 32B" && md.field(d3, "code") === "IB 281", JSON.stringify(d3.fields));
ok("vuelo: documentos", d3.docs.length === 2 && d3.docs[0].where === "wallet", JSON.stringify(d3.docs));
const hotel = t.days[1].items[0];
ok("hotel", hotel.kind === "lodging" && hotel.link === "Hotel Kaminarimon" && md.field(hotel, "beds") === "1 doble" && hotel.docs[0].where === "paper", JSON.stringify(hotel));
const senso = t.days[1].items.find(i => i.link === "Senso-ji");
ok("lugar hecho", senso && senso.kind === "place" && senso.done && senso.time === "16:30");
const rest = t.days[1].items.find(i => i.kind === "rest");
ok("vuelta al hotel", rest && rest.link === "Hotel Kaminarimon" && rest.time === "21:30");
const lun = t.days[2].items;
ok("desayuno", lun[0].kind === "meal" && lun[0].title === "Desayuno" && lun[0].link === "Hotel Kaminarimon" && lun[0].extra.includes("incluido"), JSON.stringify(lun[0]));
ok("entrada", lun.some(i => i.kind === "ticket" && i.link === "teamLab Planets" && i.price === "32 €" && i.para.join() === "Ana"));
ok("cena", lun.some(i => i.kind === "meal" && i.title === "Cena" && i.price === "60 €"));
ok("tren", t.days[6].items.some(i => i.kind === "train" && md.field(i, "code") === "Nozomi 225" && md.field(i, "car") === "7"));
ok("ciudades del día de cambio", md.citiesOfDay(t, "2027-04-09").map(d => d.city).join() === "Tokio,Kioto");

const out1 = md.serializeTrip(t, S);
const t2 = md.parseTrip(out1, "2027 - Japón", S);
const out2 = md.serializeTrip(t2, S);
ok("escribir → leer → escribir es estable", out1 === out2);
writeFileSync(join(here, "out", "sample-roundtrip.md"), out1);
ok("se conserva lo que no es de Cool Trip", out1.includes("Notas sueltas que escribe Patt") && out1.includes("## Ideas"));

const b = md.blankTrip("2026 - Roma", "2026-12-01", "2026-12-05", [{ city: "Roma", country: "Italia", nights: 0, travelers: ["Patt"] }], ["Patt"], "bermellón");
const ob = md.serializeTrip(b, S);
ok("viaje nuevo", ob.includes("> Roma · Italia · 4 noches · Patt") && ob.includes("### Mar 1 dic · Roma") && ob.includes("### Sáb 5 dic · Roma"), "\n" + ob);
/* añadidos de la 0.1.2: documentos con varios sitios y viajeros, moneda, alojamiento sin nota, sugerencias ocultas */
const docs = md.parseDocs("DNI (en papel · Wallet · para Ana) · [Billete · Leo](https://x.y/z) (en papel) · Seguro (Mapfre)");
ok("documento con varios sitios", docs[0].name === "DNI" && docs[0].where === "paper" && docs[0].also.join() === "wallet" && docs[0].para.join() === "Ana", JSON.stringify(docs[0]));
ok("documento con enlace y papel", docs[1].name === "Billete · Leo" && docs[1].where === "cloud" && docs[1].url === "https://x.y/z" && docs[1].also.join() === "paper", JSON.stringify(docs[1]));
ok("paréntesis que es parte del nombre", docs[2].name === "Seguro (Mapfre)" && docs[2].where === "cloud", JSON.stringify(docs[2]));
ok("documento: se escribe igual", docs.map(d => md.docMd(d)).join(" · ") === "DNI (en papel · Wallet · para Ana) · [Billete · Leo](https://x.y/z) (en papel) · Seguro (Mapfre)", docs.map(d => md.docMd(d)).join(" · "));
ok("moneda", md.parseItem("- [ ] Cena · [[X]] · $60").price === "$60" && md.parseItem("- [ ] Cena · [[X]] · 45 CHF").price === "45 CHF" && md.parseItem("- [ ] Cena · [[X]] · 30.98").price === "30.98");
ok("precio con moneda", md.withCurrency("640", "¥") === "¥640" && md.withCurrency("60", "€") === "60 €" && md.currencyOf("45 CHF") === "CHF" && md.priceNumber("$60") === "60");
const casa = md.parseItem("- **Casa de Ana** · alojamiento");
ok("alojamiento sin nota", casa.kind === "lodging" && casa.title === "Casa de Ana" && !casa.link, JSON.stringify(casa));
const llegada = md.parseItem("- [ ] 22:00 Llegada al alojamiento · Casa de Ana");
ok("llegada a un alojamiento sin nota", llegada.kind === "rest" && llegada.place === "Casa de Ana" && md.itemMd(llegada)[0] === "- [ ] 22:00 Llegada al alojamiento · Casa de Ana", JSON.stringify(llegada));
const t3 = md.parseTrip(sample, "2027 - Japón", S);
t3.hidden.push("Mapas sin conexión de Tokio y Kioto");
const t4 = md.parseTrip(md.serializeTrip(t3, S), "2027 - Japón", S);
ok("sugerencias ocultas", t4.hidden.join() === "Mapas sin conexión de Tokio y Kioto", JSON.stringify(t4.hidden));
const hotel2 = t4.days[1].items[0];
ok("el alojamiento no lleva hora", hotel2.kind === "lodging" && !md.itemMd(hotel2)[0].includes("15:00"), md.itemMd(hotel2)[0]);

/* ajustes en español (sincronizados desde el móvil) y una nota de viaje en inglés */
const enNote = "---\ntype:\n  - trip\nstart: 2026-12-01\nend: 2026-12-03\ndestinations:\n  - Roma\n---\n";
const fmEn = { type: ["trip"], start: "2026-12-01", end: "2026-12-03", destinations: ["Roma"] };
const Ses = prop(md.defaultSettings("es"));
ok("reconoce el viaje del otro idioma", md.recognizes(Ses.trips, "trip", "a.md", fmEn, []) && !md.recognizes(Ses.trips, "trip", "a.md", { type: "lugar" }, []));
const tEn = md.parseTrip(enNote, "2026 - Roma", Ses);
ok("lee las propiedades del otro idioma", tEn.start === "2026-12-01" && tEn.end === "2026-12-03", JSON.stringify([tEn.start, tEn.end]));
const outEn = md.serializeTrip(tEn, Ses);
ok("las escribe con los nombres de la nota", !/inicio|tipo|destinos/.test(outEn) && /start: '?2026-12-01/.test(outEn), outEn.split("\n").slice(0, 8).join(" | "));
const Sad = prop(md.defaultSettings("es"));
ok("se adapta al idioma de las notas", md.adaptToVault(Sad, [{ path: "a.md", fm: fmEn, tags: [] }]) && Sad.trips.key === "type" && Sad.props.start === "start" && Sad.language === "en");
const Sno = prop(md.defaultSettings("es"));
ok("no cambia si ya hay viajes suyos", !md.adaptToVault(Sno, [{ path: "a.md", fm: fmEn, tags: [] }, { path: "b.md", fm: { tipo: "viaje" }, tags: [] }]) && Sno.trips.key === "tipo");

const tOld = md.parseTrip("---\ntype: trip\nstart: 2026-12-01\nend: 2026-12-02\ntravelers:\n  - patt\n---\n## Bag\n- DNI · patt (on paper)\n", "x", Ses);
ok("«DNI · patt» pasa a burbuja", tOld.mochila[0]?.name === "DNI" && tOld.mochila[0].para.join() === "patt", JSON.stringify(tOld.mochila));
/* el presupuesto y el color van en el bloque del viaje; nada de propiedades vacías */
const tB = md.parseTrip("---\ntipo: viaje\ninicio: 2026-12-01\nfin: 2026-12-02\nportada: mostaza\n---\n", "b", S);
tB.budget = 1500;
const outB = md.serializeTrip(tB, S), tB2 = md.parseTrip(outB, "b", S);
ok("presupuesto y color dentro de la nota", !/portada|presupuesto:|viajeros/.test(outB.split("> [!")[0]) && /\[!cool-trip\|mostaza\]/.test(outB) && tB2.budget === 1500 && tB2.cover === "mostaza", outB.split("\n").slice(0, 9).join(" | "));
/* respeta la forma de tus propiedades: una lista como texto, [[enlaces]] y fechas con hora */
const tK = md.parseTrip("---\ntipo: viaje\ninicio: 2026-12-01T10:00\nfin: 2026-12-03\ndestinos: Roma, Nápoles\nviajeros:\n  - \"[[Ana]]\"\n---\n", "k", S);
const outK = md.serializeTrip(tK, S);
ok("respeta la forma de tus propiedades", /inicio: 2026-12-01T10:00/.test(outK) && /destinos: Roma, Nápoles/.test(outK) && /\[\[Ana\]\]/.test(outK), outK.split("\n").slice(0, 8).join(" | "));
/* la ficha de un lugar: las secciones van en el cuerpo y las propiedades no se tocan */
const pl = md.parsePlace("---\ncategoría: Izakaya\nprecio: \"€€\"\n---\n\nMis notas.\n\n## Carta\n- Yakitori · 220 ¥\n\n## Lo mío\nalgo\n");
md.setSection(pl, "hours", ["- Lunes: cerrado"], "es");
md.setSection(pl, "menu", ["- Yakitori · 220 ¥", "- Motsuni · 600 ¥"], "es");
md.setSection(pl, "daily", [], "es", true);
const plOut = md.serializePlace(pl);
ok("ficha de lugar: secciones en el cuerpo, propiedades intactas", plOut.startsWith("---\ncategoría: Izakaya\nprecio: \"€€\"\n---\n") && /Mis notas\./.test(plOut) && /## Lo mío\nalgo/.test(plOut)
  && /## Horario\n- Lunes: cerrado/.test(plOut) && md.linesOf(md.parsePlace(plOut), "menu").length === 2 && /## Menú del día\n/.test(plOut), plOut);
md.setSection(pl, "hours", [], "es");
ok("ficha de lugar: una sección vacía se quita", !/Horario/.test(md.serializePlace(pl)));
/* varios tipos: icono y color del primero; secciones de todos, sin repetir la «Carta» */
ok("varios tipos", md.placeTypes("Bar, Restaurante").join(" ") === "bar restaurant" && md.iconFor("Restaurante, bar") === "utensils", md.placeTypes("Bar, Restaurante").join(" "));
{ const k = md.secsFor(["bar", "restaurant"]);
  ok("secciones de bar y restaurante", k.filter(x => x === "menu" || x === "drinks").length === 1 && k.includes("cuisine") && k.includes("book") && k[k.length - 1] === "access", k.join(" ")); }
/* el horario: turnos, cerrado y lo que no son horas */
{ const cw = ["cerrado", "closed"];
  const d = md.readDay("13:00–16:00, 20:00-23:30", cw);
  ok("horario con dos turnos", d.shifts.length === 2 && md.writeDay(d, "cerrado") === "13:00–16:00, 20:00–23:30", md.writeDay(d, "cerrado"));
  ok("horario cerrado", md.readDay("Cerrado", cw).closed && md.writeDay(md.readDay("Cerrado", cw), "cerrado") === "cerrado");
  ok("horario de 9 a 22", md.writeDay(md.readDay("9:00–22:00", cw), "cerrado") === "9:00–22:00");
  ok("horario que no son horas se queda", md.readDay("24 h", cw).raw === "24 h" && md.writeDay(md.readDay("24 h", cw), "cerrado") === "24 h"); }
ok("gratis", ["free", "Gratis", "0 €", "0"].every(md.isFree) && !md.isFree("10 €"));
ok("tipos de lugar", ["Izakaya", "Teatro Real", "Sala de conciertos", "Ramen", "Olive bar"].map(md.placeType).join(" ") === "bar theatre music restaurant bar", ["Izakaya", "Teatro Real", "Sala de conciertos", "Ramen", "Olive bar"].map(md.placeType).join(" "));
/* las propiedades que no cambian se quedan como estaban escritas (formato, comillas, comentarios) */
const rawFm = "---\ntipo: viaje\ninicio: 2026-12-01\nfin: 2026-12-03\ndestinos: [Roma]\nmio: 'algo'  # un comentario\n---\n";
const tR = md.parseTrip(rawFm, "r", S);
ok("propiedades intactas si no cambian", md.serializeTrip(tR, S).startsWith(rawFm.trimEnd()), md.serializeTrip(tR, S).split("\n").slice(0, 7).join(" | "));
ok("precio siempre con moneda", md.showPrice("6.99", "€") === "6.99 €" && md.showPrice("$5", "€") === "$5" && md.showPrice("", "€") === "");

/* ---------- las bases (src/bases.ts): cada fórmula se lee y da lo del canvas ---------- */
{
  const { evaluate } = await import("./bases-eval.mjs");
  const X = await import("./bases-sample.mjs");
  const yaml = (await import("js-yaml")).default;
  md.setLocaleForTests("es");
  const env = { cool: true, maps: true, iconSvg: () => "<path d='M0 0'/>" };
  /* lo que se escribe en el .base y se vuelve a leer (las comillas de las fórmulas sobreviven al YAML) */
  const round = o => yaml.load(yaml.dump(o, { lineWidth: -1 }));
  const tb = round(md.tripsBase(S, env)), pb = round(md.placesBase(S, env, ["Tokio", "Kioto"]));
  const run = (doc, n, k) => evaluate(doc.formulas[k], { fm: n.fm, file: n, formulas: doc.formulas, today: X.TODAY, notes: X.NOTES, backlinks: X.backlinks, _cache: (n._c ||= {})[doc === tb ? "t" : "p"] ||= {} });
  const all = (doc, notes) => { const bad = []; for (const n of notes) for (const k of Object.keys(doc.formulas)) { try { run(doc, n, k); } catch (e) { bad.push(`${n.basename} · ${k}: ${e.message}`); } } return bad; };
  const tbad = all(tb, X.TRIPS), pbad = all(pb, X.PLACES);
  ok("fórmulas de viajes: todas se leen", !tbad.length, tbad.slice(0, 3).join(" | "));
  ok("fórmulas de lugares: todas se leen", !pbad.length, pbad.slice(0, 3).join(" | "));
  const T = name => X.TRIPS.find(x => x.basename === name), F = (name, k) => run(tb, T(name), k);
  ok("cuándo", ["2026 - Alemania", "2026 - Portugal", "2026 - Italia y Grecia", "2025 - México", "2025 - Islandia", "2024 - Marruecos"].map(n => F(n, "when")).join(" / ")
    === "Día 4 de 7 / Faltan 38 días / Hace 4 meses / Hace 1 año / Hace 1 año / Hace 2 años", ["2026 - Alemania", "2026 - Portugal", "2026 - Italia y Grecia", "2025 - México", "2025 - Islandia", "2024 - Marruecos"].map(n => F(n, "when")).join(" / "));
  ok("pastilla", [F("2026 - Alemania", "pill"), F("2026 - Portugal", "pill"), F("2026 - Italia y Grecia", "pill")].join(" / ") === "En curso / En 38 días / Hace 4 meses");
  ok("matriz", [F("2027 - Reino Unido", "stubN"), F("2027 - Reino Unido", "stubUnit"), F("2026 - Italia y Grecia", "stubTop"), F("2026 - Italia y Grecia", "stubN"), F("2026 - Italia y Grecia", "stubUnit"), F("2026 - Alemania", "stubNow")].join(" ")
    === "289 días Hace 4 meses En curso");
  ok("días, noches, título y ruta", [F("2026 - Alemania", "daysLabel"), F("2026 - Alemania", "nightsLabel"), F("2026 - Italia y Grecia", "title"), F("2026 - Portugal", "route")].join(" | ")
    === "7 días | 6 noches | Italia y Grecia | Lisboa → Oporto", [F("2026 - Alemania", "daysLabel"), F("2026 - Alemania", "nightsLabel"), F("2026 - Italia y Grecia", "title"), F("2026 - Portugal", "route")].join(" | "));
  ok("fechas", [F("2026 - Alemania", "dates"), F("2026 - Portugal", "datesNights"), F("2027 - Japón", "yearRoute")].join(" | ") === "24 – 30 oct | 4 – 9 dic 2026 · 5 noches | 2027 · Tokio → Kioto",
    [F("2026 - Alemania", "dates"), F("2026 - Portugal", "datesNights"), F("2027 - Japón", "yearRoute")].join(" | "));
  ok("color y portada", [F("2027 - Japón", "color"), F("2026 - Portugal", "cover"), F("2027 - Reino Unido", "photo"), F("2026 - Portugal", "photo")].join(" ") === "#E8613C #C2B3F5 [[highlands.jpg]] ");
  const Pl = name => X.PLACES.find(x => x.basename === name), G = (name, k) => run(pb, Pl(name), k);
  ok("lugares: icono, color y familia", [G("Senso-ji", "icon"), G("Senso-ji", "color"), G("Omoide Yokocho", "family"), G("Shibuya Crossing", "family")].join(" ") === "church #C2B3F5 Comer Pasear");
  ok("lugares: categoría y precio, estrellas, viajes", [G("Senso-ji", "catPrice"), G("Da Enzo al 29", "stars"), G("Senso-ji", "tripNames"), G("Pastéis de Belém", "cityCountry")].join(" | ")
    === "Templo · Gratis | ★★★★☆ | 2027 - Japón | Lisboa · Portugal", [G("Senso-ji", "catPrice"), G("Da Enzo al 29", "stars"), G("Senso-ji", "tripNames"), G("Pastéis de Belém", "cityCountry")].join(" | "));
  ok("lugares: la foto o el icono", String(G("Senso-ji", "photo")) === "[[senso-ji.jpg]]" && String(G("Meiji Jingu", "photo")).startsWith("data:image/svg+xml"));
  ok("vistas de viajes", tb.views.map(v => v.type + ":" + v.name).join(", ") === "cool-bases:Próximos, cool-bases:Viajados, table:Todos");
  ok("vistas de lugares", pb.views.map(v => v.type + ":" + v.name).join(", ") === "cool-bases:Guía por ciudad, map:Mapa, cool-bases:Tokio, cool-bases:Kioto");
  const nat = round(md.tripsBase(S, { ...env, cool: false, maps: false }));
  ok("sin Cool Bases ni Maps", nat.views.map(v => v.type).join() === "cards,cards,table" && nat.views[0].image === "formula.cover");
  /* lo que se vuelve a tocar: el bloque de colores (y solo ese) y las ciudades nuevas */
  const doc = round(md.tripsBase(S, env));
  doc.views[0].coolbases.css = "/* mío */\n" + doc.views[0].coolbases.css;
  const ch = md.syncBase(doc, "trips", S, env, { colors: md.tripColorsCss([{ path: "Viajes/2026 - Portugal.md", color: "#C2B3F5" }]) });
  ok("colores de los billetes", ch && doc.views[0].coolbases.css.startsWith("/* mío */") && doc.views[0].coolbases.css.includes('[data-path="Viajes/2026 - Portugal.md"] { --ct: #C2B3F5; }'));
  ok("colores: sin cambios, no reescribe", !md.syncBase(doc, "trips", S, env, { colors: md.tripColorsCss([{ path: "Viajes/2026 - Portugal.md", color: "#C2B3F5" }]) }));
  const pdoc = round(md.placesBase(S, env, ["Tokio"]));
  ok("ciudad nueva", md.syncBase(pdoc, "places", S, env, { newCities: ["Tokio", "Lisboa"] }) && pdoc.views.filter(v => v.name === "Tokio").length === 1 && pdoc.views.at(-1).name === "Lisboa");
  const ndoc = round(md.placesBase(S, { ...env, cool: false, maps: false }, ["Tokio"]));
  const S2 = { ...S, baseCities: ["tokio"] };
  ok("pasar a Cool Bases y añadir el mapa", md.syncBase(ndoc, "places", S2, env, { useCool: true, addMap: true }) && ndoc.views.map(v => v.type).join() === "cool-bases,map,cool-bases");
  /* el filtro reconoce las notas en los dos idiomas y sin mayúsculas, como Cool Trip */
  const fl = md.recogFilter(S.places, "place"), hit = fm => !!evaluate(fl, { fm, file: { path: "x.md", basename: "x", fm }, formulas: {}, today: X.TODAY, notes: [], backlinks: () => [] });
  ok("filtro de lugares", hit({ tipo: "lugar" }) && hit({ tipo: "Lugar" }) && hit({ type: "place" }) && !hit({ tipo: "viaje" }) && !hit({}), fl);
  ok("viajes de un lugar en inglés", run(pb, { ...X.PLACES[0], _c: {} }, "tripNames") === "2027 - Japón");
}

console.log(fails ? `\n${fails} fallos` : "\nTodo bien");
process.exit(fails ? 1 : 0);
