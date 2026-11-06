# Las fichas de lugar: secciones de cada tipo

La rúbrica la decide Patt en un documento editable: **[Cool Trip · Secciones de cada tipo de lugar](https://claude.ai/artifact/EkfgsgztJTuFJnFLR7wydn)**.
Lo que cambie ahí se pasa a `src/place-types.ts` (las secciones, sus formatos y sus sugerencias) y `src/places.ts` (las
palabras que reconocen cada tipo, su icono y su color).

## Formatos

| Formato | Cómo se rellena | Cómo queda en la nota |
|---|---|---|
| Filas | Una fila por cosa (nombre, precio, nota…); «+ Añadir» añade otra. En la carta, la ★ marca los favoritos. Un « · » escrito dentro de una casilla («MADROÑO · Negroni») se guarda con espacios duros y no parte la fila | `- ★ Ramen de miso · 1.200 ¥ · el de la casa` |
| Horario por días | Cada día con su hora de apertura y de cierre, más turnos si los tiene, o «cerrado». Lo que no son horas («24 h») se queda como texto | `- Lunes: cerrado` · `- Martes: 13:00–16:00, 20:00–23:30` |
| Etiquetas | Pastillas que se marcan, con sugerencias según el tipo, y una propia | `- Terraza` |
| Datos | Campos con nombre fijo; el teléfono, la web y el email se abren con su botón. Lo demás que haya escrito se ve debajo | `- Teléfono: +34 910 000 000` |
| Lista para llevar | Como la maleta del viaje | `- [ ] Toalla` |
| Lugares enlazados | Notas de lugar, en tarjetas que llevan a su ficha | `- [[Café Lento]] · nota` |
| Lista | Una cosa por línea | `- La sala del trono` |
| Texto | Texto libre | Los párrafos tal cual |
| Post-it | «Datos útiles», al final de todas | Texto libre |

Solo información que se mantiene en el tiempo: nada de programaciones del día. El **menú del día** solo sale si se marca.
Las secciones vacías se ven siempre, para rellenarlas a mano. El precio de la cabecera es «Precio medio» en los de comer y
beber y «Entrada» en los que llevan entradas; si no se escribe, se calcula de la carta (la media) o de las entradas (la más
barata). Si el precio es «gratis», «free» o 0, sale «Gratis» en verde.

**Varios tipos.** Un lugar puede ser de varios tipos («Bar, Restaurante», o la categoría como lista): el icono y el color son
los del primero, y las secciones, las de todos. Si dos se llaman igual (las dos «Carta») sale una, la más completa; el
horario, el aforo y la accesibilidad van al final. Si cambias el tipo, las secciones que ya tenían algo escrito se siguen
viendo.

**Cerrado definitivamente.** En la cabecera abierta (el lápiz) se marca si el sitio ha cerrado para siempre: se escribe la
propiedad `cerrado: true`, la cabecera sale apagada con la etiqueta «Cerrado definitivamente», y la base de lugares lo dice
junto a su categoría.

## Secciones de cada tipo

| Tipo | Secciones (en orden; «Datos útiles» siempre al final) |
|---|---|
| Restaurante | Cocina · Carta · Menú del día (opcional) · Reservar (teléfono, reserva online, email, antelación) · Horario · Accesibilidad |
| Café y dulces | Carta · Top · Horario · Accesibilidad |
| Bar | Carta · Top · Horario · Accesibilidad |
| Discoteca | Música · Entrada y normas · Horario · Accesibilidad |
| Mercado | Puestos · Horario · Accesibilidad |
| Museo y galería | Entradas · Exposiciones y actividades · Horario · Accesibilidad |
| Teatro | Qué se programa · Entradas (orientativas) · Horario · Aforo · Accesibilidad |
| Sala de conciertos | Géneros (etiquetas) · Entradas (orientativas) · Carta · Horario · Aforo · Accesibilidad |
| Cine | Entradas · Horario · Accesibilidad |
| Librería y biblioteca | Especialización · Eventos · Horario · Accesibilidad |
| Templo | Entrada · Normas · Ceremonias · Horario · Accesibilidad |
| Castillo y palacio | Entradas · Top · Visitas guiadas · Horario · Accesibilidad |
| Monumento | Historia en breve · Entradas · Horario · Accesibilidad |
| Mirador y torre | Mejor momento · Entradas · Horario · Accesibilidad |
| Zoo y acuario | Entradas · Horario · Accesibilidad |
| Estadio | Eventos · Entradas · Horario · Accesibilidad |
| Spa y onsen | Entradas · Normas · Horario · Accesibilidad |
| Tienda | Artículos · Horario · Accesibilidad |
| Parque y jardín | Mejor momento · Top · Horario · Accesibilidad |
| Playa, lago y río | Mejor momento · Qué llevar · Servicios · Horario · Accesibilidad |
| Montaña y ruta | Rutas · Qué llevar · Mejor momento · Horario · Accesibilidad |
| Barrio, calle y plaza | Top (lugares enlazados) · Mejor momento · Accesibilidad |
| Alojamiento (hotel, hostal, albergue, apartamento…) | Check-in / Check-out · Habitaciones · Contacto · Facilidades y extras · Horarios y reglas · Accesibilidad |
| Camping y glamping | Las mismas que el alojamiento |
| Otros | Horario |
