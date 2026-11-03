/* Las secciones de la ficha de cada tipo de lugar y su formato (la rúbrica de Patt: docs/lugares.md).
   Cada sección es un «## Título» en el cuerpo de la nota; su formato dice cómo se rellena y cómo se escribe:
   filas «- a · b · c», horario «- Lunes: 9:00–22:00», etiquetas y listas «- x», datos «- Campo: valor»,
   lista para llevar «- [ ] x», lugares «- [[Nota]]», y texto o post-it tal cual. */
import type { PlaceType } from "./places";

export type Fmt = "rows" | "hours" | "tags" | "specs" | "pack" | "links" | "list" | "text" | "postit";
type L = [string, string];                     // [español, inglés]
export interface SecDef {
  title: L; icon: string; fmt: Fmt;
  cols?: L[];                                  // filas: sus columnas
  fields?: L[];                                // datos: sus campos
  tags?: L[];                                  // etiquetas: las sugeridas
  hint?: L;                                    // lo que se ve cuando está vacía
  optional?: boolean;                          // solo sale si se marca (menú del día)
}

const PRICE: L = ["Precio", "Price"];
const ACCESS: L[] = [["Sin escalones", "Step-free"], ["Ascensor", "Lift"], ["Baño adaptado", "Accessible toilet"], ["Bucle magnético", "Hearing loop"],
  ["Lengua de signos", "Sign language"], ["Subtítulos", "Subtitles"], ["Zona tranquila", "Quiet area"], ["Perros de asistencia", "Assistance dogs"]];

