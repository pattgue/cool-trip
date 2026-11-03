/* El CSS libre que Cool Trip escribe en las vistas de Cool Bases: el billete del viaje (vertical en el ordenador, apaisado en el
   móvil), las filas oscuras de la guía de lugares y las tarjetas de cada ciudad. «{{travelers}}» se cambia por la propiedad
   de los viajeros de los ajustes. */
/* los colores de la paleta del billete y la tinta */
export const HEX: Record<string, string> = { bermellon: "#E8613C", mostaza: "#EDC14B", pistacho: "#B5D69A", cielo: "#9CC9F0", lavanda: "#C2B3F5", rosa: "#F5AFC0" };
export const INK = "#141414";
/* las marcas del bloque de colores que Cool Trip reescribe dentro del CSS libre */
export const CSS_START = "/* cool-trip:colores */", CSS_END = "/* cool-trip:fin */";

export const TICKET_CSS = `/* Cool Trip · el billete: en el ordenador, vertical, con el troquel y una muesca a cada lado; en el móvil, apaisado, con la matriz a la derecha */
& .cb-card { --ct: ${HEX.cielo}; background: var(--ct) !important; }
& .cb-card .cb-body { height: 100%; box-sizing: border-box; padding: 18px 20px; gap: 5px; }
& .cb-l { margin: 0 !important; padding: 0 !important; line-height: 1.3; }
& .cb-l:has([data-prop="formula.nightsLabel"]) { margin-top: -2px !important; }
& .cb-l:has([data-prop="formula.pill"]) { position: absolute; top: 18px; right: 20px; }
& [data-prop="formula.pill"] { display: inline-block; letter-spacing: .14em; padding: 5px 8px 4px; border-radius: 999px; background: ${INK}; --cb-x-c: var(--ct) !important; white-space: nowrap; line-height: 1; }
& .cb-l:has([data-prop="file.name"]) { margin-top: auto !important; text-align: center; line-height: .95; letter-spacing: -1.5px; }
& .cb-l:has([data-prop="formula.route"]) { letter-spacing: .12em; line-height: 1.35; text-align: center; margin-bottom: 13px !important; }
& .cb-l:has([data-prop="note.{{travelers}}"]) { border-top: 2px dashed rgba(20, 20, 20, .45); margin: 0 -6px !important; padding: 8px 6px 4px !important; }
& .cb-l:has([data-prop="note.{{travelers}}"]) .cb-pill { letter-spacing: .1em; padding: 2px 6px; margin-right: 5px; border-radius: 999px; border: 1.5px solid ${INK}; background: none; }
& .cb-l:has([data-prop="formula.dates"]) { display: flex; justify-content: space-between; margin-top: 2px !important; }
& .cb-l:has([data-prop="formula.dates"]) .cb-sep { display: none; }
& [data-prop="formula.year"] { margin-left: auto; }
/* las muescas: dos agujeros a la altura del troquel (a 78 px del pie), que dejan ver el fondo */
& .cb-card { -webkit-mask: radial-gradient(circle 10px at 0 calc(100% - 78px), transparent 98%, #000 100%) left / 51% 100% no-repeat, radial-gradient(circle 10px at 100% calc(100% - 78px), transparent 98%, #000 100%) right / 51% 100% no-repeat;
  mask: radial-gradient(circle 10px at 0 calc(100% - 78px), transparent 98%, #000 100%) left / 51% 100% no-repeat, radial-gradient(circle 10px at 100% calc(100% - 78px), transparent 98%, #000 100%) right / 51% 100% no-repeat; }
/* con foto: arriba, fundida en el color del viaje */
& .cb-card .cb-media { inset: 0 0 36% 0 !important; }
& .cb-card .cb-media::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 30%, var(--ct) 96%); }
/* lo que solo sale en el móvil */
& .cb-l:has([data-prop="formula.yearRoute"]), & .cb-l:has([data-prop="formula.datesNights"]), & .cb-l:has([data-prop^="formula.stub"]) { display: none; }
.is-phone & .cb-grid { --cb-cw: 300px !important; gap: 12px !important; }
.is-phone & .cb-card::before { padding-top: 0 !important; height: 150px !important; }
.is-phone & .cb-card { -webkit-mask: radial-gradient(circle 9px at calc(100% - 92px) 0, transparent 98%, #000 100%) top / 100% 51% no-repeat, radial-gradient(circle 9px at calc(100% - 92px) 100%, transparent 98%, #000 100%) bottom / 100% 51% no-repeat;
  mask: radial-gradient(circle 9px at calc(100% - 92px) 0, transparent 98%, #000 100%) top / 100% 51% no-repeat, radial-gradient(circle 9px at calc(100% - 92px) 100%, transparent 98%, #000 100%) bottom / 100% 51% no-repeat; }
.is-phone & .cb-card .cb-body { padding: 14px 104px 14px 16px; gap: 4px; }
.is-phone & .cb-card .cb-body::after { content: ""; position: absolute; top: 0; bottom: 0; right: 92px; border-left: 2px dashed rgba(20, 20, 20, .45); }
.is-phone & .cb-l:has([data-prop="formula.daysLabel"]), .is-phone & .cb-l:has([data-prop="formula.nightsLabel"]), .is-phone & .cb-l:has([data-prop="formula.pill"]), .is-phone & .cb-l:has([data-prop="formula.route"]), .is-phone & .cb-l:has([data-prop="formula.dates"]) { display: none; }
.is-phone & .cb-l:has([data-prop="formula.yearRoute"]) { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.is-phone & [data-prop="formula.yearRoute"] { --cb-x-fs: 10px !important; letter-spacing: .14em; }
.is-phone & .cb-l:has([data-prop="file.name"]) { text-align: left; letter-spacing: -1.2px; }
.is-phone & [data-prop="file.name"] { --cb-x-fs: calc(var(--k, 1) * 30px) !important; }
.is-phone & .cb-l:has([data-prop="formula.datesNights"]) { display: block; }
.is-phone & [data-prop="formula.datesNights"] { --cb-x-fs: 12px !important; }
.is-phone & .cb-l:has([data-prop="note.{{travelers}}"]) { border: 0; margin: 0 !important; padding: 0 !important; }
.is-phone & [data-prop="note.{{travelers}}"] { --cb-x-fs: 9px !important; }
.is-phone & .cb-l:has([data-prop^="formula.stub"]) { display: block; position: absolute; right: 0; width: 92px; text-align: center; top: 50%; line-height: 1; }
.is-phone & .cb-l:has([data-prop="formula.stubNow"]) { transform: translateY(-50%); }
.is-phone & [data-prop="formula.stubNow"] { display: inline-block; box-sizing: border-box; width: 65px; padding: 8px 7px; border-radius: 8px; background: ${INK}; --cb-x-c: var(--ct) !important; --cb-x-fs: 11px !important; letter-spacing: .14em; line-height: 1.3; white-space: normal; }
.is-phone & .cb-l:has([data-prop="formula.stubN"]) { transform: translateY(-62%); }
.is-phone & [data-prop="formula.stubN"] { --cb-x-fs: 34px !important; letter-spacing: -1.2px; }
.is-phone & .cb-l:has([data-prop="formula.stubTop"]) { transform: translateY(-37px); }
.is-phone & .cb-l:has([data-prop="formula.stubUnit"]) { transform: translateY(12px); }
.is-phone & [data-prop="formula.stubTop"], .is-phone & [data-prop="formula.stubUnit"] { --cb-x-fs: 10px !important; letter-spacing: .14em; }
.is-phone & .cb-card:has([data-prop="formula.stubTop"]) .cb-l:has([data-prop="formula.stubN"]) { transform: translateY(-45%); }
.is-phone & .cb-card:has([data-prop="formula.stubTop"]) .cb-l:has([data-prop="formula.stubUnit"]) { transform: translateY(19px); }
.is-phone & .cb-card .cb-media { inset: 0 30% 0 0 !important; }
/* en el móvil el texto va encima de la foto: la foto, en tonos claros y teñida del color del viaje, así se lee sea cual sea */
.is-phone & .cb-card .cb-media img { filter: grayscale(1) contrast(.45) brightness(1.5) !important; }
.is-phone & .cb-card .cb-media::after { background: linear-gradient(to right, color-mix(in srgb, var(--ct) 58%, transparent) 30%, var(--ct)); }`;

