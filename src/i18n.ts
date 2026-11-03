/* Textos de Cool Trip en español e inglés (el idioma de Obsidian). El Markdown de la nota se escribe en ese idioma
   y se lee en los dos. */
import { getLanguage, moment } from "obsidian";
import { es } from "./i18n/es";
import { en } from "./i18n/en";

let lang: "es" | "en" | null = null;
export function locale(): "es" | "en" {
  if (lang) return lang;
  let l = "";
  try { l = getLanguage(); } catch { /* Obsidian anterior a 1.8.7 */ }
  if (!l) try { l = moment.locale(); } catch { /* sin moment */ }
  return lang = /^es/i.test(String(l || "")) ? "es" : "en";
}
export function setLocaleForTests(l: "es" | "en") { lang = l; }


export function t(key: string, vars?: Record<string, string | number>): string {
  let s = (locale() === "es" ? es : en)[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split("{" + k + "}").join(String(v));
  return s;
}

/* el vocabulario del Markdown: se escribe en el idioma de Obsidian y se lee en los dos */
export const MD = {
  es: { bag: "Mochila", pack: "Maleta", todo: "Por hacer", plan: "Plan", nights: "noches", night: "noche", budget: "Presupuesto", paper: "en papel", for: "para", unpaid: "por pagar",
    lodging: "alojamiento", ticket: "entrada", included: "incluido", home: "en casa", cloud: "nube", device: "dispositivo", hidden: "ocultas",
    kinds: { flight: "Vuelo", train: "Tren", bus: "Bus", car: "Coche", boat: "Barco" },
    meals: { breakfast: "Desayuno", lunch: "Comida", dinner: "Cena", snack: "Picar algo" },
    keys: { depart: "Sale", arrive: "Llega", code: "Número", car: "Coche", seats: "Asientos", luggage: "Equipaje", checkin: "Check-in",
      checkout: "Check-out", room: "Habitación", beds: "Camas", bath: "Baño", includes: "Incluye", tickets: "Entradas", docs: "Documentos", note: "Nota",
      booking: "Reserva", cabin: "Camarote", driver: "Conductor", company: "Compañía", mode: "Modalidad", type: "Tipo", address: "Dirección", keys: "Llaves",
      pitch: "Parcela" } },
  en: { bag: "Bag", pack: "Packing", todo: "To do", plan: "Plan", nights: "nights", night: "night", budget: "Budget", paper: "on paper", for: "for", unpaid: "unpaid",
    lodging: "lodging", ticket: "ticket", included: "included", home: "at home", cloud: "cloud", device: "device", hidden: "hidden",
    kinds: { flight: "Flight", train: "Train", bus: "Bus", car: "Car", boat: "Boat" },
    meals: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" },
    keys: { depart: "Departs", arrive: "Arrives", code: "Number", car: "Coach", seats: "Seats", luggage: "Luggage", checkin: "Check-in",
      checkout: "Check-out", room: "Room", beds: "Beds", bath: "Bathroom", includes: "Includes", tickets: "Tickets", docs: "Documents", note: "Note",
      booking: "Booking", cabin: "Cabin", driver: "Driver", company: "Company", mode: "Mode", type: "Type", address: "Address", keys: "Keys",
      pitch: "Pitch" } },
};
export type Vocab = typeof MD.es;
export const vocab = (): Vocab => MD[locale()];
