# Propiedades de Cool Trip

## La regla

Cool Trip no llena tu vault de propiedades:

- **Solo escribe lo que tú rellenas.** Todas las funciones están siempre disponibles, pero una propiedad solo se crea cuando
  rellenas su campo en Cool Trip. Si un viaje no tiene viajeros, su nota no lleva `viajeros:` vacío.
- **Nunca añade una propiedad por su cuenta.** Las únicas excepciones son las coordenadas, que busca solo si lo activas en
  Ajustes › 4, y la marca que reconoce la nota si eliges propiedad o etiqueta en Ajustes › 1. Por carpeta, que es lo que usa
  por defecto, no escribe nada.
- **Usa tus propiedades.** En Ajustes › 2, cada dato propone las propiedades que ya tienes y que son de su mismo tipo (fecha,
  lista, texto…). También puedes dejar la sugerida, elegir otra o no usarlo.
- **Lo que no hace falta para buscar ni filtrar va dentro de la nota**, no en las propiedades: el color del viaje, el
  presupuesto, las reservas, los documentos, la maleta, las tareas y el plan.
- **Los colores y los iconos de los lugares son del plugin.** Cada tipo de lugar tiene su icono y su color fijos. La nota
  solo dice qué tipo de lugar es, con su `categoría`.

Los nombres de abajo son los que se proponen por defecto (español · inglés). Cool Trip lee también los del otro idioma: una
nota con `category` funciona aunque los ajustes digan `categoría`.

### ¿Y si mi propiedad es de otro tipo?

Obsidian guarda un tipo por propiedad para todo el vault. Si eliges una tuya de otro tipo (por ejemplo, `start` como texto
cuando Cool Trip espera una fecha), Ajustes › 2 la marca como «Otro tipo». Funciona igual mientras el valor tenga la forma
que espera Cool Trip: las fechas como `2026-11-02` (sirven también fecha y hora), las listas como lista o separadas por
comas, y los números como número o como texto (`15 €`). Cool Trip nunca cambia el tipo de tus propiedades.

## Cómo reconoce cada nota (Ajustes › 1)

Se elige **una** de estas tres formas por tipo de nota:

| Forma | Viaje | Lugar | ¿Escribe algo? |
|---|---|---|---|
| Carpeta (por defecto) | `Viajes/` · `Trips/` | `Lugares/` · `Places/` | No |
| Propiedad | `tipo: viaje` · `type: trip` | `tipo: lugar` · `type: place` | Esa propiedad |
| Etiqueta | `#viaje` (la que elijas) | `#lugar` (la que elijas) | Esa etiqueta, en `tags` |

## Nota de viaje

| Propiedad | Formato | ¿Obligatoria? | Para qué sirve |
|---|---|---|---|
| `inicio` · `start` | fecha | **sí** | Primer día. Crea los días del plan, la cuenta atrás y el orden en las bases. |
| `fin` · `end` | fecha | **sí** | Último día. Noches, días, «próximos» o «viajados» en la base. |
| `destinos` · `destinations` | lista de ciudades | **sí** | Las ciudades en orden: billete, reparto de noches, color de cada destino y qué lugares sugiere. |
| `viajeros` · `travelers` | lista de nombres | no | Para repartir billetes, documentos y gastos («para Ana»), y para filtrar en las bases. |
| `portada` · `cover` | imagen | no | Solo si la portada es una foto. El color del billete va dentro de la nota. |

## Nota de lugar

| Propiedad | Formato | ¿Obligatoria? | Para qué sirve |
|---|---|---|---|
| `ciudad` · `city` | texto | **sí** | A qué destino pertenece. Sugerencias del plan, la guía por ciudad y la vista de cada ciudad. |
| `categoría` · `category` | texto | recomendada | Restaurante, museo, mirador… Elige el icono, el color y el grupo (ver, comer, pasear, dormir). |
| `coordenadas` · `coordinates` | `lat, lng` en grados decimales (`40.4203, -3.7058`), o una lista con los dos números | no (las busca solo) | El punto en el mapa de la base de lugares. Cool Trip las escribe como lista; si en esa nota ya estaban como texto, siguen como texto. |
| `precio` · `price` | texto (`€€`, `Gratis`, `15 €`) | no | Entrada o precio medio, junto a la categoría. |
| `valoración` · `rating` | número del 1 al 5 | no | Estrellas en la guía, para ver primero lo imprescindible. |
| `visitado` · `visited` | casilla | no | La casilla de la guía y de las tarjetas, para marcarlo durante el viaje. |
| `portada` · `cover` | imagen | no | La foto de su tarjeta en la vista de la ciudad. Sin ella, sale el color de su tipo con su icono. |
| `cerrado` · `closed` | casilla | no | Si el sitio ha cerrado para siempre. La ficha y la base lo marcan. |

**Lo que no hace falta:**

- **País.** El de cada ciudad lo eliges una vez, al añadirla a un viaje, y Cool Trip lo recuerda. Si escribes una ciudad nueva
  en una ficha, lo busca solo en OpenStreetMap (si está activada la búsqueda de Ajustes › 4). La base de lugares escribe
  «Kioto · Japón» sin propiedad. Ojo: «Rome» y «Roma» son dos ciudades distintas para la base; la ficha te sugiere las que ya
  usas para escribirlas igual.
- **Dirección.** Para abrir el sitio en tu app de mapas basta con el nombre y la ciudad. Google Maps abre así su ficha, con
  horario y reseñas; con las coordenadas solas, solo enseñaría un pin.