export const ROW_CSS = `/* Cool Trip · filas oscuras: el icono de la categoría en su color, las estrellas y la casilla */
& .cb-card .cb-main { align-items: center; gap: 12px; padding: 10px 50px 10px 10px; }
& .cb-card .cb-media { flex: none !important; width: 52px !important; height: 52px; border-radius: 9px; }
& .cb-card .cb-body { padding: 0 !important; gap: 3px; }
& .cb-l { margin: 0 !important; padding: 0 !important; line-height: 1.25; }
& [data-prop="file.name"] { --cb-x-fs: 15px !important; --cb-x-c: #fff !important; font-weight: 800 !important; }
& .cb-l:has([data-prop="file.name"]) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
& [data-prop="formula.catPrice"] { --cb-x-fs: 12px !important; --cb-x-c: #a8a8a8 !important; font-weight: 600 !important; }
& [data-prop="formula.tripNames"] { --cb-x-fs: 11px !important; --cb-x-c: #9a9a9a !important; font-weight: 700 !important; letter-spacing: .08em; }
& .cb-card:has(.cb-rl) .cb-l:has([data-prop="formula.tripNames"]) { display: none; }
& .cb-rl { font-size: 12px; }
& .cb-ck { width: 26px !important; height: 26px !important; border-radius: 7px; border-width: 2px !important; }
& .cb-st:not(.is-on) .cb-ck { border-color: #5a5a5e; }
.is-phone & .cb-grid { gap: 8px !important; }`;

