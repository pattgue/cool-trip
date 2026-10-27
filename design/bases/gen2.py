# Tableros del canvas, ronda 2: «la mezcla» de las bases. Viajes: la A (tarjetas de embarque, ahora con forma de billete y
# portada de foto o color), la tabla y el mapa. Lugares: la guía por ciudad de la B en oscuro, una vista por ciudad agrupada
# por tipo con tarjetas con foto, y el mapa. Cada una en escritorio y móvil, y sin Cool Bases / con Cool Bases.
# Uso: python3 gen2.py <carpeta project> [alturas.json]
import json, sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "gen.py")).read()
exec(src[:src.index("# =====")])          # las piezas comunes de gen.py (tema, datos, barra, menú, tarjetas y tablas nativas)
OUT = sys.argv[1]
HEIGHTS = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and os.path.exists(sys.argv[2]) else {}
WORLD = json.load(open(os.path.join(HERE, "world.json")))
PAGE_BG = BG
TICKET = "#2a2a2c"
def txt_stars(n): return f'<span style="color: {PAL["mostaza"]}; letter-spacing: 1px">{"★" * n}</span><span style="color: #555; letter-spacing: 1px">{"★" * (5 - n)}</span>'                       # el cuerpo del billete, como en la nota (oscuro)

# ---------- ilustraciones en lugar de fotos (no hay fotos en este entorno): marcan dónde iría la imagen de portada ----------
def scene(kind):
    v = 'viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" aria-hidden="true" style="display: block"'
    S = {
        "fuji": '<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b4a7a"/><stop offset=".55" stop-color="#d9849a"/><stop offset="1" stop-color="#f6c28b"/></linearGradient></defs>'
                '<rect width="400" height="260" fill="url(#g1)"/><circle cx="300" cy="96" r="30" fill="#ffe1a8"/>'
                '<path d="M40 260 L190 92 Q200 84 210 92 L360 260 Z" fill="#3d3557"/><path d="M168 117 L190 92 Q200 84 210 92 L232 117 L218 112 L206 122 L196 111 L184 121 Z" fill="#f4f1ea"/>'
                '<path d="M0 230 Q100 205 200 228 T400 222 V260 H0 Z" fill="#2a2440"/>',
        "highlands": '<rect width="400" height="260" fill="#c9d1cb"/><circle cx="90" cy="70" r="26" fill="#eef0e6"/>'
                     '<path d="M0 150 Q80 90 170 140 T400 120 V260 H0 Z" fill="#6f8a69"/><path d="M0 190 Q120 140 240 182 T400 170 V260 H0 Z" fill="#4c6a4c"/>'
                     '<path d="M0 222 Q150 196 300 220 T400 214 V260 H0 Z" fill="#2f4a35"/><path d="M170 236 Q230 226 300 236 L300 244 Q230 238 170 244 Z" fill="#9db3b2"/>',
        "lisboa": '<rect width="400" height="260" fill="#9cc9f0"/><path d="M0 170 Q120 120 260 150 T400 130 V260 H0 Z" fill="#e9d8b8"/>'
                  + "".join(f'<rect x="{x}" y="{y}" width="34" height="{260 - y}" fill="{c}"/><path d="M{x - 3} {y} L{x + 17} {y - 14} L{x + 37} {y} Z" fill="#b5523a"/>'
                            for x, y, c in [(20, 150, "#f4f1ea"), (62, 138, "#edc14b"), (104, 128, "#e8a07a"), (146, 136, "#f4f1ea"), (188, 146, "#f5afc0"), (230, 140, "#edc14b"), (272, 130, "#f4f1ea"), (314, 122, "#e8a07a"), (356, 128, "#f4f1ea")])
                  + '<rect x="120" y="206" width="96" height="40" rx="8" fill="#edc14b"/><rect x="132" y="214" width="18" height="14" fill="#3a3a3a"/><rect x="158" y="214" width="18" height="14" fill="#3a3a3a"/><rect x="184" y="214" width="18" height="14" fill="#3a3a3a"/>',
        "berlin": '<rect width="400" height="260" fill="#d7dde4"/><rect x="186" y="40" width="10" height="150" fill="#5b6470"/><circle cx="191" cy="70" r="20" fill="#5b6470"/>'
                  '<rect x="0" y="170" width="400" height="90" fill="#8a96a3"/>' + "".join(f'<rect x="{x}" y="{y}" width="44" height="{260 - y}" fill="#{c}"/>' for x, y, c in [(10, 150, "6c7784"), (60, 130, "7d8896"), (220, 140, "6c7784"), (270, 120, "56606c"), (330, 150, "7d8896")]),
        "pagoda": '<defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f4a"/><stop offset="1" stop-color="#b86a6a"/></linearGradient></defs><rect width="400" height="260" fill="url(#g2)"/>'
                  + "".join(f'<rect x="{200 - w / 2}" y="{y}" width="{w}" height="10" fill="#2a1414"/><rect x="{200 - w / 2 + 12}" y="{y + 10}" width="{w - 24}" height="22" fill="#c8423a"/>' for w, y in [(80, 40), (110, 72), (140, 104), (170, 136), (200, 168)])
                  + '<rect x="197" y="16" width="6" height="26" fill="#2a1414"/><rect x="0" y="200" width="400" height="60" fill="#2a1414"/>',
        "torii": '<rect width="400" height="260" fill="#25311f"/>' + "".join(f'<g fill="#e8613c" opacity="{o}"><rect x="{200 - s}" y="{130 - s * .9}" width="{2 * s}" height="{s * .14}"/><rect x="{200 - s * .7}" y="{130 - s * .9}" width="{s * .12}" height="{s * 1.9}"/><rect x="{200 + s * .58}" y="{130 - s * .9}" width="{s * .12}" height="{s * 1.9}"/></g>' for s, o in [(40, .55), (62, .7), (92, .85), (135, 1)]),
        "lanterns": '<rect width="400" height="260" fill="#1d1a22"/>' + "".join(f'<ellipse cx="{x}" cy="{y}" rx="16" ry="22" fill="#e8613c"/><ellipse cx="{x}" cy="{y}" rx="9" ry="14" fill="#f6c28b" opacity=".7"/>' for x, y in [(60, 70), (120, 100), (180, 70), (240, 100), (300, 70), (360, 100)]) + '<rect y="190" width="400" height="70" fill="#2d2830"/>',
        "market": '<rect width="400" height="260" fill="#f4e7cf"/>' + "".join(f'<path d="M{x} 40 h80 l-10 50 h-60 Z" fill="{c}"/>' for x, c in [(10, "#e8613c"), (110, "#edc14b"), (210, "#e8613c"), (310, "#edc14b")])
                  + '<rect y="150" width="400" height="110" fill="#c79a62"/>' + "".join(f'<circle cx="{x}" cy="{180 + (x % 3) * 18}" r="14" fill="{c}"/>' for x, c in [(40, "#e8613c"), (80, "#b5d69a"), (130, "#edc14b"), (180, "#e8613c"), (230, "#b5d69a"), (280, "#edc14b"), (330, "#e8613c"), (370, "#b5d69a")]),
        "teamlab": '<rect width="400" height="260" fill="#120f1f"/>' + "".join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity=".85"/>' for x, y, r, c in [(80, 90, 46, "#c2b3f5"), (200, 150, 70, "#f5afc0"), (320, 80, 40, "#9cc9f0"), (300, 200, 30, "#edc14b"), (110, 210, 26, "#b5d69a")]),
        "forest": '<rect width="400" height="260" fill="#cfd8c3"/>' + "".join(f'<path d="M{x} {y} l26 70 h-52 Z" fill="{c}"/>' for x, y, c in [(30, 110, "#2f4a35"), (80, 90, "#466247"), (140, 120, "#2f4a35"), (260, 100, "#466247"), (320, 120, "#2f4a35"), (370, 90, "#466247")])
                  + '<g fill="#8a5a3a"><rect x="150" y="96" width="100" height="10"/><rect x="164" y="96" width="9" height="110"/><rect x="227" y="96" width="9" height="110"/></g><rect y="206" width="400" height="54" fill="#a9b39a"/>',
    }
    return f'<svg {v}>{S[kind]}</svg>'

