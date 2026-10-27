# Diseño de las bases (tableros del canvas)

Generadores de los tableros de las filas **5 · Base de viajes** y **5b · Base de lugares** del canvas
(https://claude.ai/artifact/EREibCe33hATP7gorQ6771). Son la referencia del diseño cerrado con Patt: el HTML y los estilos de
cada tarjeta, fila y vista son lo que el plugin tiene que reproducir al crear las bases (con las vistas nativas de Bases y con
Cool Bases). Lo que Patt cambie a mano en el canvas manda sobre lo que salga de aquí.

- `gen.py` · tema oscuro de Obsidian, paleta del billete, datos de ejemplo, la barra de la base, el menú de vistas, tarjetas y tablas nativas.
- `gen2.py` · ilustraciones en lugar de fotos, la tabla y el mapa de viajes, y todas las vistas de lugares.
- `gen3.py` · los tableros definitivos (`Base-*.dc.html`): Próximos y Viajados con la tarjeta-billete vertical (escritorio) y el billete apaisado (móvil).
- `fit.mjs` · ajusta el tamaño del país de cada tarjeta al ancho (hasta 52 px) → `fits.json`.
- `measure.mjs` · mide la altura de cada tablero → `heights3.json` (y capturas si se le pasa una carpeta).

```bash
cd design/bases && mkdir -p out shots
python3 gen3.py $PWD/out && node fit.mjs $PWD/out && python3 gen3.py $PWD/out
node measure.mjs $PWD/out && python3 gen3.py $PWD/out && node measure.mjs $PWD/out $PWD/shots
```

Para publicar en el canvas: copiar `out/Base-*.dc.html` a `project/` del artefacto, poner en `canvas.json` el alto de cada
tablero (`heights3.json`) y publicar (antes, volver a leer `canvas.json`, que Patt también lo edita).
