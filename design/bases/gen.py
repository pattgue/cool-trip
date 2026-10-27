# Tableros del canvas: las vistas de las bases de Viajes y Lugares, dos planteamientos (A «Pasaporte», B «Cuaderno de ruta»),
# cada uno en escritorio y móvil, con las vistas nativas de Bases y con Cool Bases.
# Uso: python3 gen.py <carpeta project> [alturas.json]
import json, sys, os, html

OUT = sys.argv[1]
HEIGHTS = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and os.path.exists(sys.argv[2]) else {}
ICONS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons.json")))

# ---------- tema oscuro de Obsidian y paleta del billete ----------
BG, BG2, CARD, LINE, TX, MUTED, LABEL = "#1e1e1e", "#262626", "#242424", "#363636", "#dcddde", "#a8a8a8", "#9a9a9a"
ACC, INK, CREAM, GRAPH = "#7f6df2", "#141414", "#F4F1EA", "#17191E"
PAL = {"bermellon": "#E8613C", "mostaza": "#EDC14B", "pistacho": "#B5D69A", "cielo": "#9CC9F0", "lavanda": "#C2B3F5", "rosa": "#F5AFC0"}

def ico(name, size=16, color="currentColor", sw=2):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none">{ICONS[name]}</svg>')
def e(s): return html.escape(str(s), quote=True)

# ---------- datos de ejemplo (hoy: 27 oct 2026) ----------
TRIPS = [
    dict(name="2026 - Alemania", short="Alemania", dests=["Berlín"], dates="24 – 30 oct 2026", nights=6, who=["Ana"], col="cielo", st="now", when="Día 4 de 7", year=2026),
    dict(name="2026 - Portugal", short="Portugal", dests=["Lisboa", "Oporto"], dates="4 – 9 dic 2026", nights=5, who=["Ana", "Leo"], col="lavanda", st="next", when="Faltan 38 días", year=2026),
    dict(name="2027 - Japón", short="Japón", dests=["Tokio", "Kioto"], dates="3 – 14 abr 2027", nights=11, who=["Ana", "Leo"], col="bermellon", st="next", when="Faltan 158 días", year=2027),
    dict(name="2027 - Reino Unido", short="Reino Unido", dests=["Edimburgo", "Highlands"], dates="12 – 20 ago 2027", nights=8, who=["Ana", "Leo", "Marta"], col="pistacho", st="next", when="Faltan 289 días", year=2027),
    dict(name="2026 - Italia y Grecia", short="Italia y Grecia", dests=["Roma", "Palermo", "Atenas"], dates="12 – 19 jun 2026", nights=7, who=["Ana", "Leo"], col="mostaza", st="done", when="Hace 4 meses", year=2026),
    dict(name="2025 - México", short="México", dests=["CDMX", "Oaxaca"], dates="2 – 18 nov 2025", nights=16, who=["Ana", "Leo", "Marta"], col="rosa", st="done", when="Hace 1 año", year=2025),
    dict(name="2025 - Islandia", short="Islandia", dests=["Reikiavik"], dates="20 – 27 feb 2025", nights=7, who=["Leo"], col="cielo", st="done", when="Hace 1 año", year=2025),
    dict(name="2024 - Marruecos", short="Marruecos", dests=["Marrakech", "Fez"], dates="10 – 15 oct 2024", nights=5, who=["Ana", "Leo"], col="pistacho", st="done", when="Hace 2 años", year=2024),
]
# categoría → icono (el mismo que usa el plugin) y color de la paleta
CAT = {"Templo": ("landmark", "lavanda"), "Santuario": ("landmark", "lavanda"), "Monumento": ("landmark", "lavanda"), "Museo": ("palette", "cielo"),
       "Restaurante": ("utensils", "bermellon"), "Cafetería": ("coffee", "rosa"), "Mercado": ("store", "mostaza"), "Mirador": ("binoculars", "pistacho"),
       "Parque": ("trees", "pistacho"), "Barrio": ("signpost", "cielo")}