# los viajes con foto de portada (los demás, su color)
PHOTO = {"2027 - Japón": "fuji", "2027 - Reino Unido": "highlands", "2026 - Alemania": "berlin"}
PLACE_PHOTO = {"Senso-ji": "pagoda", "Fushimi Inari": "torii", "Omoide Yokocho": "lanterns", "Tsukiji Outer Market": "market", "teamLab Planets": "teamlab", "Meiji Jingu": "forest"}
TOKIO = [p for p in PLACES if p["city"] == "Tokio"] + [dict(n="Meiji Jingu", city="Tokio", co="Japón", cat="Santuario", price="Gratis", rate=0, seen=False, trip="2027 - Japón"),
                                                       dict(n="Shibuya Crossing", city="Tokio", co="Japón", cat="Barrio", price="Gratis", rate=0, seen=False, trip="2027 - Japón")]
FAMILY = {"Templo": "Ver", "Santuario": "Ver", "Monumento": "Ver", "Museo": "Ver", "Mirador": "Ver", "Barrio": "Pasear", "Parque": "Pasear",
          "Restaurante": "Comer", "Cafetería": "Comer", "Mercado": "Comer"}

def cover(t, h, text=False):
    inner = scene(PHOTO[t["name"]]) if t["name"] in PHOTO else ""
    if not inner and text:
        fs = 30 if len(" → ".join(t["dests"])) < 14 else 22
        inner = (f'<div style="height: 100%; box-sizing: border-box; padding: 16px; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; color: {INK}; font-family: Helvetica, Arial, sans-serif">'
                 f'<span style="font-size: 10px; font-weight: 700; letter-spacing: .18em">DESTINOS</span>'
                 f'<span style="font-size: {fs}px; font-weight: 900; letter-spacing: -.5px; line-height: 1">{e(" → ".join(t["dests"]).upper())}</span></div>')
    return f'<div style="height: {h}px; background: {PAL[t["col"]]}; overflow: hidden">{inner}</div>'

