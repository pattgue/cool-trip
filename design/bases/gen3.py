# Tableros definitivos de las bases (solo las vistas que se van a crear). Viajes: Próximos y Viajados con las tarjetas de
# color (en el móvil, el billete apaisado), Todos (tabla) y Mapa. Lugares: Guía por ciudad, una vista por ciudad y Mapa.
# Uso: python3 gen3.py <carpeta project>   → escribe Base-*.dc.html (alturas en heights3.json si existe)
import json, sys, os, re, shutil, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
H3 = os.path.join(HERE, "heights3.json")

# 1 · lo que se queda de la ronda anterior (tabla, mapas y lugares), con la foto solo en Escocia y sin las vistas que no se crean
src = open(os.path.join(HERE, "gen2.py")).read()
src = src.replace('PHOTO = {"2027 - Japón": "fuji", "2027 - Reino Unido": "highlands", "2026 - Alemania": "berlin"}', 'PHOTO = {"2027 - Reino Unido": "highlands"}')
src = src.replace('''PLACE_VIEWS = [("table", "Guía por ciudad", "Tabla · por ciudad"), ("map", "Mapa", "Mapa"), ("layout-grid", "Favoritos", "Tarjetas"),
               ("list", "En el viaje abierto", "Lista · barra lateral")]''', '''PLACE_VIEWS = [("table", "Guía por ciudad", "Tabla · por ciudad"), ("map", "Mapa", "Mapa")]''')
src = src.replace("; padding-top: 470px", "")
tmp = tempfile.mkdtemp()
heights = json.load(open(H3)) if os.path.exists(H3) else {}
sys.argv = ["gen2.py", tmp]
g = {"__file__": os.path.join(HERE, "gen2.py")}
exec(src, g)
KEEP = {"Viajes-Tabla": "Viajes-Todos", "Viajes-Mapa": "Viajes-Mapa", "Lugares-Guia": "Lugares-Guia", "Lugares-Guia-CB": "Lugares-Guia-CB",
        "Lugares-Ciudad": "Lugares-Ciudad", "Lugares-Ciudad-CB": "Lugares-Ciudad-CB", "Lugares-Mapa": "Lugares-Mapa"}
def fix_height(path, fname):
    if fname not in heights: return
    s = open(path).read()
    s = re.sub(r"min-height: \d+px", f"min-height: {heights[fname]}px", s, count=1)
    s = re.sub(r'"height":\d+\}', f'"height":{heights[fname]}}}', s)
    open(path, "w").write(s)
for old, new in KEEP.items():
    for mob in ("", "-Movil"):
        f = f"Base-{new}{mob}.dc.html"
        shutil.copy(os.path.join(tmp, f"Mezcla-{old}{mob}.dc.html"), os.path.join(OUT, f))
        fix_height(os.path.join(OUT, f), f)

# 2 · Próximos y Viajados, nuevos
for k in ("BG", "TX", "MUTED", "LABEL", "INK", "PAL", "TRIPS", "PHOTO", "ico", "e", "scene", "toolbar", "views_menu", "group_head", "ncard", "ngrid", "page"):
    globals()[k] = g[k]
HEIGHTS = heights
def board(fname, title, w, body):
    h = HEIGHTS.get(fname, 900)
    g["HEIGHTS"] = HEIGHTS; g["OUT"] = OUT
    g["board"](fname, title, w, body)
TRIP_VIEWS = [("layout-grid", "Próximos", "Tarjetas"), ("layout-grid", "Viajados", "Tarjetas · por año"), ("table", "Todos", "Tabla"), ("map", "Mapa", "Mapa")]
upcoming = [t for t in TRIPS if t["st"] in ("now", "next")]
done = [t for t in TRIPS if t["st"] == "done"]
YEARS = (2026, 2025, 2024)

def photo_bg(t):
    # con foto: la foto en la parte de arriba del billete, fundida en el color del viaje (una regla del CSS libre por viaje)
    c = PAL[t["col"]]
    return (f'<span style="position: absolute; left: 0; right: 0; top: 0; height: 64%; overflow: hidden">{scene(PHOTO[t["name"]])}'
            f'<span style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0) 30%, {c} 96%)"></span></span>')

# --- escritorio, Cool Bases: la tarjeta de color en vertical, con forma de billete (la de Alemania que rehizo Patt) ---
# arriba: días y noches, y la pastilla (EN CURSO / EN 38 DÍAS / HACE 4 MESES); el país a todo el ancho (tamaño ajustado, con
# tope) y las ciudades centradas; troquel con muescas; abajo, los viajeros y las fechas con el año aparte
FITS = json.load(open(os.path.join(HERE, "fits.json"))) if os.path.exists(os.path.join(HERE, "fits.json")) else {}
FIT_MAX = 52
def pill_text(t):
    if t["st"] == "now": return "EN CURSO"
    if t["st"] == "next": return "EN " + t["when"].replace("Faltan ", "").upper()
    return t["when"].upper()