**Coordenadas automáticas (Ajustes › 4).** Al crear un lugar desde Cool Trip, el plugin busca sus coordenadas en
OpenStreetMap (Nominatim) por su nombre y su ciudad. Es gratis, no necesita cuenta y necesita conexión a internet. Para los
lugares que ya tienes, el mismo ajuste trae un botón que las busca, una por segundo. Si no encuentra un sitio, no escribe nada.
Se puede desactivar.

## Lo que va dentro de la nota del viaje (no son propiedades)

| Sección | Qué guarda |
|---|---|
| `> [!cool-trip\|color] Nombre` | El nombre del viaje y su color. Debajo, una línea por destino (`Kioto · Japón · 3 noches · Ana`) y el presupuesto (`> Presupuesto: 1500`). |
| `## Mochila` · `## Bag` | Los documentos: dónde están (nube, Wallet, vault, dispositivo, papel) y para quién. |
| `## Maleta` · `## Packing` | Lo que hay que meter: `- [x]` ya está dentro, `- [ ]` falta. |
| `## Por hacer` · `## To do` | Tus tareas, con fecha límite opcional `📅 2026-11-02`. |
| `## Plan` | Un `###` por día con sus pasos: lugares, comidas, transporte, alojamiento, entradas, notas. Cada paso puede llevar hora, precio (con `· por pagar` si falta pagarlo), «para» quién y sus documentos. |

## Lo que va dentro de la nota de un lugar (no son propiedades)

Si está activado «Ver las notas de lugar con el diseño de Cool Trip» (Ajustes › 1), la nota se abre como una ficha: arriba,
sus propiedades como campos (categoría, ciudad, precio, coordenadas, portada, estrellas y visitado; solo se escribe la que
rellenas) y debajo las secciones de su tipo, cada una con su formato. Cada sección es un `## Título` en el cuerpo y solo se
escribe cuando la rellenas. Las secciones de cada tipo están en [lugares.md](lugares.md). Tus otras secciones y lo que
escribas antes de la primera se ven tal cual y no se tocan.

## Si vienes de la versión 0.2

Al abrir y guardar un viaje, Cool Trip mueve a la nota el color de `portada` (si era un color, no una foto) y el
`presupuesto`. Deja de escribir `país` en los lugares nuevos y `ubicación` en los viajes, y quita el mapa de la base de
viajes. Lo que ya tengas escrito no lo borra: las propiedades `país`, `ubicación` de los viajes, `dirección` o `coordenadas`
duplicadas puedes borrarlas tú cuando quieras, desde Obsidian (panel *Todas las propiedades* › clic derecho › *Borrar*… o
*Renombrar* para unir dos en una).

## Tipos de lugar (la `categoría`)

Cool Trip mira las palabras de la categoría (da igual mayúsculas, plural o idioma) y gana el primer tipo que encaja, en este
orden. Con varios tipos («Bar, Restaurante»), manda el primero que escribes. Si ninguna encaja: pin gris, grupo «otros».

| Icono | Color | Grupo | Palabras que lo reconocen |
|---|---|---|---|
| `church` | #C2B3F5 | ver | templo, santuario, temple, shrine, iglesia, church, catedral, cathedral, mezquita, mosque, basilica, sinagoga, synagogue, monasterio, monastery, ermita |
| `palette` | #9CC9F0 | ver | museo, museum, galeria, gallery, exposicion, exhibition, arte, art |
| `book-open` | #E3D3A8 | ver | libreria, bookstore, bookshop, biblioteca, library, libros, books |
| `music` | #F07A8C | ver | musica, music, concierto, concert, sala, teatro, theat, opera, jazz |
| `clapperboard` | #F2E27A | ver | cine, cinema, movie, film |
| `disc-3` | #9C8CE0 | comer | discoteca, club, nightclub, fiesta, party |
| `beer` | #D9805F | comer | bar, bares, pub, taberna, tavern, cerveceria, brewery, beer, cocteleria, cocktail, vino, wine, vermut, izakaya |
| `utensils` | #E8613C | comer | restaurante, restaurant, comida, food, ramen, sushi, tapas, tasca, pizzeria, bistro, trattoria, marisqueria |
| `coffee` | #F5AFC0 | comer | cafe, coffee, cafeteria, brunch, pasteleria, bakery, panaderia, heladeria, ice cream, dulces |
| `store` | #EDC14B | comer | mercado, market |
| `shopping-bag` | #F7C59F | pasear | tienda, shop, calle comercial, shopping, compras, mall |
| `binoculars` | #6CC5C9 | ver | mirador, viewpoint, vista, torre, tower, observatorio, observatory |
| `trees` | #B5D69A | pasear | parque, park, jardin, garden, bosque, forest |
| `waves` | #7C9CD8 | pasear | playa, beach, costa, coast, lago, lake, rio, river, cala, bay |
| `mountain` | #A8C3A0 | pasear | montaña, mountain, volcan, ruta, hike, senderismo, excursion |
| `castle` | #B07CC6 | ver | castillo, castle, palacio, palace, fortaleza, fortress |
| `landmark` | #C9A27E | ver | monumento, monument, ruinas, ruins, historic, cementerio, cemetery |
| `paw-print` | #F2A65A | ver | zoo, acuario, aquarium, animales, animals |
| `trophy` | #B8C26A | ver | estadio, stadium, deporte, sport, futbol, football |
| `droplets` | #A6DCD8 | ver | onsen, spa, baños, bath, termas |
| `signpost` | #B9B4AA | pasear | cruce, crossing, plaza, square, calle, street, barrio, neighbo |
| `bed` | #8FD8C4 | dormir | hotel, alojamiento, hostal, ryokan, apartamento, lodging, hostel |