# ---------- VIAJES ----------
TRIP_VIEWS = [("layout-grid", "Próximos", "Tarjetas"), ("layout-grid", "Viajados", "Tarjetas · por año"), ("table", "Todos", "Tabla"), ("map", "Mapa", "Mapa")]
upcoming = [t for t in TRIPS if t["st"] in ("now", "next")]

# 1 · Próximos · nativo: portada = la foto si la hay; si no, el color (fórmula)
def ncard_trip(t, cover_h):
    lines = [f'<b style="color: {TX}; font-weight: 600">{e(t["when"])}</b>', e(t["dates"]) + f' · {t["nights"]} noches', e(" · ".join(t["dests"])), e(", ".join(t["who"]))]
    return ncard(PAL[t["col"]], t["name"], lines, cover_h=cover_h, inner=scene(PHOTO[t["name"]]) if t["name"] in PHOTO else "").replace("align-items: center; justify-content: center\">", "overflow: hidden\">", 1)
board("Mezcla-Viajes-Proximos.dc.html", "Viajes · Próximos · escritorio · sin Cool Bases", 1200,
      page(toolbar("layout-grid", "Próximos", len(upcoming)), ngrid([ncard_trip(t, 130) for t in upcoming], 4),
           extra=views_menu(TRIP_VIEWS, "Próximos", top=48)).replace('padding: 8px 24px 32px', 'padding: 8px 24px 32px; padding-top: 250px'))
board("Mezcla-Viajes-Proximos-Movil.dc.html", "Viajes · Próximos · móvil · sin Cool Bases", 390,
      page(toolbar("layout-grid", "Próximos", len(upcoming), phone=True), '<div style="height: 12px"></div>' + ngrid([ncard_trip(t, 84) for t in upcoming], 2, 10), pad="0 12px 32px"))

# 2 · Próximos · Cool Bases: el billete (portada arriba, cuerpo oscuro, troquel y cuenta atrás). La forma de billete
#     (las muescas y el corte) es lo único que pide CSS libre; lo demás sale de los ajustes de Cool Bases.
def notch(side, bg=PAGE_BG):
    pos = "left: -9px" if side == "l" else "right: -9px"
    return f'<span style="position: absolute; {pos}; top: -9px; width: 18px; height: 18px; border-radius: 50%; background: {bg}"></span>'