def color_card(t, h=360):
    c = PAL[t["col"]]
    photo = t["name"] in PHOTO
    tags = "".join(f'<span style="font-size: 9px; font-weight: 800; letter-spacing: .1em; padding: 2px 6px; border-radius: 999px; border: 1.5px solid {INK}">{e(p.upper())}</span>' for p in t["who"])
    notch = lambda side: f'<span style="position: absolute; {side}: -24px; top: -10px; width: 20px; height: 20px; border-radius: 50%; background: {BG}"></span>'
    title = t["short"].upper()
    fs = FITS.get(title, 40)
    dd, yy = t["dates"].rsplit(" ", 1)
    return (f'<div style="position: relative; overflow: hidden; min-width: 0; height: {h}px; box-sizing: border-box; border-radius: 14px; background: {c}; color: {INK}; display: flex; flex-direction: column">'
            f'{photo_bg(t) if photo else ""}'
            f'<div style="position: relative; flex: 1; min-height: 0; padding: 18px 20px 13px; display: flex; flex-direction: column; gap: 5px">'
            f'<div style="display: flex; justify-content: space-between; gap: 4px"><div style="display: flex; flex-direction: column; gap: 3px; padding-top: 2px; font-size: 10px; font-weight: 700">'
            f'<span>{t["nights"] + 1} DÍAS</span><span>{t["nights"]} NOCHES</span></div>'
            f'<span style="align-self: flex-start; font-size: 9px; font-weight: 800; letter-spacing: .14em; padding: 5px 8px 4px; border-radius: 999px; background: {INK}; color: {c}; white-space: nowrap">{e(pill_text(t))}</span></div>'
            f'<span style="flex: 1"></span>'
            f'<span data-fit="{e(title)}" style="font-size: {fs}px; font-weight: 900; letter-spacing: -1.5px; line-height: .95; white-space: nowrap; overflow: hidden">{e(title)}</span>'
            f'<span style="font-size: 11px; font-weight: 800; letter-spacing: .12em; line-height: 1.35; text-align: center">{e(" → ".join(t["dests"]).upper())}</span></div>'
            f'<div style="position: relative; height: 0; margin: 0 14px; border-top: 2px dashed rgba(20,20,20,.45)">{notch("left")}{notch("right")}</div>'
            f'<div style="position: relative; padding: 6px 20px 18px; display: flex; flex-direction: column; gap: 9px">'
            f'<span style="display: flex; gap: 9px; flex-wrap: wrap; align-items: center">{tags}</span>'
            f'<span style="display: flex; justify-content: space-between; gap: 2px; font-size: 14px"><span style="font-weight: 400">{e(dd.upper())}</span><span style="font-weight: 700">{yy}</span></span></div></div>')
def card_grid(ts): return f'<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px">{"".join(color_card(t) for t in ts)}</div>'

# --- móvil, Cool Bases: el billete apaisado (cuerpo + troquel vertical con muescas + matriz con la cuenta atrás) ---
def wide_ticket(t):
    c = PAL[t["col"]]
    if t["st"] == "now":
        stub = f'<span style="font-size: 11px; font-weight: 800; letter-spacing: .14em; padding: 8px 7px; border-radius: 8px; background: {INK}; color: {c}; width: 51px; text-align: center">EN CURSO</span>'
    elif t["st"] == "next":
        n = t["when"].replace("Faltan ", "").replace(" días", "")
        stub = f'<span style="font-size: 34px; font-weight: 900; letter-spacing: -1.2px; line-height: .9">{n}</span><span style="font-size: 10px; font-weight: 800; letter-spacing: .14em">DÍAS</span>'
    else:
        _, n, unit = t["when"].upper().split(" ")
        stub = f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .14em">HACE</span><span style="font-size: 34px; font-weight: 900; letter-spacing: -1.2px; line-height: .9">{n}</span><span style="font-size: 10px; font-weight: 800; letter-spacing: .14em">{unit}</span>'
    tags = "".join(f'<span style="font-size: 9px; font-weight: 800; letter-spacing: .1em; padding: 2px 6px; border-radius: 999px; border: 1.5px solid {INK}">{e(p.upper())}</span>' for p in t["who"])
    notch = lambda pos: f'<span style="position: absolute; {pos}: -9px; left: -9px; width: 18px; height: 18px; border-radius: 50%; background: {BG}"></span>'
    photo = t["name"] in PHOTO
    bg = (f'<span style="position: absolute; inset: 0 30% 0 0; overflow: hidden">{scene(PHOTO[t["name"]])}</span>'
          f'<span style="position: absolute; inset: 0 30% 0 25%; background: linear-gradient(to right, rgba(0,0,0,0), {c})"></span>') if photo else ""
    main_pad = "14px 12px 14px 16px"
    title_fs = 30 if len(t["short"]) <= 8 else 26
    return (f'<div style="position: relative; overflow: hidden; height: 150px; border-radius: 14px; background: {c}; color: {INK}; display: flex">{bg}'
            f'<div style="position: relative; flex: 1; min-width: 0; padding: {main_pad}; display: flex; flex-direction: column; gap: 4px">'
            f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .14em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{t["year"]} · {e(" → ".join(t["dests"]).upper())}</span>'
            f'<span style="flex: 1"></span>'
            f'<span style="font-size: {title_fs}px; font-weight: 900; letter-spacing: -1.2px; line-height: .95">{e(t["short"].upper())}</span>'
            f'<span style="font-size: 12px; font-weight: 700">{e(t["dates"])} · {t["nights"]} noches</span>'
            f'<span style="display: flex; gap: 4px; flex-wrap: wrap">{tags}</span></div>'
            f'<div style="position: relative; flex: none; width: 92px; border-left: 2px dashed rgba(20,20,20,.45); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px">'
            f'{notch("top")}{notch("bottom")}{stub}</div></div>')

