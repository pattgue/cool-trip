/* Tipos de Cool Trip: los ajustes y el viaje tal como se lee de su nota (ver replica/architecture.md). */
import type { BarSettings } from "./cool-kit/kit";

export type RecogMode = "property" | "tag" | "folder";
export interface Recog { mode: RecogMode; key: string; value: string; folder: string }

export interface PropNames {
  start: string; end: string; destinations: string; travelers: string; cover: string;
  location: string; city: string; country: string; category: string; price: string; rating: string; visited: string;
}

export type MapsApp = "google" | "apple" | "organic";
export interface Settings {
  trips: Recog;
  places: Recog;
  tripFolder: string;          // dónde se guardan los viajes nuevos («» = raíz)
  placeFolder: string;         // dónde se guardan los lugares nuevos (con organización automática, + /Ciudad)
  autoOrganize: boolean;
  props: PropNames;
  files: { cloud: boolean; wallet: boolean; device: boolean; vault: boolean; vaultFolder: string };
  maps: { app: MapsApp; modes: string[] };
  bases: { trips: string; places: string };   // la carpeta de cada base («» = raíz)
  done: number[];              // pasos de los ajustes ya hechos (con «Siguiente»: número en verde)
  countries: Record<string, string>;   // el país de cada ciudad que ya has usado (para ponerlo solo)
  language: "es" | "en";       // el idioma con el que se crearon las sugerencias
  coolBar?: BarSettings;
}

/* ---------- el viaje ---------- */
export type Where = "cloud" | "wallet" | "device" | "vault" | "paper";
/* un documento: dónde está (el primero manda: su enlace o su etiqueta), en qué otros sitios lo llevas y de quién es */
export interface Doc { name: string; where: Where; url: string; also: Where[]; para: string[] }
export interface Task { text: string; done: boolean }
export interface Dest { city: string; country: string; nights: number; travelers: string[] }

export type TransportKind = "flight" | "train" | "bus" | "car" | "boat";
export type Kind = "place" | "meal" | TransportKind | "lodging" | "ticket" | "rest" | "note";
export const TRANSPORT: TransportKind[] = ["flight", "train", "bus", "car", "boat"];
export const isTransport = (k: Kind): k is TransportKind => (TRANSPORT as string[]).includes(k);

/* un paso del plan: una línea «- [ ] 09:00 …» con sus subelementos «- Clave: valor» */
export interface Item {
  kind: Kind;
  check: boolean;              // si la línea lleva casilla
  done: boolean;
  time: string;                // «09:00» o «»
  title: string;               // el nombre del lugar, el título de la reserva, el texto de la nota o la comida
  link: string;                // [[nota]] del lugar (alojamiento, entrada, comida, vuelta…), o «»
  place: string;               // texto del sitio si no es una nota (una comida «en casa», un restaurante sin nota)
  price: string;               // «920 €»
  para: string[];              // para quién es (vacío = todos)
  fields: Field[];             // los subelementos «- Clave: valor · Clave: valor», menos los documentos
  docs: Doc[];
  extra: string[];             // trozos de la línea que no se entienden (se vuelven a escribir)
}

export interface Field { k: string; v: string; line: number }   // k: clave canónica (depart, checkin…) o la etiqueta tal cual
export interface Day { date: string; items: Item[]; raw: string[] }

export interface Trip {
  fm: Record<string, unknown>;
  name: string;                // el nombre de la nota
  start: string;               // AAAA-MM-DD
  end: string;
  dests: Dest[];
  travelers: string[];
  cover: string;               // nombre de la paleta, o ruta / URL de una imagen
  accent: string;              // id de la paleta del viaje (si la portada es una imagen, el último color elegido)
  mochila: Doc[];
  tasks: Task[];
  hidden: string[];            // sugerencias de «Por hacer» que se han quitado (no vuelven a salir)
  days: Day[];                 // uno por fecha, más los que quedaron fuera de las fechas
  intro: string[];             // lo que haya antes de las secciones (se respeta)
  outro: string[];             // secciones que no son de Cool Trip (se respetan)
}
