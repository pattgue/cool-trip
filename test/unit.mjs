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
const S = md.defaultSettings("es");
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

console.log(fails ? `\n${fails} fallos` : "\nTodo bien");
process.exit(fails ? 1 : 0);