PLACES = [
    dict(n="Senso-ji", city="Tokio", co="Japón", cat="Templo", price="Gratis", rate=0, seen=False, trip="2027 - Japón"),
    dict(n="teamLab Planets", city="Tokio", co="Japón", cat="Museo", price="€€", rate=0, seen=False, trip="2027 - Japón"),
    dict(n="Omoide Yokocho", city="Tokio", co="Japón", cat="Restaurante", price="€€", rate=0, seen=False, trip="2027 - Japón"),
    dict(n="Tsukiji Outer Market", city="Tokio", co="Japón", cat="Mercado", price="€", rate=0, seen=False, trip="2027 - Japón"),
    dict(n="Fushimi Inari", city="Kioto", co="Japón", cat="Santuario", price="Gratis", rate=0, seen=False, trip="2027 - Japón"),
    dict(n="Mercado de Nishiki", city="Kioto", co="Japón", cat="Mercado", price="€", rate=0, seen=False, trip="2027 - Japón"),
    dict(n="Miradouro da Graça", city="Lisboa", co="Portugal", cat="Mirador", price="Gratis", rate=0, seen=False, trip="2026 - Portugal"),
    dict(n="Pastéis de Belém", city="Lisboa", co="Portugal", cat="Cafetería", price="€", rate=0, seen=False, trip="2026 - Portugal"),
    dict(n="Galleria Borghese", city="Roma", co="Italia", cat="Museo", price="€€", rate=5, seen=True, trip="2026 - Italia y Grecia"),
    dict(n="Pantheon", city="Roma", co="Italia", cat="Monumento", price="Gratis", rate=5, seen=True, trip="2026 - Italia y Grecia"),
    dict(n="Da Enzo al 29", city="Roma", co="Italia", cat="Restaurante", price="€€", rate=4, seen=True, trip="2026 - Italia y Grecia"),
    dict(n="Mercato di Ballarò", city="Palermo", co="Italia", cat="Mercado", price="€", rate=4, seen=True, trip="2026 - Italia y Grecia"),
    dict(n="Antica Focacceria", city="Palermo", co="Italia", cat="Restaurante", price="€", rate=5, seen=True, trip="2026 - Italia y Grecia"),
    dict(n="Café de Tacuba", city="CDMX", co="México", cat="Restaurante", price="€€", rate=4, seen=True, trip="2025 - México"),
]
def cat(p): return CAT[p["cat"]]
def stars(n, size=13, on=INK, off="rgba(20,20,20,.25)"):
    return "".join(f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="{on if i < n else "none"}" stroke="{on if i < n else off}" stroke-width="2" stroke-linejoin="round" aria-hidden="true">{ICONS["star"]}</svg>' for i in range(5))

# ---------- el tablero ----------
def board(fname, title, w, body, bg=BG):
    h = HEIGHTS.get(fname, 900)
    src = f'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>{e(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&amp;display=swap">
<style>
body{{margin:0}}
html,body{{overflow:hidden}}
</style>
</helmet>
<div style="width: {w}px; min-height: {h}px; box-sizing: border-box; background: {bg}; color: {TX}; font-family: Inter, system-ui, sans-serif; display: flex; flex-direction: column">
{body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''
    open(os.path.join(OUT, fname), "w").write(src)

# ---------- piezas de Obsidian: la barra de la base y el menú de vistas ----------
def ibtn(name, label):
    return (f'<button type="button" aria-label="{e(label)}" style="width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; '
            f'color: {MUTED}; display: inline-flex; align-items: center; justify-content: center; padding: 0">{ico(name, 16)}</button>')
def toolbar(view_icon, view, n, phone=False, cool=False):
    left = (f'<button type="button" style="height: 32px; padding: 0 10px; border: 0; border-radius: 6px; background: {BG2}; color: {TX}; '
            f'font: inherit; font-size: {15 if phone else 14}px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px">'
            f'{ico(view_icon, 15, MUTED)}<span>{e(view)}</span>{ico("chevron-down", 14, MUTED)}</button>')
    if phone:
        right = ibtn("search", "Buscar") + ibtn("sliders-horizontal", "Ordenar, filtrar y propiedades") + ibtn("plus", "Nueva nota")
        count = ""
    else:
        count = f'<span style="font-size: 13px; color: {LABEL}; margin-right: 6px">{n} resultados</span>'
        right = (ibtn("arrow-up-down", "Ordenar") + ibtn("list-filter", "Filtrar") + ibtn("list", "Propiedades") + ibtn("search", "Buscar")
                 + f'<button type="button" style="height: 32px; padding: 0 12px; margin-left: 4px; border: 0; border-radius: 6px; background: {BG2}; color: {TX}; font: inherit; font-size: 13px; display: inline-flex; align-items: center; gap: 6px">{ico("plus", 14)}Nuevo</button>')
    edit = ""
    if cool:
        edit = (f'<button type="button" style="height: 32px; padding: 0 12px; margin-left: {4 if phone else 8}px; border: 0; border-radius: 6px; background: {BG2}; color: {TX}; '
                f'font: inherit; font-size: 13px; display: inline-flex; align-items: center; gap: 6px">{ico("pencil", 14)}{"" if phone else "Editar tarjeta"}</button>')
        if phone: edit = edit.replace('gap: 6px">', 'gap: 6px" aria-label="Editar tarjeta">')
    pad = "8px 12px" if phone else "10px 24px"
    return (f'<div style="display: flex; align-items: center; gap: 2px; padding: {pad}; border-bottom: 1px solid {LINE}">{left}'
            f'<span style="flex: 1"></span>{count}{right}{edit}</div>')
def views_menu(items, current, top=50, left=24):
    rows = "".join(
        f'<span style="display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: 6px; font-size: 14px; '
        f'{"background: #34323f; color: #fff" if name == current else f"color: {TX}"}">{ico(icon, 15, MUTED)}<span style="flex: 1">{e(name)}</span>'
        f'<span style="font-size: 12px; color: {LABEL}">{e(hint)}</span>{ico("check", 14, ACC) if name == current else ""}</span>'
        for icon, name, hint in items)
    return (f'<div role="menu" aria-label="Vistas de la base" style="position: absolute; top: {top}px; left: {left}px; width: 330px; padding: 6px; border-radius: 8px; '
            f'background: #2b2b2b; border: 1px solid #424242; box-shadow: 0 12px 32px rgba(0,0,0,.45); display: flex; flex-direction: column; gap: 2px; z-index: 2">{rows}'
            f'<span style="height: 1px; background: {LINE}; margin: 4px 0"></span>'
            f'<span style="display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; font-size: 14px; color: {MUTED}">{ico("plus", 15)}Añadir vista</span></div>')
def group_head(text, n, phone=False, color=TX):
    return (f'<div style="display: flex; align-items: baseline; gap: 8px; padding: {"14px 0 8px" if phone else "18px 0 10px"}">'
            f'<span style="font-size: {15 if phone else 15}px; font-weight: 600; color: {color}">{e(text)}</span><span style="font-size: 13px; color: {LABEL}">{n}</span></div>')

# ---------- vistas nativas ----------
def ncard(cover, title, lines, w=None, cover_h=96, inner=""):
    width = f"width: {w}px; " if w else ""
    ls = "".join(f'<span style="font-size: 13px; color: {MUTED}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{l}</span>' for l in lines)
    return (f'<div style="{width}min-width: 0; border-radius: 8px; overflow: hidden; background: {CARD}; border: 1px solid {LINE}; display: flex; flex-direction: column">'
            f'<div style="height: {cover_h}px; background: {cover}; display: flex; align-items: center; justify-content: center">{inner}</div>'
            f'<div style="padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px"><span style="font-size: 14px; font-weight: 600; color: {TX}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e(title)}</span>{ls}</div></div>')
def ngrid(cards, cols, gap=16):
    return f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: {gap}px">{"".join(cards)}</div>'
def ntable(cols, rows, widths, foot=None, phone=False):
    tpl = " ".join(widths)
    head = "".join(f'<span style="display: flex; align-items: center; gap: 6px; padding: 0 10px; height: 36px; border-right: 1px solid {LINE}; font-size: 13px; color: {MUTED}; white-space: nowrap; overflow: hidden">{ico(i, 14, LABEL)}{e(c)}</span>' for i, c in cols)
    body = ""
    for r in rows:
        cells = ""
        for k, c in enumerate(r):
            cells += f'<span style="display: flex; align-items: center; gap: 6px; padding: 0 10px; height: 38px; border-right: 1px solid {LINE}; font-size: 14px; color: {TX if k else "#e7e7e7"}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis{"; font-weight: 500" if not k else ""}">{c}</span>'
        body += f'<div style="display: grid; grid-template-columns: {tpl}; border-top: 1px solid {LINE}">{cells}</div>'
    if foot:
        body += f'<div style="display: grid; grid-template-columns: {tpl}; border-top: 1px solid {LINE}">' + "".join(f'<span style="padding: 0 10px; height: 34px; display: flex; align-items: center; font-size: 12px; color: {LABEL}">{c}</span>' for c in foot) + "</div>"
    return (f'<div style="border: 1px solid {LINE}; border-radius: 8px; overflow: hidden; {"width: max-content" if phone else ""}">'
            f'<div style="display: grid; grid-template-columns: {tpl}; background: {BG2}">{head}</div>{body}</div>')
def check(on):
    return (f'<span style="width: 16px; height: 16px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; '
            f'{"background: " + ACC if on else "border: 1.5px solid #5a5a5a"}">{ico("check", 12, "#fff", 3) if on else ""}</span>')
def link(t): return f'<span style="color: {ACC}; text-decoration: underline; text-decoration-color: rgba(127,109,242,.4)">{e(t)}</span>'

def page(toolbar_html, content, pad="8px 24px 32px", extra=""):
    return f'<div style="position: relative; display: flex; flex-direction: column">{toolbar_html}{extra}<div style="padding: {pad}; display: flex; flex-direction: column">{content}</div></div>'

# =====================================================================================================
# A · «Pasaporte»: viajes como tarjetas de embarque de su color; lugares como etiquetas de equipaje
# =====================================================================================================
A_TRIP_VIEWS = [("layout-grid", "Próximos", "Tarjetas"), ("layout-grid", "Viajados", "Tarjetas · por año"), ("table", "Todos", "Tabla")]
A_PLACE_VIEWS = [("layout-grid", "Por visitar", "Tarjetas · por ciudad"), ("layout-grid", "Favoritos", "Tarjetas"),
                 ("table", "Por ciudad", "Tabla"), ("list", "En el viaje abierto", "Lista · barra lateral")]
upcoming = [t for t in TRIPS if t["st"] in ("now", "next")]
done = [t for t in TRIPS if t["st"] == "done"]

# --- Viajes · escritorio · nativo: «Próximos» con la portada de color (una fórmula da el #hex del billete) ---
cards = [ncard(PAL[t["col"]], t["name"], [f'<b style="color: {TX}; font-weight: 600">{e(t["when"])}</b>', e(t["dates"]) + f' · {t["nights"]} noches', e(" · ".join(t["dests"])), e(", ".join(t["who"]))], cover_h=110) for t in upcoming]
board("Bases-A-Viajes.dc.html", "A · Viajes · escritorio · sin Cool Bases", 1200,
      page(toolbar("layout-grid", "Próximos", len(upcoming)), ngrid(cards, 4), extra=views_menu(A_TRIP_VIEWS, "Próximos", top=48)).replace('padding: 8px 24px 32px', 'padding: 24px 24px 32px; padding-top: 230px'))

# --- Viajes · escritorio · Cool Bases: tarjetas de embarque ---
def pass_card(t, w=258, h=340, phone=False):
    c = PAL[t["col"]]
    kicker = t["when"].upper()
    state = (f'<span style="align-self: flex-start; font-size: 10px; font-weight: 800; letter-spacing: .14em; padding: 4px 8px; border-radius: 999px; background: {INK}; color: {c}">EN CURSO</span>'
             if t["st"] == "now" else "")
    tags = "".join(f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .1em; padding: 3px 7px; border-radius: 999px; border: 1.5px solid {INK}">{e(p.upper())}</span>' for p in t["who"])
    title_fs = 44 if len(t["short"]) <= 6 else 36 if len(t["short"]) <= 8 else 30
    return (f'<div style="width: {w}px; height: {h}px; box-sizing: border-box; padding: 18px; border-radius: 14px; background: {c}; color: {INK}; display: flex; flex-direction: column; gap: 8px">'
            f'<span style="display: flex; justify-content: space-between; align-items: center; gap: 8px"><span style="font-size: 11px; font-weight: 800; letter-spacing: .14em">{e(kicker)}</span>{state}</span>'
            f'<span style="flex: 1"></span>'
            f'<span style="font-size: 11px; font-weight: 800; letter-spacing: .14em">{t["year"]} · {e(" · ".join(t["dests"]).upper())}</span>'
            f'<span style="font-size: {title_fs}px; font-weight: 900; letter-spacing: -1.5px; line-height: .95">{e(t["short"].upper())}</span>'
            f'<span style="height: 2px; background: {INK}; margin: 6px 0 4px"></span>'
            f'<span style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 700"><span>{e(t["dates"])}</span><span>{t["nights"]} noches</span></span>'
            f'<span style="display: flex; gap: 5px; flex-wrap: wrap">{tags}</span></div>')
board("Bases-A-Viajes-CB.dc.html", "A · Viajes · escritorio · Cool Bases", 1200,
      page(toolbar("layout-grid", "Próximos", len(upcoming), cool=True),
           f'<div style="display: flex; gap: 20px; flex-wrap: wrap; padding-top: 16px">{"".join(pass_card(t) for t in upcoming)}</div>'))

# --- Viajes · móvil · nativo: «Viajados», por año ---
body = ""
for y in (2026, 2025, 2024):
    ts = [t for t in done if t["year"] == y]
    body += group_head(str(y), len(ts), phone=True) + ngrid([ncard(PAL[t["col"]], t["name"], [e(t["dates"]), f'{t["nights"]} noches · ' + e(", ".join(t["who"]))], cover_h=64) for t in ts], 2, 10)
board("Bases-A-Viajes-Movil.dc.html", "A · Viajes · móvil · sin Cool Bases", 390,
      page(toolbar("layout-grid", "Viajados", len(done), phone=True), body, pad="0 12px 32px"))

# --- Viajes · móvil · Cool Bases: «Viajados», talones apaisados ---
def stub(t):
    c = PAL[t["col"]]
    return (f'<div style="box-sizing: border-box; height: 132px; padding: 14px 16px; border-radius: 14px; background: {c}; color: {INK}; display: flex; flex-direction: column; gap: 4px">'
            f'<span style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; letter-spacing: .14em"><span>{e(t["dates"].upper())}</span><span>{t["nights"]} NOCHES</span></span>'
            f'<span style="flex: 1"></span>'
            f'<span style="font-size: 34px; font-weight: 900; letter-spacing: -1.2px; line-height: .95">{e(t["short"].upper())}</span>'
            f'<span style="font-size: 12px; font-weight: 700">{e(" → ".join(t["dests"]))} · {e(", ".join(t["who"]))}</span></div>')
body = ""
for y in (2026, 2025, 2024):
    ts = [t for t in done if t["year"] == y]
    body += group_head(str(y), len(ts), phone=True) + f'<div style="display: flex; flex-direction: column; gap: 10px">{"".join(stub(t) for t in ts)}</div>'
board("Bases-A-Viajes-CB-Movil.dc.html", "A · Viajes · móvil · Cool Bases", 390,
      page(toolbar("layout-grid", "Viajados", len(done), phone=True, cool=True), body, pad="0 12px 32px"))

# --- Lugares · escritorio · nativo: «Por visitar», por ciudad, portada del color de la categoría ---
todo = [p for p in PLACES if not p["seen"]]
body = ""
for city in ("Tokio", "Kioto", "Lisboa"):
    ps = [p for p in todo if p["city"] == city]
    body += group_head(city, len(ps)) + ngrid([ncard(PAL[cat(p)[1]], p["n"], [e(p["cat"]) + " · " + e(p["price"]), link(p["trip"])], cover_h=72) for p in ps], 5, 14)
board("Bases-A-Lugares.dc.html", "A · Lugares · escritorio · sin Cool Bases", 1200,
      page(toolbar("layout-grid", "Por visitar", len(todo)), body, extra=views_menu(A_PLACE_VIEWS, "Por visitar", top=48)).replace('padding: 8px 24px 32px', 'padding: 8px 24px 32px; padding-top: 250px'))

# --- Lugares · escritorio · Cool Bases: etiquetas de equipaje (casilla «Visitado» en la tarjeta) ---
def tag_card(p, w=208, rating=False):
    icon, col = cat(p)
    box = (f'<span style="position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 7px; background: {CREAM}; display: inline-flex; align-items: center; justify-content: center">'
           f'{ico("check", 16, INK, 3) if p["seen"] else ""}</span>')
    rate = f'<span style="display: flex; gap: 2px">{stars(p["rate"])}</span>' if rating else ""
    return (f'<div style="width: {w}px; box-sizing: border-box; border-radius: 12px; overflow: hidden; background: {CREAM}; color: {INK}; display: flex; flex-direction: column">'
            f'<div style="position: relative; height: 92px; background: {PAL[col]}; display: flex; align-items: center; justify-content: center">{ico(icon, 34, INK, 1.8)}{box}'
            '</div>'
            f'<div style="padding: 14px 14px 14px; display: flex; flex-direction: column; gap: 6px">'
            f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .14em; color: rgba(20,20,20,.62)">{e(p["cat"].upper())} · {e(p["price"].upper())}</span>'
            f'<span style="font-size: 17px; font-weight: 800; line-height: 1.15; letter-spacing: -.2px">{e(p["n"])}</span>{rate}'
            f'<span style="height: 1.5px; background: {INK}; opacity: .85; margin-top: 2px"></span>'
            f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .06em">{e(p["trip"].upper())}</span></div></div>')
body = ""
for city in ("Tokio", "Kioto", "Lisboa"):
    ps = [p for p in todo if p["city"] == city]
    body += group_head(f'{city} · {ps[0]["co"]}', len(ps)) + f'<div style="display: flex; gap: 16px; flex-wrap: wrap">{"".join(tag_card(p) for p in ps)}</div>'
board("Bases-A-Lugares-CB.dc.html", "A · Lugares · escritorio · Cool Bases", 1200,
      page(toolbar("layout-grid", "Por visitar", len(todo), cool=True), body))

# --- Lugares · móvil · nativo: «Favoritos» (valoración 4 o más), con las estrellas de una fórmula ---
fav = sorted([p for p in PLACES if p["rate"] >= 4], key=lambda p: -p["rate"])
def txt_stars(n): return f'<span style="color: {PAL["mostaza"]}; letter-spacing: 1px">{"★" * n}</span><span style="color: #555; letter-spacing: 1px">{"★" * (5 - n)}</span>'
board("Bases-A-Lugares-Movil.dc.html", "A · Lugares · móvil · sin Cool Bases", 390,
      page(toolbar("layout-grid", "Favoritos", len(fav), phone=True),
           f'<div style="height: 12px"></div>' + ngrid([ncard(PAL[cat(p)[1]], p["n"], [txt_stars(p["rate"]), e(p["city"]) + " · " + e(p["cat"])], cover_h=56) for p in fav], 2, 10), pad="0 12px 32px"))

# --- Lugares · móvil · Cool Bases: «Favoritos» ---
board("Bases-A-Lugares-CB-Movil.dc.html", "A · Lugares · móvil · Cool Bases", 390,
      page(toolbar("layout-grid", "Favoritos", len(fav), phone=True, cool=True),
           f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding-top: 12px">{"".join(tag_card(p, w=177, rating=True) for p in fav)}</div>', pad="0 12px 32px"))

# =====================================================================================================
# B · «Cuaderno de ruta»: todo en una línea de tiempo (en curso, próximos, hechos) y una guía de lugares por ciudad
# =====================================================================================================
B_TRIP_VIEWS = [("table", "Línea de tiempo", "Tabla · por estado"), ("layout-grid", "Por año", "Tarjetas"), ("table", "Con quién", "Tabla · por viajero")]
B_PLACE_VIEWS = [("table", "Guía por ciudad", "Tabla · por ciudad"), ("layout-grid", "Para comer", "Tarjetas"), ("layout-grid", "Para ver", "Tarjetas"),
                 ("list", "En el viaje abierto", "Lista · barra lateral")]
STATES = [("now", "En curso", PAL["cielo"]), ("next", "Próximos", ACC), ("done", "Hechos", MUTED)]

# --- Viajes · escritorio · nativo: «Línea de tiempo», tabla agrupada por estado (una fórmula) ---
cols = [("file-text", "Viaje"), ("calendar", "Fechas"), ("hourglass", "Cuándo"), ("clock-3", "Noches"), ("map-pin", "Destinos"), ("users", "Viajeros")]
widths = ["220px", "170px", "150px", "90px", "minmax(0, 1fr)", "180px"]
body = ""
for st, label, color in STATES:
    ts = [t for t in TRIPS if t["st"] == st]
    rows = [[link(t["name"]), e(t["dates"]), e(t["when"]), str(t["nights"]), e(", ".join(t["dests"])), e(", ".join(t["who"]))] for t in ts]
    body += group_head(label, len(ts), color=color) + ntable(cols, rows, widths, foot=["", "", "", f'Suma {sum(t["nights"] for t in ts)}', "", ""])
board("Bases-B-Viajes.dc.html", "B · Viajes · escritorio · sin Cool Bases", 1200,
      page(toolbar("table", "Línea de tiempo", len(TRIPS)), body, extra=views_menu(B_TRIP_VIEWS, "Línea de tiempo", top=48)).replace('padding: 8px 24px 32px', 'padding: 8px 24px 32px; padding-top: 196px'))

# --- Viajes · escritorio · Cool Bases: talones de billete en fila ---
def ticket_row(t, phone=False):
    c = PAL[t["col"]]
    left_w = 96 if phone else 150
    state = {"now": ("EN CURSO", INK, c), "next": (t["when"].upper(), INK, c), "done": (t["when"].upper(), "transparent", INK)}[t["st"]]
    pill = (f'<span style="flex: none; font-size: 10px; font-weight: 800; letter-spacing: .12em; padding: 4px 9px; border-radius: 999px; '
            f'background: {state[1]}; color: {state[2]}; {"border: 1.5px solid " + INK if t["st"] == "done" else ""}">{e(state[0])}</span>')
    meta = f'{e(t["dates"])} · {t["nights"]} noches · {e(", ".join(t["who"]))}'
    return (f'<div style="display: flex; border-radius: 12px; overflow: hidden; background: {CREAM}; color: {INK}; {"height: 112px" if phone else "height: 108px"}">'
            f'<div style="flex: none; width: {left_w}px; background: {c}; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; border-right: 2px dashed rgba(20,20,20,.35)">'
            f'<span style="font-size: {26 if phone else 34}px; font-weight: 900; letter-spacing: -1px; line-height: 1">{t["year"]}</span>'
            f'<span style="font-size: 10px; font-weight: 800; letter-spacing: .16em">{e(t["dates"].split(" ")[-2].upper())}</span></div>'
            f'<div style="flex: 1; min-width: 0; padding: {"12px 14px" if phone else "16px 22px"}; display: flex; flex-direction: column; justify-content: center; gap: 4px">'
            f'<span style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; min-width: 0; font-size: {22 if phone else 26}px; font-weight: 900; letter-spacing: -.6px; line-height: 1">{e(t["short"].upper())}</span>{"" if phone else pill}</span>'
            f'<span style="font-size: {13 if phone else 14}px; font-weight: 700">{e(" → ".join(t["dests"]))}</span>'
            f'<span style="font-size: {12 if phone else 13}px; color: rgba(20,20,20,.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{meta}</span>'
            f'{pill.replace("flex: none;", "flex: none; align-self: flex-start; margin-top: 2px;") if phone else ""}</div></div>')
body = ""
for st, label, color in STATES:
    ts = [t for t in TRIPS if t["st"] == st]
    body += group_head(label, len(ts), color=color) + f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px">{"".join(ticket_row(t) for t in ts)}</div>'
board("Bases-B-Viajes-CB.dc.html", "B · Viajes · escritorio · Cool Bases", 1200,
      page(toolbar("table", "Línea de tiempo", len(TRIPS), cool=True), body))

# --- Viajes · móvil · nativo: la misma tabla (en el móvil se desliza de lado) ---
mcols = [("file-text", "Viaje"), ("calendar", "Fechas"), ("hourglass", "Cuándo")]
body = ""
for st, label, color in STATES:
    ts = [t for t in TRIPS if t["st"] == st]
    body += group_head(label, len(ts), phone=True, color=color) + f'<div style="overflow: hidden; margin-right: -12px">{ntable(mcols, [[link(t["name"]), e(t["dates"]), e(t["when"])] for t in ts], ["150px", "150px", "130px"], phone=True)}</div>'
board("Bases-B-Viajes-Movil.dc.html", "B · Viajes · móvil · sin Cool Bases", 390,
      page(toolbar("table", "Línea de tiempo", len(TRIPS), phone=True), body, pad="0 12px 32px"))

# --- Viajes · móvil · Cool Bases ---
body = ""
for st, label, color in STATES:
    ts = [t for t in TRIPS if t["st"] == st]
    body += group_head(label, len(ts), phone=True, color=color) + f'<div style="display: flex; flex-direction: column; gap: 10px">{"".join(ticket_row(t, phone=True) for t in ts)}</div>'
board("Bases-B-Viajes-CB-Movil.dc.html", "B · Viajes · móvil · Cool Bases", 390,
      page(toolbar("table", "Línea de tiempo", len(TRIPS), phone=True, cool=True), body, pad="0 12px 32px"))

# --- Lugares · escritorio · nativo: «Guía por ciudad», tabla con la casilla de visitado ---
cols = [("file-text", "Lugar"), ("list", "Categoría"), ("star", "Valoración"), ("square-check", "Visitado"), ("plane", "Viajes")]
widths = ["240px", "160px", "130px", "100px", "minmax(0, 1fr)"]
body = ""
for city in ("Tokio", "Kioto", "Lisboa", "Roma", "Palermo"):
    ps = [p for p in PLACES if p["city"] == city]
    rows = [[link(p["n"]), e(p["cat"]) + f' <span style="color: {LABEL}">· {e(p["price"])}</span>', txt_stars(p["rate"]) if p["rate"] else "", check(p["seen"]), link(p["trip"])] for p in ps]
    body += group_head(f'{city} · {ps[0]["co"]}', len(ps)) + ntable(cols, rows, widths)
board("Bases-B-Lugares.dc.html", "B · Lugares · escritorio · sin Cool Bases", 1200,
      page(toolbar("table", "Guía por ciudad", len(PLACES) - 1), body, extra=views_menu(B_PLACE_VIEWS, "Guía por ciudad", top=48)).replace('padding: 8px 24px 32px', 'padding: 8px 24px 32px; padding-top: 236px'))

# --- Lugares · escritorio · Cool Bases: filas de guía (icono, nombre, categoría, estrellas y casilla) ---
def guide_row(p, phone=False):
    icon, col = cat(p)
    box = (f'<span style="flex: none; width: 26px; height: 26px; border-radius: 7px; border: 2px solid {INK}; display: inline-flex; align-items: center; justify-content: center; {"background: " + INK if p["seen"] else ""}">'
           f'{ico("check", 15, CREAM, 3) if p["seen"] else ""}</span>')
    rate = f'<span style="display: flex; gap: 1px">{stars(p["rate"], 12)}</span>' if p["rate"] else f'<span style="font-size: 11px; font-weight: 700; letter-spacing: .08em; color: rgba(20,20,20,.55)">{e(p["trip"].upper())}</span>'
    return (f'<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 10px; border-radius: 12px; background: {CREAM}; color: {INK}">'
            f'<span style="flex: none; width: 52px; height: 52px; border-radius: 9px; background: {PAL[col]}; display: inline-flex; align-items: center; justify-content: center">{ico(icon, 24, INK, 1.9)}</span>'
            f'<span style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px"><span style="font-size: 15px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{e(p["n"])}</span>'
            f'<span style="font-size: 12px; font-weight: 600; color: rgba(20,20,20,.7)">{e(p["cat"])} · {e(p["price"])}</span>{rate}</span>{box}</div>')
body = ""
for city in ("Tokio", "Kioto", "Lisboa", "Roma", "Palermo"):
    ps = [p for p in PLACES if p["city"] == city]
    body += group_head(f'{city} · {ps[0]["co"]}', len(ps)) + f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px">{"".join(guide_row(p) for p in ps)}</div>'
board("Bases-B-Lugares-CB.dc.html", "B · Lugares · escritorio · Cool Bases", 1200,
      page(toolbar("table", "Guía por ciudad", len(PLACES) - 1, cool=True), body))

# --- Lugares · móvil · nativo: «Para comer» ---
food = [p for p in PLACES if p["cat"] in ("Restaurante", "Cafetería", "Mercado")]
body = ""
for city in ("Tokio", "Kioto", "Lisboa", "Roma", "Palermo", "CDMX"):
    ps = [p for p in food if p["city"] == city]
    if ps: body += group_head(city, len(ps), phone=True) + ngrid([ncard(PAL[cat(p)[1]], p["n"], [e(p["cat"]) + " · " + e(p["price"]), ("Visitado" if p["seen"] else "Por visitar")], cover_h=52) for p in ps], 2, 10)
board("Bases-B-Lugares-Movil.dc.html", "B · Lugares · móvil · sin Cool Bases", 390,
      page(toolbar("layout-grid", "Para comer", len(food), phone=True), body, pad="0 12px 32px"))

# --- Lugares · móvil · Cool Bases: «Para comer» ---
body = ""
for city in ("Tokio", "Kioto", "Lisboa", "Roma", "Palermo", "CDMX"):
    ps = [p for p in food if p["city"] == city]
    if ps: body += group_head(city, len(ps), phone=True) + f'<div style="display: flex; flex-direction: column; gap: 8px">{"".join(guide_row(p, phone=True) for p in ps)}</div>'
board("Bases-B-Lugares-CB-Movil.dc.html", "B · Lugares · móvil · Cool Bases", 390,
      page(toolbar("layout-grid", "Para comer", len(food), phone=True, cool=True), body, pad="0 12px 32px"))
print("ok")