export const SECS = {
  cuisine: { title: ["Cocina", "Cuisine"], icon: "chef-hat", fmt: "text", hint: ["Qué tipo de cocina y sus especialidades…", "The kind of food and its specialities…"] },
  menu: { title: ["Carta", "Menu"], icon: "scroll-text", fmt: "rows", cols: [["Plato", "Dish"], PRICE, ["Nota", "Note"]], hint: ["Los platos, con su precio…", "Dishes and their price…"] },
  drinks: { title: ["Carta", "Menu"], icon: "scroll-text", fmt: "rows", cols: [["Bebida o plato", "Drink or dish"], PRICE, ["Nota", "Note"]], hint: ["Lo que se bebe y se pica, con su precio…", "Drinks and bites, with their price…"] },
  daily: { title: ["Menú del día", "Set menu"], icon: "utensils", fmt: "rows", cols: [["Qué incluye", "What's included"], PRICE], optional: true, hint: ["Qué incluye y cuánto cuesta…", "What's included and what it costs…"] },
  book: { title: ["Reservar", "Booking"], icon: "calendar-check", fmt: "text", hint: ["Si hay que reservar, cómo y con cuánta antelación…", "Whether to book, how and how far ahead…"] },
  hours: { title: ["Horario", "Opening hours"], icon: "clock", fmt: "hours" },
  access: { title: ["Accesibilidad", "Accessibility"], icon: "accessibility", fmt: "tags", tags: ACCESS },
  topCafe: { title: ["Top", "Highlights"], icon: "sparkles", fmt: "tags", tags: [["Terraza", "Terrace"], ["Para trabajar", "Good for work"], ["Enchufes", "Plugs"], ["Wifi", "Wi-Fi"], ["Tranquilo", "Quiet"], ["Vistas", "Views"]] },
  topBar: { title: ["Top", "Highlights"], icon: "sparkles", fmt: "tags", tags: [["Terraza", "Terrace"], ["Ambiente", "Atmosphere"], ["Música en directo", "Live music"], ["Vistas", "Views"], ["Para grupos", "Good for groups"], ["Hasta tarde", "Open late"]] },
  topList: { title: ["Top", "Highlights"], icon: "sparkles", fmt: "list", hint: ["Lo imprescindible…", "The must-sees…"] },
  topLinks: { title: ["Top", "Highlights"], icon: "sparkles", fmt: "links", hint: ["Los sitios que hay aquí o cerca…", "The places here or nearby…"] },
  music: { title: ["Música", "Music"], icon: "disc-3", fmt: "text", hint: ["Estilos, sesiones, quién pincha…", "Styles, nights, who plays…"] },
  doorRules: { title: ["Entrada y normas", "Entry and rules"], icon: "door-open", fmt: "specs", fields: [PRICE, ["Dress code", "Dress code"], ["Edad", "Age"]] },
  stalls: { title: ["Puestos", "Stalls"], icon: "store", fmt: "rows", cols: [["Puesto", "Stall"], ["Qué tiene", "What it has"]], hint: ["Los puestos favoritos y qué tienen…", "Favourite stalls and what they have…"] },
  items: { title: ["Artículos", "What to find"], icon: "shopping-bag", fmt: "text", hint: ["Qué se encuentra aquí…", "What you can find here…"] },
  tickets: { title: ["Entradas", "Tickets"], icon: "ticket", fmt: "rows", cols: [["Tipo", "Type"], PRICE, ["Qué incluye", "What's included"]], hint: ["Cada tipo de entrada, su precio y qué incluye…", "Each ticket, its price and what's included…"] },
  ticketsLive: { title: ["Entradas", "Tickets"], icon: "ticket", fmt: "rows", cols: [["Tipo", "Type"], ["Precio orientativo", "Usual price"], ["Dónde", "Where"]], hint: ["Orientativo: suele cambiar según el evento…", "A rough guide: it changes with each event…"] },
  exhibits: { title: ["Exposiciones y actividades", "Exhibitions and activities"], icon: "frame", fmt: "rows", cols: [["Nombre", "Name"], ["Cuándo", "When"], ["Nota", "Note"]], hint: ["Las permanentes o las que se repiten…", "Permanent or recurring ones…"] },
  events: { title: ["Eventos", "Events"], icon: "calendar-days", fmt: "rows", cols: [["Qué", "What"], ["Cuándo", "When"], PRICE], hint: ["Los que se repiten (cada jueves, cada temporada…)…", "Recurring ones (every Thursday, every season…)…"] },
  programme: { title: ["Qué se programa", "What's on"], icon: "music", fmt: "text", hint: ["Los estilos de música que suele tener…", "The music it usually has…"] },
  capacity: { title: ["Aforo", "Capacity"], icon: "users", fmt: "specs", fields: [["Aforo", "Capacity"]] },
  specialty: { title: ["Especialización", "Speciality"], icon: "bookmark", fmt: "text", hint: ["En qué está especializada…", "What it specialises in…"] },
  entry: { title: ["Entrada", "Entry"], icon: "ticket", fmt: "text", hint: ["Precio o donativo…", "Price or donation…"] },
  rules: { title: ["Normas", "Rules"], icon: "info", fmt: "text", hint: ["Ropa, calzado, fotos…", "Clothing, shoes, photos…"] },
  ceremonies: { title: ["Ceremonias", "Ceremonies"], icon: "bell", fmt: "rows", cols: [["Qué", "What"], ["Cuándo", "When"]], hint: ["Las ceremonias y cuándo son…", "Ceremonies and when they are…"] },
  tours: { title: ["Visitas guiadas", "Guided tours"], icon: "flag", fmt: "rows", cols: [["Hora", "Time"], ["Idioma", "Language"], PRICE], hint: ["Las visitas, en qué idioma y cuánto cuestan…", "Tours, their language and price…"] },
  history: { title: ["Historia en breve", "History"], icon: "scroll", fmt: "text", hint: ["Lo que conviene saber de su historia…", "What's worth knowing about its history…"] },
  bestTime: { title: ["Mejor momento", "Best time"], icon: "sun", fmt: "text", hint: ["A qué hora o en qué época…", "What time or season…"] },
  bring: { title: ["Qué llevar", "What to bring"], icon: "backpack", fmt: "pack" },
  services: { title: ["Servicios", "Facilities"], icon: "umbrella", fmt: "tags", tags: [["Duchas", "Showers"], ["Sombra", "Shade"], ["Socorrista", "Lifeguard"], ["Baños", "Toilets"], ["Chiringuito", "Beach bar"], ["Hamacas", "Sunbeds"]] },
  routes: { title: ["Rutas", "Routes"], icon: "route", fmt: "rows", cols: [["Ruta", "Route"], ["Distancia", "Distance"], ["Desnivel", "Elevation"], ["Duración", "Time"], ["Dificultad", "Difficulty"]] },
  stay: { title: ["Check-in / Check-out", "Check-in / Check-out"], icon: "key-round", fmt: "specs", fields: [["Check-in", "Check-in"], ["Check-out", "Check-out"], ["Llaves", "Keys"]] },
  rooms: { title: ["Habitaciones", "Rooms"], icon: "bed-double", fmt: "text", hint: ["Cómo son las habitaciones…", "What the rooms are like…"] },
  contact: { title: ["Contacto", "Contact"], icon: "phone", fmt: "specs", fields: [["Teléfono", "Phone"], ["Web", "Web"], ["Email", "Email"]] },
  extras: { title: ["Facilidades y extras", "Amenities"], icon: "sparkles", fmt: "tags", tags: [["Wifi", "Wi-Fi"], ["Desayuno", "Breakfast"], ["Cocina", "Kitchen"], ["Lavadora", "Washer"], ["Aire acondicionado", "Air con"], ["Parking", "Parking"], ["Recepción 24 h", "24h reception"]] },
  houseRules: { title: ["Horarios y reglas", "House rules"], icon: "list-checks", fmt: "text", hint: ["Horas de silencio, visitas, mascotas…", "Quiet hours, visitors, pets…"] },
  tips: { title: ["Datos útiles", "Good to know"], icon: "sticky-note", fmt: "postit", hint: ["Para apuntar cosas sueltas…", "For loose notes…"] },
} satisfies Record<string, SecDef>;
export type SecKey = keyof typeof SECS;