export const CITY_CSS = `/* Cool Trip · tarjetas de una ciudad: la foto (o el color de la categoría) arriba y la casilla encima */
& .cb-card .cb-media { flex: none !important; height: 130px; min-height: 0 !important; }
& .cb-card .cb-body { padding: 12px 14px 14px !important; gap: 6px; }
& .cb-l { margin: 0 !important; padding: 0 !important; line-height: 1.25; }
& [data-prop="formula.catPrice"] { --cb-x-fs: 10px !important; --cb-x-c: #a8a8a8 !important; font-weight: 800 !important; letter-spacing: .14em; }
& [data-prop="file.name"] { --cb-x-fs: 17px !important; --cb-x-c: #fff !important; font-weight: 800 !important; letter-spacing: -.2px; }
& .cb-l:has([data-prop="file.name"]) { line-height: 1.15; }
& .cb-rule { margin: 2px 0 0 !important; }
& [data-prop="formula.tripNames"] { --cb-x-fs: 11px !important; --cb-x-c: #9a9a9a !important; font-weight: 700 !important; letter-spacing: .06em; }
& .cb-ck { width: 26px !important; height: 26px !important; border-radius: 7px; border-width: 2px !important; }
& .cb-st:not(.is-on) .cb-ck { background: rgba(20, 20, 20, .35); }
.is-phone & .cb-grid { --cb-cw: 150px !important; gap: 10px !important; }
.is-phone & .cb-card .cb-media { height: 104px; }
& .cb-card .cb-media { position: relative; }
& .cb-card .cb-media::after { position: absolute; left: 10px; bottom: 10px; width: 30px; height: 30px; border-radius: 8px; background-size: cover; box-shadow: 0 1px 4px rgba(0, 0, 0, .35); }
.is-phone & .cb-card .cb-media::after { left: 8px; bottom: 8px; width: 26px; height: 26px; border-radius: 7px; }
${CSS_START}
${CSS_END}`;