# --- nativo: portada de color (fórmula → #hex), o la foto si la hay ---
def ncard_trip(t, cover_h, lines):
    inner = scene(PHOTO[t["name"]]) if t["name"] in PHOTO else ""
    return ncard(PAL[t["col"]], t["name"], lines, cover_h=cover_h, inner=inner).replace("align-items: center; justify-content: center\">", "overflow: hidden\">", 1)
def up_lines(t): return [f'<b style="color: {TX}; font-weight: 600">{e(t["when"])}</b>', e(t["dates"]) + f' · {t["nights"]} noches', e(" · ".join(t["dests"])), e(", ".join(t["who"]))]
def done_lines(t): return [e(t["dates"]), f'{t["nights"]} noches · ' + e(", ".join(t["who"]))]

# Próximos
board("Base-Viajes-Proximos.dc.html", "Viajes · Próximos · escritorio · sin Cool Bases", 1200,
      page(toolbar("layout-grid", "Próximos", len(upcoming)), ngrid([ncard_trip(t, 130, up_lines(t)) for t in upcoming], 4),
           extra=views_menu(TRIP_VIEWS, "Próximos", top=48)))
board("Base-Viajes-Proximos-Movil.dc.html", "Viajes · Próximos · móvil · sin Cool Bases", 390,
      page(toolbar("layout-grid", "Próximos", len(upcoming), phone=True), '<div style="height: 12px"></div>' + ngrid([ncard_trip(t, 84, up_lines(t)) for t in upcoming], 2, 10), pad="0 12px 32px"))
board("Base-Viajes-Proximos-CB.dc.html", "Viajes · Próximos · escritorio · Cool Bases", 1200,
      page(toolbar("layout-grid", "Próximos", len(upcoming), cool=True), f'<div style="padding-top: 16px">{card_grid(upcoming)}</div>'))
board("Base-Viajes-Proximos-CB-Movil.dc.html", "Viajes · Próximos · móvil · Cool Bases", 390,
      page(toolbar("layout-grid", "Próximos", len(upcoming), phone=True, cool=True), f'<div style="display: flex; flex-direction: column; gap: 12px; padding-top: 12px">{"".join(wide_ticket(t) for t in upcoming)}</div>', pad="0 12px 32px"))

# Viajados (por año)
def by_year(fn, phone=False):
    out = ""
    for y in YEARS:
        ts = [t for t in done if t["year"] == y]
        out += group_head(str(y), len(ts), phone=phone) + fn(ts)
    return out
board("Base-Viajes-Viajados.dc.html", "Viajes · Viajados · escritorio · sin Cool Bases", 1200,
      page(toolbar("layout-grid", "Viajados", len(done)), by_year(lambda ts: ngrid([ncard_trip(t, 110, done_lines(t)) for t in ts], 4))))
board("Base-Viajes-Viajados-Movil.dc.html", "Viajes · Viajados · móvil · sin Cool Bases", 390,
      page(toolbar("layout-grid", "Viajados", len(done), phone=True), by_year(lambda ts: ngrid([ncard_trip(t, 64, done_lines(t)) for t in ts], 2, 10), True), pad="0 12px 32px"))
board("Base-Viajes-Viajados-CB.dc.html", "Viajes · Viajados · escritorio · Cool Bases", 1200,
      page(toolbar("layout-grid", "Viajados", len(done), cool=True), by_year(card_grid)))
board("Base-Viajes-Viajados-CB-Movil.dc.html", "Viajes · Viajados · móvil · Cool Bases", 390,
      page(toolbar("layout-grid", "Viajados", len(done), phone=True, cool=True), by_year(lambda ts: f'<div style="display: flex; flex-direction: column; gap: 12px">{"".join(wide_ticket(t) for t in ts)}</div>', True), pad="0 12px 32px"))
shutil.rmtree(tmp)
print("ok")
