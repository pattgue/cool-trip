// Los viajes y lugares de ejemplo del canvas (design/bases/gen.py), como notas de Cool Trip, con «hoy» el 27 de octubre de 2026.
export const TODAY = "2026-10-27";
const trip = (name, inicio, fin, destinos, viajeros, portada, extra = {}) =>
  ({ path: `Viajes/${name}.md`, basename: name, fm: { tipo: "viaje", inicio, fin, destinos, viajeros, portada, ...extra } });
export const TRIPS = [
  trip("2026 - Alemania", "2026-10-24", "2026-10-30", ["Berlín"], ["Ana"], "cielo", { "ubicación": "52.52, 13.40" }),
  trip("2026 - Portugal", "2026-12-04", "2026-12-09", ["Lisboa", "Oporto"], ["Ana", "Leo"], "lavanda"),
  trip("2027 - Japón", "2027-04-03", "2027-04-14", ["Tokio", "Kioto"], ["Ana", "Leo"], "bermellón"),
  trip("2027 - Reino Unido", "2027-08-12", "2027-08-20", ["Edimburgo", "Highlands"], ["Ana", "Leo", "Marta"], "[[highlands.jpg]]"),
  trip("2026 - Italia y Grecia", "2026-06-12", "2026-06-19", ["Roma", "Palermo", "Atenas"], ["Ana", "Leo"], "mostaza"),
  trip("2025 - México", "2025-11-02", "2025-11-18", ["CDMX", "Oaxaca"], ["Ana", "Leo", "Marta"], "rosa"),
  trip("2025 - Islandia", "2025-02-20", "2025-02-27", ["Reikiavik"], ["Leo"], "cielo"),
  trip("2024 - Marruecos", "2024-10-10", "2024-10-15", ["Marrakech", "Fez"], ["Ana", "Leo"], "pistacho"),
];
/* el acento de las portadas con foto (va en el bloque del viaje, no en el frontmatter) */
export const ACCENT = { "2027 - Reino Unido": "pistacho" };
const place = (name, ciudad, país, categoría, precio, valoración, visitado, trip, extra = {}) =>
  ({ path: `Lugares/${ciudad}/${name}.md`, basename: name, trip, fm: { tipo: "lugar", ciudad, "país": país, "categoría": categoría, precio, ...(valoración ? { "valoración": valoración } : {}), visitado, ...extra } });
export const PLACES = [
  place("Senso-ji", "Tokio", "Japón", "Templo", "Gratis", 0, false, "2027 - Japón", { "ubicación": "35.7148, 139.7967", portada: "[[senso-ji.jpg]]" }),
  place("teamLab Planets", "Tokio", "Japón", "Museo", "€€", 0, false, "2027 - Japón", { "ubicación": "35.6491, 139.7898" }),
  place("Meiji Jingu", "Tokio", "Japón", "Santuario", "Gratis", 0, false, "2027 - Japón"),
  place("Omoide Yokocho", "Tokio", "Japón", "Restaurante", "€€", 0, false, "2027 - Japón"),
  place("Tsukiji Outer Market", "Tokio", "Japón", "Mercado", "€", 0, false, "2027 - Japón"),
  place("Shibuya Crossing", "Tokio", "Japón", "Barrio", "Gratis", 0, false, "2027 - Japón"),
  place("Fushimi Inari", "Kioto", "Japón", "Santuario", "Gratis", 0, false, "2027 - Japón"),
  place("Miradouro da Graça", "Lisboa", "Portugal", "Mirador", "Gratis", 0, false, "2026 - Portugal", { "ubicación": "38.7166, -9.1309" }),
  place("Pastéis de Belém", "Lisboa", "Portugal", "Cafetería", "€", 0, false, "2026 - Portugal"),
  place("Galleria Borghese", "Roma", "Italia", "Museo", "€€", 5, true, "2026 - Italia y Grecia"),
  place("Da Enzo al 29", "Roma", "Italia", "Restaurante", "€€", 4, true, "2026 - Italia y Grecia"),
  place("Mercato di Ballarò", "Palermo", "Italia", "Mercado", "€", 4, true, "2026 - Italia y Grecia"),
];
export const NOTES = [...TRIPS, ...PLACES];
/* las notas que enlazan a otra (los lugares, desde el plan de su viaje) */
export const backlinks = path => { const p = PLACES.find(x => x.path === path); return p ? TRIPS.filter(t => t.basename === p.trip) : []; };