def boarding(t, w=262, cover_h=150, phone=False, bg=PAGE_BG):
    st = ""
    if t["st"] == "now":
        st = f'<span style="position: absolute; top: 12px; left: 12px; font-size: 10px; font-weight: 800; letter-spacing: .14em; padding: 5px 9px; border-radius: 999px; background: {INK}; color: {PAL[t["col"]]}">EN CURSO</span>'
    days = t["when"].replace("Faltan ", "").replace(" días", "") if t["st"] == "next" else ""
    count = (f'<span style="display: flex; align-items: baseline; gap: 6px"><span style="font-size: 30px; font-weight: 900; letter-spacing: -1px; color: #fff">{days}</span>'
             f'<span style="font-size: 11px; font-weight: 700; color: {MUTED}; line-height: 1.15">días para<br>el viaje</span></span>') if days else \
            f'<span style="font-size: 13px; font-weight: 800; letter-spacing: .1em; color: #fff">{e(t["when"].upper())}</span>'
    tags = "".join(f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .1em; padding: 3px 7px; border-radius: 999px; border: 1.5px solid #555; color: {TX}">{e(p.upper())}</span>' for p in t["who"])
    width = "width: 100%" if phone else f"width: {w}px"
    return (f'<div style="{width}; box-sizing: border-box; border-radius: 14px; overflow: hidden; background: {TICKET}; display: flex; flex-direction: column">'
            f'<div style="position: relative">{cover(t, cover_h, text=True)}{st}</div>'
            f'<div style="padding: 14px 16px 12px; display: flex; flex-direction: column; gap: 4px">'
            f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .16em; color: {MUTED}">{t["year"]} · {e(" · ".join(t["dests"]).upper())}</span>'
            f'<span style="font-size: 32px; font-weight: 900; letter-spacing: -1.2px; line-height: 1; color: #fff">{e(t["short"].upper())}</span>'
            f'<span style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: {TX}; margin-top: 4px"><span>{e(t["dates"])}</span><span>{t["nights"]} noches</span></span></div>'
            f'<div style="position: relative; border-top: 2px dashed #4a4a4e; margin: 4px 0 0">{notch("l", bg)}{notch("r", bg)}</div>'
            f'<div style="padding: 12px 16px 14px; display: flex; align-items: center; justify-content: space-between; gap: 8px">{count}<span style="display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end">{tags}</span></div></div>')
board("Mezcla-Viajes-Proximos-CB.dc.html", "Viajes · Próximos · escritorio · Cool Bases", 1200,
      page(toolbar("layout-grid", "Próximos", len(upcoming), cool=True), f'<div style="display: flex; gap: 20px; flex-wrap: wrap; padding-top: 16px">{"".join(boarding(t) for t in upcoming)}</div>'))
board("Mezcla-Viajes-Proximos-CB-Movil.dc.html", "Viajes · Próximos · móvil · Cool Bases", 390,
      page(toolbar("layout-grid", "Próximos", len(upcoming), phone=True, cool=True), f'<div style="display: flex; flex-direction: column; gap: 14px; padding-top: 12px">{"".join(boarding(t, cover_h=120, phone=True) for t in upcoming)}</div>', pad="0 12px 32px"))

# 3 · Todos · tabla (la misma con Cool Bases y sin él), con resumen de noches abajo
def swatch(t):
    if t["name"] in PHOTO: return f'<span style="width: 26px; height: 18px; border-radius: 4px; overflow: hidden; display: inline-block; flex: none">{scene(PHOTO[t["name"]])}</span>'
    return f'<span style="width: 26px; height: 18px; border-radius: 4px; background: {PAL[t["col"]]}; display: inline-block; flex: none"></span>'
cols = [("file-text", "Viaje"), ("calendar", "Fechas"), ("clock-3", "Noches"), ("map-pin", "Destinos"), ("users", "Viajeros"), ("hourglass", "Cuándo")]
rows = [[swatch(t) + link(t["name"]), e(t["dates"]), str(t["nights"]), e(", ".join(t["dests"])), e(", ".join(t["who"])), e(t["when"])] for t in sorted(TRIPS, key=lambda t: t["name"], reverse=True)]
board("Mezcla-Viajes-Tabla.dc.html", "Viajes · Todos (tabla) · escritorio", 1200,
      page(toolbar("table", "Todos", len(TRIPS)), '<div style="height: 16px"></div>' + ntable(cols, rows, ["230px", "170px", "90px", "minmax(0, 1fr)", "170px", "150px"],
           foot=[f"{len(TRIPS)} viajes", "", f'Suma {sum(t["nights"] for t in TRIPS)}', "", "", ""])))
mrows = [[swatch(t) + link(t["name"]), e(t["dates"]), str(t["nights"])] for t in sorted(TRIPS, key=lambda t: t["name"], reverse=True)]
board("Mezcla-Viajes-Tabla-Movil.dc.html", "Viajes · Todos (tabla) · móvil", 390,
      page(toolbar("table", "Todos", len(TRIPS), phone=True), '<div style="height: 12px"></div>' + f'<div style="overflow: hidden; margin-right: -12px">{ntable(cols[:3], mrows, ["170px", "150px", "80px"], foot=[f"{len(TRIPS)} viajes", "", "Suma " + str(sum(t["nights"] for t in TRIPS))], phone=True)}</div>', pad="0 12px 32px"))

# 4 · Mapa (vista Mapa del plugin Maps de Obsidian; igual con Cool Bases y sin él): un marcador por viaje, de su color
COORD = {"2026 - Alemania": (52.52, 13.40), "2026 - Portugal": (38.72, -9.14), "2027 - Japón": (35.68, 139.69), "2027 - Reino Unido": (55.95, -3.19), "2026 - Italia y Grecia": (41.9, 12.5),
         "2025 - México": (19.43, -99.13), "2025 - Islandia": (64.15, -21.94), "2024 - Marruecos": (31.63, -8.0)}
def wxy(lat, lon):
    x = (lon - WORLD["lon0"]) / (WORLD["lon1"] - WORLD["lon0"]) * WORLD["w"]
    Y = lambda l: math.log(math.tan(math.pi / 4 + math.radians(l) / 2))
    return x, (Y(WORLD["lat1"]) - Y(lat)) * WORLD["k"]
def pin(color, icon, size=34, ring=PAGE_BG):
    return (f'<span style="width: {size}px; height: {size}px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); background: {color}; border: 2px solid {ring}; '
            f'display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,.4)"><span style="transform: rotate(45deg); display: inline-flex">{ico(icon, size * .45, INK, 2.2)}</span></span>')
def world_map(w, h, view, popup=None, zoom_ctrl=True):
    # recorte: x0, y0, ancho visible del mapa base (1200 × 461)
    x0, y0, vw = view
    s = w / vw
    pins = ""
    for t in TRIPS:
        x, y = wxy(*COORD[t["name"]])
        px, py = (x - x0) * s, (y - y0) * s
        if -20 < px < w + 20 and -20 < py < h + 20:
            pins += f'<span style="position: absolute; left: {px - 17:.0f}px; top: {py - 38:.0f}px">{pin(PAL[t["col"]], "plane")}</span>'
    pop = ""
    if popup:
        t, (px, py) = popup
        pop = (f'<div style="position: absolute; left: {px}px; top: {py}px; width: 236px; border-radius: 10px; overflow: hidden; background: #2b2b2b; border: 1px solid #424242; box-shadow: 0 12px 28px rgba(0,0,0,.5)">'
               f'{cover(t, 92)}<div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 14px; font-weight: 600; color: {TX}">{e(t["name"])}</span>'
               f'<span style="font-size: 13px; color: {MUTED}">{e(t["dates"])} · {t["nights"]} noches</span><span style="font-size: 13px; color: {MUTED}">{e(" · ".join(t["dests"]))}</span></div></div>')
    ctrl = (f'<div style="position: absolute; right: 14px; top: 14px; display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; border: 1px solid #424242">'
            f'<span style="width: 34px; height: 34px; background: #2b2b2b; display: flex; align-items: center; justify-content: center">{ico("plus", 16, TX)}</span>'
            f'<span style="width: 34px; height: 34px; background: #2b2b2b; border-top: 1px solid #424242; display: flex; align-items: center; justify-content: center; color: {TX}; font-size: 20px">−</span></div>') if zoom_ctrl else ""
    return (f'<div style="position: relative; width: {w}px; height: {h}px; overflow: hidden; background: #16181d">'
            f'<svg width="{w}" height="{h}" viewBox="{x0} {y0} {vw} {vw * h / w:.1f}" aria-hidden="true" style="position: absolute; inset: 0"><path d="{WORLD["d"]}" fill="#2b2e35" stroke="#3a3e47" stroke-width=".6"/></svg>'
            f'{pins}{pop}{ctrl}<span style="position: absolute; right: 8px; bottom: 6px; font-size: 10px; color: #777">© OpenFreeMap · OpenStreetMap</span></div>')
x, y = wxy(*COORD["2027 - Japón"])
board("Mezcla-Viajes-Mapa.dc.html", "Viajes · Mapa · escritorio", 1200,
      page(toolbar("map", "Mapa", len(TRIPS)), world_map(1200, 640, (0, 0, 1200), popup=(TRIPS[2], (int(x) - 250, int(y) - 120))), pad="0"))
# móvil: Europa y alrededores (el móvil enseña menos mundo; se arrastra)
board("Mezcla-Viajes-Mapa-Movil.dc.html", "Viajes · Mapa · móvil", 390,
      page(toolbar("map", "Mapa", len(TRIPS), phone=True), world_map(390, 700, (430, 60, 330), popup=(TRIPS[1], (24, 270))), pad="0"))

# ---------- LUGARES ----------
CITIES = ["Tokio", "Kioto", "Lisboa", "Roma", "Palermo", "CDMX"]
PLACE_VIEWS = [("table", "Guía por ciudad", "Tabla · por ciudad"), ("map", "Mapa", "Mapa"), ("layout-grid", "Favoritos", "Tarjetas"),
               ("list", "En el viaje abierto", "Lista · barra lateral")]
def menu_places(current):
    m = views_menu(PLACE_VIEWS, current, top=48)
    cities = "".join(f'<span style="display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: 6px; font-size: 14px; {"background: #34323f; color: #fff" if c == current else "color: " + TX}">{ico("layout-grid", 15, MUTED)}<span style="flex: 1">{c}</span>{ico("check", 14, ACC) if c == current else ""}</span>' for c in CITIES)
    sep = f'<span style="height: 1px; background: {LINE}; margin: 4px 0"></span><span style="font-size: 11px; font-weight: 600; letter-spacing: .06em; color: {LABEL}; padding: 6px 10px 2px">CIUDADES · TARJETAS POR TIPO</span>{cities}'
    return m.replace(f'<span style="height: 1px; background: {LINE}; margin: 4px 0"></span>', sep + f'<span style="height: 1px; background: {LINE}; margin: 4px 0"></span>', 1)

# 5 · Guía por ciudad · nativo (tabla con la casilla de visitado)
cols = [("file-text", "Lugar"), ("list", "Categoría"), ("star", "Valoración"), ("square-check", "Visitado"), ("plane", "Viajes")]
body = ""
for city in CITIES[:5]:
    ps = [p for p in PLACES if p["city"] == city]
    body += group_head(f'{city} · {ps[0]["co"]}', len(ps)) + ntable(cols, [[link(p["n"]), e(p["cat"]) + f' <span style="color: {LABEL}">· {e(p["price"])}</span>', txt_stars(p["rate"]) if p["rate"] else "", check(p["seen"]), link(p["trip"])] for p in ps],
                                                                 ["240px", "160px", "130px", "100px", "minmax(0, 1fr)"])
board("Mezcla-Lugares-Guia.dc.html", "Lugares · Guía por ciudad · escritorio · sin Cool Bases", 1200,
      page(toolbar("table", "Guía por ciudad", len(PLACES) - 1), body, extra=menu_places("Guía por ciudad")).replace('padding: 8px 24px 32px', 'padding: 8px 24px 32px; padding-top: 470px'))
body = ""
for city in CITIES[:5]:
    ps = [p for p in PLACES if p["city"] == city]
    body += group_head(city, len(ps), phone=True) + f'<div style="overflow: hidden; margin-right: -12px">{ntable(cols[:2] + [cols[3]], [[link(p["n"]), e(p["cat"]), check(p["seen"])] for p in ps], ["170px", "130px", "90px"], phone=True)}</div>'
board("Mezcla-Lugares-Guia-Movil.dc.html", "Lugares · Guía por ciudad · móvil · sin Cool Bases", 390,
      page(toolbar("table", "Guía por ciudad", len(PLACES) - 1, phone=True), body, pad="0 12px 32px"))

# 6 · Guía por ciudad · Cool Bases, en oscuro: filas con el icono de la categoría, estrellas y casilla
DARK_CARD = "#2a2a2c"
def guide_row_dark(p):
    icon, col = cat(p)
    box = (f'<span style="flex: none; width: 26px; height: 26px; border-radius: 7px; border: 2px solid {"#fff" if p["seen"] else "#5a5a5e"}; display: inline-flex; align-items: center; justify-content: center; {"background: #fff" if p["seen"] else ""}">'
           f'{ico("check", 15, INK, 3) if p["seen"] else ""}</span>')
    rate = (f'<span style="display: flex; gap: 1px">{stars(p["rate"], 12, PAL["mostaza"], "#555")}</span>' if p["rate"]
            else f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: {LABEL}">{e(p["trip"].upper())}</span>')
    return (f'<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 10px; border-radius: 12px; background: {DARK_CARD}; color: {TX}">'
            f'<span style="flex: none; width: 52px; height: 52px; border-radius: 9px; background: {PAL[col]}; display: inline-flex; align-items: center; justify-content: center">{ico(icon, 24, INK, 1.9)}</span>'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e(p["n"])}</span>'
            f'<span style="font-size: 12px; font-weight: 600; color: {MUTED}">{e(p["cat"])} · {e(p["price"])}</span>{rate}</span>{box}</div>')
body = ""
for city in CITIES[:5]:
    ps = [p for p in PLACES if p["city"] == city]
    body += group_head(f'{city} · {ps[0]["co"]}', len(ps)) + f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">{"".join(guide_row_dark(p) for p in ps)}</div>'
board("Mezcla-Lugares-Guia-CB.dc.html", "Lugares · Guía por ciudad · escritorio · Cool Bases (oscura)", 1200,
      page(toolbar("table", "Guía por ciudad", len(PLACES) - 1, cool=True), body))
body = ""
for city in CITIES[:5]:
    ps = [p for p in PLACES if p["city"] == city]
    body += group_head(city, len(ps), phone=True) + f'<div style="display: flex; flex-direction: column; gap: 8px">{"".join(guide_row_dark(p) for p in ps)}</div>'
board("Mezcla-Lugares-Guia-CB-Movil.dc.html", "Lugares · Guía por ciudad · móvil · Cool Bases (oscura)", 390,
      page(toolbar("table", "Guía por ciudad", len(PLACES) - 1, phone=True, cool=True), body, pad="0 12px 32px"))

# 7 · Una ciudad (Tokio), agrupada por tipo · nativo: tarjetas con la foto (o el color de la categoría)
def ncard_place(p, cover_h):
    icon, col = cat(p)
    inner = scene(PLACE_PHOTO[p["n"]]) if p["n"] in PLACE_PHOTO else ico(icon, 30, INK, 1.8)
    c = ncard(PAL[col], p["n"], [e(p["cat"]) + " · " + e(p["price"]), "Visitado" if p["seen"] else "Por visitar"], cover_h=cover_h, inner=inner)
    return c.replace("align-items: center; justify-content: center\">", "align-items: center; justify-content: center; overflow: hidden\">", 1)
body = ""
for fam in ("Ver", "Comer", "Pasear"):
    ps = [p for p in TOKIO if FAMILY[p["cat"]] == fam]
    body += group_head(fam, len(ps)) + ngrid([ncard_place(p, 120) for p in ps], 5, 14)
board("Mezcla-Lugares-Ciudad.dc.html", "Lugares · Tokio (por tipo) · escritorio · sin Cool Bases", 1200,
      page(toolbar("layout-grid", "Tokio", len(TOKIO)), body))
body = ""
for fam in ("Ver", "Comer", "Pasear"):
    ps = [p for p in TOKIO if FAMILY[p["cat"]] == fam]
    body += group_head(fam, len(ps), phone=True) + ngrid([ncard_place(p, 96) for p in ps], 2, 10)
board("Mezcla-Lugares-Ciudad-Movil.dc.html", "Lugares · Tokio (por tipo) · móvil · sin Cool Bases", 390,
      page(toolbar("layout-grid", "Tokio", len(TOKIO), phone=True), body, pad="0 12px 32px"))

# 8 · Una ciudad · Cool Bases, en oscuro como la guía: la foto arriba (o el color de la categoría) y su insignia
def place_card(p, w=212, img_h=130, phone=False):
    icon, col = cat(p)
    img = scene(PLACE_PHOTO[p["n"]]) if p["n"] in PLACE_PHOTO else f'<span style="height: 100%; display: flex; align-items: center; justify-content: center">{ico(icon, 34, INK, 1.8)}</span>'
    badge = (f'<span style="position: absolute; left: 10px; bottom: 10px; width: 32px; height: 32px; border-radius: 50%; background: {PAL[col]}; border: 2px solid {DARK_CARD}; '
             f'display: inline-flex; align-items: center; justify-content: center">{ico(icon, 16, INK, 2)}</span>') if p["n"] in PLACE_PHOTO else ""
    box = (f'<span style="position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 7px; border: 2px solid #fff; box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; '
           f'background: {"#fff" if p["seen"] else "rgba(20,20,20,.35)"}">{ico("check", 15, INK, 3) if p["seen"] else ""}</span>')
    width = "width: 100%" if phone else f"width: {w}px"
    return (f'<div style="{width}; box-sizing: border-box; border-radius: 12px; overflow: hidden; background: {DARK_CARD}; color: {TX}; display: flex; flex-direction: column">'
            f'<div style="position: relative; height: {img_h}px; background: {PAL[col]}; overflow: hidden">{img}{badge}{box}</div>'
            f'<div style="padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px">'
            f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .14em; color: {MUTED}">{e(p["cat"].upper())} · {e(p["price"].upper())}</span>'
            f'<span style="font-size: 17px; font-weight: 800; line-height: 1.15; letter-spacing: -.2px; color: #fff">{e(p["n"])}</span>'
            f'<span style="height: 1.5px; background: #444; margin-top: 2px"></span>'
            f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .06em; color: {LABEL}">{e(p["trip"].upper())}</span></div></div>')
body = ""
for fam in ("Ver", "Comer", "Pasear"):
    ps = [p for p in TOKIO if FAMILY[p["cat"]] == fam]
    body += group_head(fam, len(ps)) + f'<div style="display: flex; gap: 16px; flex-wrap: wrap">{"".join(place_card(p) for p in ps)}</div>'
board("Mezcla-Lugares-Ciudad-CB.dc.html", "Lugares · Tokio (por tipo) · escritorio · Cool Bases (oscura)", 1200,
      page(toolbar("layout-grid", "Tokio", len(TOKIO), cool=True), body))
body = ""
for fam in ("Ver", "Comer", "Pasear"):
    ps = [p for p in TOKIO if FAMILY[p["cat"]] == fam]
    body += group_head(fam, len(ps), phone=True) + f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px">{"".join(place_card(p, img_h=104, phone=True) for p in ps)}</div>'
board("Mezcla-Lugares-Ciudad-CB-Movil.dc.html", "Lugares · Tokio (por tipo) · móvil · Cool Bases (oscura)", 390,
      page(toolbar("layout-grid", "Tokio", len(TOKIO), phone=True, cool=True), body, pad="0 12px 32px"))

# 9 · Mapa de lugares (Maps): marcadores con el icono y el color de la categoría; un mapa de calles esquemático de Tokio
TK = {"Senso-ji": (35.7148, 139.7967), "teamLab Planets": (35.6491, 139.7898), "Omoide Yokocho": (35.6930, 139.6996), "Tsukiji Outer Market": (35.6655, 139.7707),
      "Meiji Jingu": (35.6764, 139.6993), "Shibuya Crossing": (35.6595, 139.7005)}
def city_map(w, h, popup=None):
    lat0, lat1, lon0, lon1 = 35.635, 35.735, 139.67, 139.83
    sx = lambda lon: (lon - lon0) / (lon1 - lon0) * w
    sy = lambda lat: (lat1 - lat) / (lat1 - lat0) * h
    def poly(pts, fill): return f'<path d="M' + "L".join(f"{sx(lo):.0f} {sy(la):.0f}" for la, lo in pts) + f'Z" fill="{fill}"/>'
    def line(pts, color, wd): return f'<path d="M' + "L".join(f"{sx(lo):.0f} {sy(la):.0f}" for la, lo in pts) + f'" fill="none" stroke="{color}" stroke-width="{wd}" stroke-linecap="round" stroke-linejoin="round"/>'
    bay = poly([(35.645, 139.83), (35.645, 139.80), (35.64, 139.775), (35.62, 139.76), (35.60, 139.76), (35.60, 139.83)], "#1d2a3d")
    river = line([(35.745, 139.81), (35.72, 139.803), (35.705, 139.80), (35.69, 139.792), (35.675, 139.785), (35.66, 139.778), (35.645, 139.772)], "#1d2a3d", 16)
    parks = (poly([(35.718, 139.770), (35.718, 139.778), (35.710, 139.778), (35.710, 139.770)], "#24362b")
             + poly([(35.692, 139.748), (35.692, 139.760), (35.680, 139.760), (35.680, 139.748)], "#24362b")
             + poly([(35.683, 139.690), (35.683, 139.705), (35.666, 139.705), (35.666, 139.690)], "#24362b"))
    roads = "".join(line(r, "#3a3d46", 3) for r in [
        [(35.735, 139.70), (35.70, 139.705), (35.66, 139.70), (35.635, 139.705)], [(35.735, 139.745), (35.70, 139.74), (35.66, 139.745), (35.635, 139.75)],
        [(35.71, 139.67), (35.705, 139.72), (35.70, 139.78), (35.705, 139.83)], [(35.68, 139.67), (35.675, 139.74), (35.67, 139.80)],
        [(35.655, 139.67), (35.65, 139.73), (35.648, 139.77)], [(35.735, 139.78), (35.70, 139.775), (35.66, 139.765)]])
    loop = line([(35.728, 139.71), (35.73, 139.77), (35.705, 139.774), (35.68, 139.767), (35.658, 139.745), (35.646, 139.71), (35.66, 139.700), (35.69, 139.700), (35.71, 139.703), (35.728, 139.71)], "#4a4f5c", 4)
    pins = ""
    for p in TOKIO:
        if p["n"] not in TK: continue
        icon, col = cat(p)
        la, lo = TK[p["n"]]
        pins += f'<span style="position: absolute; left: {sx(lo) - 17:.0f}px; top: {sy(la) - 38:.0f}px">{pin(PAL[col], icon)}</span>'
    labels = "".join(f'<span style="position: absolute; left: {sx(lo):.0f}px; top: {sy(la):.0f}px; font-size: 11px; font-weight: 600; letter-spacing: .08em; color: #7d8290">{t}</span>'
                     for t, (la, lo) in {"ASAKUSA": (35.722, 139.80), "SHINJUKU": (35.70, 139.676), "SHIBUYA": (35.652, 139.676), "GINZA": (35.668, 139.752), "BAHÍA DE TOKIO": (35.628, 139.79)}.items())
    pop = ""
    if popup:
        p = next(x for x in TOKIO if x["n"] == popup[0])
        icon, col = cat(p)
        img = scene(PLACE_PHOTO[p["n"]]) if p["n"] in PLACE_PHOTO else ""
        pop = (f'<div style="position: absolute; left: {popup[1]}px; top: {popup[2]}px; width: 230px; border-radius: 10px; overflow: hidden; background: #2b2b2b; border: 1px solid #424242; box-shadow: 0 12px 28px rgba(0,0,0,.5)">'
               f'<div style="height: 96px; background: {PAL[col]}; overflow: hidden">{img}</div><div style="padding: 10px 12px; display: flex; flex-direction: column; gap: 3px">'
               f'<span style="font-size: 14px; font-weight: 600; color: {TX}">{e(p["n"])}</span><span style="font-size: 13px; color: {MUTED}">{e(p["cat"])} · {e(p["price"])}</span>'
               f'<span style="font-size: 13px; color: {MUTED}">Por visitar · {e(p["trip"])}</span></div></div>')
    return (f'<div style="position: relative; width: {w}px; height: {h}px; overflow: hidden; background: #202227">'
            f'<svg width="{w}" height="{h}" aria-hidden="true" style="position: absolute; inset: 0">{bay}{parks}{roads}{loop}{river}</svg>{labels}{pins}{pop}'
            f'<span style="position: absolute; right: 8px; bottom: 6px; font-size: 10px; color: #777">© OpenFreeMap · OpenStreetMap</span></div>')
board("Mezcla-Lugares-Mapa.dc.html", "Lugares · Mapa · escritorio", 1200,
      page(toolbar("map", "Mapa", len(PLACES) + 1), city_map(1200, 640, popup=("Senso-ji", 700, 40)), pad="0"))
board("Mezcla-Lugares-Mapa-Movil.dc.html", "Lugares · Mapa · móvil", 390,
      page(toolbar("map", "Mapa", len(PLACES) + 1, phone=True), city_map(390, 700, popup=("Omoide Yokocho", 40, 360)), pad="0"))
print("ok")
