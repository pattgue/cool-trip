// Cool Trip: tipos de nota y su frontmatter.
// Equivale al "schema.sql" de /replica-architect. Pasará tal cual a src/model/types.ts.
// Convenciones:
//   - Fechas de viaje: "AAAA-MM-DD". Horas: hora local "AAAA-MM-DDTHH:MM" + zona IANA.
//   - Enlaces: wikilinks "[[Nota]]" tal y como los escribe Obsidian en el frontmatter.
//   - Dinero: entero en céntimos + moneda ISO 4217.
//   - Todo es opcional salvo `type` y lo marcado como obligatorio: el plugin avisa, no bloquea.

export type WikiLink = string; // "[[Galleria Borghese]]" o "[[DNI Patt.pdf]]"
export type IsoDate = string; // "2026-11-29"
export type LocalDateTime = string; // "2026-11-28T07:15" (sin zona; la zona va en su campo)
export type IanaZone = string; // "Europe/Rome"
export type LatLng = [number, number]; // mismo formato que Map View

export const NOTE_TYPES = ["trip", "place", "stay", "transport", "ticket", "expense"] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const TRIP_STATUS = ["idea", "planning", "booked", "ongoing", "done"] as const;
export const BOOKING_STATUS = ["idea", "pending", "confirmed", "checked-in", "cancelled"] as const;
export const PLACE_STATUS = ["todo", "done"] as const;

// Tripsy separa avión, tren, coche/roadtrip, ferry, a pie, metro y transfer (3.9).
export const TRANSPORT_MODES = [
  "flight", "train", "bus", "car", "transfer", "taxi", "metro", "ferry", "walk",
] as const;

// Tramos dentro de un día (lista Markdown). Emoji y palabra aceptados por el parser.
export const LEG_MODES = {
  walk: ["🚶", "a pie"],
  metro: ["🚇", "metro"],
  bus: ["🚌", "bus"],
  train: ["🚆", "tren"],
  taxi: ["🚕", "taxi"],
  ferry: ["⛴", "ferry"],
} as const;

export const PRICE_LEVELS = ["$", "$$", "$$$", "$$$$"] as const;

interface BaseNote {
  type: NoteType;
  title?: string; // por defecto, el nombre del archivo
  tags?: string[];
}

export interface Trip extends BaseNote {
  type: "trip";
  start?: IsoDate; // sin start/end = viaje sin fechas (Tripsy: has_dates)
  end?: IsoDate;
  timezone?: IanaZone; // zona por defecto para todo lo que no la indique
  cover?: WikiLink | string; // imagen local preferida (offline)
  travelers?: string[];
  destinations?: WikiLink[];
  status?: (typeof TRIP_STATUS)[number];
  essentials?: WikiLink[]; // barra "a un toque": DNI, seguro, tarjetas de embarque
  offline_maps?: string[]; // ciudades ya descargadas en la app de mapas (paso "Mapas sin conexión")
  currency?: string; // "EUR"
  budget_cents?: number;
  albo_collections?: string[];
  day_colors?: Record<IsoDate, string>; // opcional; si no, paleta automática
  // Cuerpo de la nota: "## AAAA-MM-DD · etiqueta" + lista = días (ver Day).
  // "## Equipaje" con tareas = checklist de equipaje (tile 55/78).
}

export interface Place extends BaseNote {
  type: "place";
  city?: WikiLink;
  category?: string; // etiqueta libre (Albo: "Art museum", "Roman restaurant")
  emoji?: string;
  rating?: number; // 0-5
  price?: (typeof PRICE_LEVELS)[number];
  location?: LatLng; // sin location: sale en el timeline, no en el mapa
  address?: string;
  cover?: WikiLink | string;
  albo?: string; // "albo://extract/<id>": clave de idempotencia al importar
  needs_booking?: boolean;
  status?: (typeof PLACE_STATUS)[number];
  url?: string;
}

interface BookingBase extends BaseNote {
  trip: WikiLink; // obligatorio
  code?: string; // localizador (Tripsy: provider_reservation_code); clave de idempotencia con type
  docs?: WikiLink[]; // PDF, imágenes o links de esta reserva
  links?: string[]; // check-in online, web del proveedor
  status?: (typeof BOOKING_STATUS)[number];
}

export interface Stay extends BookingBase {
  type: "stay";
  place?: WikiLink; // si el alojamiento también es una nota de lugar
  check_in: LocalDateTime;
  check_out: LocalDateTime;
  timezone?: IanaZone;
  address?: string;
  location?: LatLng;
}

export interface Transport extends BookingBase {
  type: "transport";
  mode: (typeof TRANSPORT_MODES)[number];
  from: string; // IATA en vuelos ("MAD"), estación o ciudad en el resto
  to: string;
  from_name?: string; // "Madrid" para la tarjeta de embarque
  to_name?: string;
  depart: LocalDateTime;
  depart_tz?: IanaZone; // cada extremo con su zona (Tripsy)
  arrive?: LocalDateTime;
  arrive_tz?: IanaZone;
  from_location?: LatLng;
  to_location?: LatLng;
  number?: string; // número de vuelo o tren (Tripsy: transport_number)
  carrier?: string;
  // Campos de la tarjeta de embarque (referencia de diseño 1):
  class?: string;
  seat?: string;
  terminal?: string;
  gate?: string;
  boarding?: LocalDateTime;
  passengers?: string[];
}

export interface Ticket extends BookingBase {
  type: "ticket";
  place?: WikiLink;
  start: LocalDateTime;
  end?: LocalDateTime;
  timezone?: IanaZone;
}

export interface Expense extends BaseNote {
  type: "expense";
  trip: WikiLink;
  amount_cents: number;
  currency: string;
  category?: string;
  parent?: WikiLink; // reserva o lugar
  date?: IsoDate;
}

export type Note = Trip | Place | Stay | Transport | Ticket | Expense;

// ---- Días (parseados del cuerpo de la nota del viaje, no son notas) ----

export interface Day {
  date: IsoDate; // del encabezado "## 2026-11-29 · Roma clásica"
  label?: string;
  color?: string;
  line: number; // línea del encabezado, para editar con precisión
  items: DayItem[];
}

export type DayItem = Stop | Leg | BookingRef;

export interface Stop {
  kind: "stop";
  place?: WikiLink; // o texto libre si no hay enlace
  text?: string;
  time?: string; // "09:00"
  done?: boolean; // "- [x]"
  ticket?: WikiLink; // "🎟 [[Entrada Borghese]]"
  note?: string; // lo que va tras "·"
  line: number;
}

export interface Leg {
  kind: "leg";
  mode: keyof typeof LEG_MODES;
  minutes?: number; // explícito en la lista
  estimated?: boolean; // calculado por el plugin (aprox.)
  line?: number; // ausente si es calculado
}

// Reservas intercaladas automáticamente por hora (no se escriben en la lista).
export interface BookingRef {
  kind: "booking";
  note: WikiLink;
  type: "stay" | "transport" | "ticket";
  at: LocalDateTime;
  zone: IanaZone;
}

// ---- Invariantes (comando "Validar viaje"; avisos, no errores) ----
export const INVARIANTS = [
  "transport.arrive > transport.depart en tiempo absoluto (cada uno en su zona)",
  "stay.check_out > stay.check_in; las estancias de un viaje no se solapan",
  "los encabezados de día caen entre trip.start y trip.end y no se repiten",
  "place sin location: aviso 'no sale en el mapa'",
  "zonas IANA válidas; sin zona se usa trip.timezone",
  "booking.trip apunta a una nota de type trip",
] as const;