/* las secciones de cada tipo, en orden («Datos útiles» va siempre al final) */
export const TYPE_SECS: Record<PlaceType, SecKey[]> = {
  temple: ["entry", "rules", "ceremonies", "hours", "access"],
  museum: ["tickets", "exhibits", "hours", "access"],
  books: ["specialty", "events", "hours", "access"],
  theatre: ["programme", "ticketsLive", "hours", "capacity", "access"],
  music: ["programme", "ticketsLive", "hours", "capacity", "access"],
  cinema: ["tickets", "hours", "access"],
  club: ["music", "doorRules", "hours", "access"],
  bar: ["drinks", "topBar", "hours", "access"],
  restaurant: ["cuisine", "menu", "daily", "book", "hours", "access"],
  cafe: ["menu", "topCafe", "hours", "access"],
  market: ["stalls", "hours", "access"],
  shop: ["items", "hours", "access"],
  viewpoint: ["bestTime", "tickets", "hours", "access"],
  park: ["bestTime", "topList", "hours", "access"],
  water: ["bestTime", "bring", "services", "hours", "access"],
  mountain: ["routes", "bring", "bestTime", "hours", "access"],
  castle: ["tickets", "topList", "tours", "hours", "access"],
  monument: ["history", "tickets", "hours", "access"],
  zoo: ["tickets", "hours", "access"],
  stadium: ["events", "tickets", "hours", "access"],
  spa: ["tickets", "rules", "hours", "access"],
  street: ["topLinks", "bestTime", "access"],
  lodging: ["stay", "rooms", "contact", "extras", "houseRules", "access"],
  other: ["hours"],
};
/* lo que cambia según el tipo dentro de una misma sección */
export const HINTS: Partial<Record<PlaceType, Partial<Record<SecKey, L>>>> = {
  theatre: { programme: ["El tipo de espectáculos que suele tener…", "The kind of shows it usually has…"] },
  spa: { rules: ["Tatuajes, toalla, bañador…", "Tattoos, towel, swimwear…"] },
};
/* el nombre de cada tipo (para elegir la categoría) */
export const TYPE_NAMES: Record<Exclude<PlaceType, "other">, L> = {
  temple: ["Templo", "Temple"], museum: ["Museo", "Museum"], books: ["Librería", "Bookshop"], theatre: ["Teatro", "Theatre"],
  music: ["Sala de conciertos", "Music venue"], cinema: ["Cine", "Cinema"], club: ["Discoteca", "Club"], bar: ["Bar", "Bar"],
  restaurant: ["Restaurante", "Restaurant"], cafe: ["Café", "Café"], market: ["Mercado", "Market"], shop: ["Tienda", "Shop"],
  viewpoint: ["Mirador", "Viewpoint"], park: ["Parque", "Park"], water: ["Playa", "Beach"], mountain: ["Montaña", "Mountain"],
  castle: ["Castillo", "Castle"], monument: ["Monumento", "Monument"], zoo: ["Zoo", "Zoo"], stadium: ["Estadio", "Stadium"],
  spa: ["Spa", "Spa"], street: ["Barrio", "Neighbourhood"], lodging: ["Hotel", "Hotel"],
};
/* el precio de la cabecera: medio en los de comer y beber; la entrada en los que llevan entradas */
export const PRICE_KIND = (type: PlaceType): "avg" | "ticket" | "" =>
  ["restaurant", "cafe", "bar", "market", "club"].includes(type) ? "avg"
    : ["museum", "theatre", "music", "cinema", "castle", "monument", "zoo", "stadium", "spa", "viewpoint", "temple"].includes(type) ? "ticket" : "";
/* los días de la semana, en el orden del horario */
export const DAYS: L[] = [["Lunes", "Monday"], ["Martes", "Tuesday"], ["Miércoles", "Wednesday"], ["Jueves", "Thursday"], ["Viernes", "Friday"], ["Sábado", "Saturday"], ["Domingo", "Sunday"]];
export const CLOSED: L = ["cerrado", "closed"];
