# Propiedades de Cool Trip

Cool Trip solo usa **dos tipos de nota**: viaje y lugar. Los nombres de abajo son los que propone por defecto (español · inglés).
En Ajustes › 2 puedes cambiar cada uno por el que ya uses. Además, Cool Trip y sus bases leen siempre también el nombre del otro
idioma: una nota con `category` funciona aunque los ajustes digan `categoría`.

Las reservas, los documentos, la mochila, la maleta, las tareas y el plan **no son propiedades**: van escritos en el cuerpo de la
nota del viaje (ver abajo).

## Cómo reconoce cada nota (Ajustes › 1)

Se elige **una** de estas tres formas por tipo de nota:

| Forma | Viaje | Lugar |
|---|---|---|
| Propiedad (por defecto) | `tipo: viaje` · `type: trip` | `tipo: lugar` · `type: place` |
| Carpeta | `Viajes/` · `Trips/` | `Lugares/` · `Places/` |
| Etiqueta | `#viaje` (la que elijas) | `#lugar` (la que elijas) |

> Si reconoces las notas por la propiedad `tipo`, no uses `tipo` también para la categoría del lugar: para eso está `categoría`.

## Nota de viaje

| Propiedad | Formato | ¿Obligatoria? | Para qué sirve |
|---|---|---|---|
| `inicio` · `start` | fecha | **sí** | Primer día. Crea los días del plan, la cuenta atrás y el orden en las bases. |
| `fin` · `end` | fecha | **sí** | Último día. Noches, días, «próximos» o «viajados» en la base. |
| `destinos` · `destinations` | lista de ciudades | **sí** | Las ciudades en orden: billete, reparto de noches, color de cada destino y qué lugares sugiere. |
| `viajeros` · `travelers` | lista de nombres | no | Para repartir billetes, documentos y gastos («para Ana»). |
| `portada` · `cover` | nombre de color o imagen | no | El color del billete (bermellón, mostaza, pistacho, cielo, lavanda, rosa) o una foto. |
| `presupuesto` · `budget` | número | no | Lo que esperas gastar. Se compara con lo pagado en el panel Coste. |
| `ubicación` · `location` | coordenadas | no (la pone sola) | Solo para el mapa de la base de viajes. Si falta, Cool Trip copia la de un lugar del viaje. |

## Nota de lugar

| Propiedad | Formato | ¿Obligatoria? | Para qué sirve |
|---|---|---|---|
| `ciudad` · `city` | texto | **sí** | A qué destino pertenece. Sugerencias del plan, la guía por ciudad y la vista de cada ciudad. |
| `país` · `country` | texto | no (se rellena sola) | Junto a la ciudad en la guía. |
| `categoría` · `category` | texto | recomendada | Restaurante, museo, mirador… Elige el icono, el color y el grupo (ver, comer, pasear, dormir). |
| `ubicación` · `location` | coordenadas `lat, lng` | recomendada | Botón de Maps exacto y el punto en el mapa de la base. Sin ella, el lugar no sale en el mapa. |
| `precio` · `price` | texto (`€€`, `Gratis`, `15 €`) | no | Entrada o precio medio, junto a la categoría. |
| `valoración` · `rating` | número del 1 al 5 | no | Estrellas en la guía, para ver primero lo imprescindible. |
| `visitado` · `visited` | casilla | no | La casilla de la guía y de las tarjetas, para marcarlo durante el viaje. |
| `portada` · `cover` | imagen | no | La foto de su tarjeta en la vista de la ciudad. Sin ella, sale el color de la categoría con su icono. |

## Lo que va dentro de la nota del viaje (no son propiedades)

| Sección | Qué guarda |
|---|---|
| `> [!cool-trip\|color]` | El nombre del viaje y el color elegido cuando la portada es una foto. |
| `## Mochila` · `## Bag` | Los documentos: dónde están (nube, Wallet, vault, dispositivo, papel) y para quién. |
| `## Maleta` · `## Packing` | Lo que hay que meter: `- [x]` ya está dentro, `- [ ]` falta. |
| `## Por hacer` · `## To do` | Tus tareas, con fecha límite opcional `📅 2026-11-02`. |
| `## Plan` | Un `###` por día con sus pasos: lugares, comidas, transporte, alojamiento, entradas, notas. Cada paso puede llevar hora, precio (con `· por pagar` si falta pagarlo), «para» quién y sus documentos. |

## Tipos de lugar (la `categoría`)

Cool Trip mira las palabras de la categoría (da igual mayúsculas, plural o idioma) y gana el primer tipo que encaja, en este orden. Si ninguna encaja: pin gris, grupo «otros».

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
