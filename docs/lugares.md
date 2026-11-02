# Las fichas de lugar: secciones de cada tipo

La rúbrica la decide Patt en un documento editable: **[Cool Trip · Secciones de cada tipo de lugar](https://claude.ai/artifact/EkfgsgztJTuFJnFLR7wydn)**.
Lo que cambie ahí se pasa a `src/place-types.ts` (las secciones, sus formatos y sus sugerencias) y `src/places.ts` (las
palabras que reconocen cada tipo, su icono y su color).

## Formatos

| Formato | Cómo se rellena | Cómo queda en la nota |
|---|---|---|
| Filas | Una fila por cosa (nombre, precio, nota…); «+ Añadir» añade otra | `- Ramen de miso · 1.200 ¥ · el de la casa` |
| Horario por días | Los 7 días, cada uno con su hora o «cerrado» | `- Lunes: cerrado` · `- Martes: 9:00–22:00` |
| Etiquetas | Pastillas que se marcan, con sugerencias según el tipo, y una propia | `- Terraza` |
| Datos | Campos con nombre fijo | `- Distancia: 12 km` |
| Lista para llevar | Como la maleta del viaje | `- [ ] Toalla` |
| Lugares enlazados | Notas de lugar, en tarjetas que llevan a su ficha | `- [[Café Lento]] · nota` |
| Lista | Una cosa por línea | `- La sala del trono` |
| Texto | Texto libre | Los párrafos tal cual |
| Post-it | «Datos útiles», al final de todas | Texto libre |

Solo información que se mantiene en el tiempo: nada de programaciones del día. El **menú del día** solo sale si se marca.
Las secciones vacías se ven siempre, para rellenarlas a mano. El precio de la cabecera es «Precio medio» en los de comer y
beber y «Entrada» en los que llevan entradas; si no se escribe, se calcula de la carta (la media) o de las entradas (la más
barata).

## Secciones de cada tipo

| Tipo | Secciones (en orden; «Datos útiles» siempre al final) |
|---|---|
| Restaurante | Cocina · Carta · Menú del día (opcional) · Reservar · Horario · Accesibilidad |
| Café y dulces | Carta · Top · Horario · Accesibilidad |
| Bar | Carta · Top · Horario · Accesibilidad |
| Discoteca | Música · Entrada y normas · Horario · Accesibilidad |
| Mercado | Puestos · Horario · Accesibilidad |
| Museo y galería | Entradas · Exposiciones y actividades · Horario · Accesibilidad |
| Teatro | Qué se programa · Entradas (orientativas) · Horario · Aforo · Accesibilidad |
| Sala de conciertos | Qué se programa · Entradas (orientativas) · Horario · Aforo · Accesibilidad |
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
| Alojamiento | Check-in / Check-out · Habitaciones · Contacto · Facilidades y extras · Horarios y reglas · Accesibilidad |
| Otros | Horario |
