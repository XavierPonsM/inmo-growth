"""Construye public/municipios.json a partir de datos abiertos.
Fuentes: INE tabla 29005 (padrón por municipio) + Wikidata (coordenadas, código INE P772).
Uso: python3 -I scripts/build_dataset.py
"""
import csv, json, math, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
raw = json.load(open(ROOT / "data/raw/pob.json"))
coords = {r["ine"]: (float(r["lat"]), float(r["lon"])) for r in csv.DictReader(open(ROOT / "data/raw/coords.csv"))}

pop = {}
for s in raw:
    md = {m["T3_Variable"]: m for m in s["MetaData"]}
    if md["Sexo"]["Codigo"] != "0":
        continue
    code = md["Municipios"]["Codigo"]
    pop[code] = {"name": md["Municipios"]["Nombre"], "series": {d["Anyo"]: d["Valor"] for d in s["Data"] if d["Valor"] is not None}}

PROV = {"01":"Álava","02":"Albacete","03":"Alicante","04":"Almería","05":"Ávila","06":"Badajoz","07":"Baleares","08":"Barcelona","09":"Burgos","10":"Cáceres","11":"Cádiz","12":"Castellón","13":"Ciudad Real","14":"Córdoba","15":"A Coruña","16":"Cuenca","17":"Girona","18":"Granada","19":"Guadalajara","20":"Gipuzkoa","21":"Huelva","22":"Huesca","23":"Jaén","24":"León","25":"Lleida","26":"La Rioja","27":"Lugo","28":"Madrid","29":"Málaga","30":"Murcia","31":"Navarra","32":"Ourense","33":"Asturias","34":"Palencia","35":"Las Palmas","36":"Pontevedra","37":"Salamanca","38":"S.C. Tenerife","39":"Cantabria","40":"Segovia","41":"Sevilla","42":"Soria","43":"Tarragona","44":"Teruel","45":"Toledo","46":"Valencia","47":"Valladolid","48":"Bizkaia","49":"Zamora","50":"Zaragoza","51":"Ceuta","52":"Melilla"}

rows = []
for code, v in pop.items():
    s = v["series"]
    years = sorted(s)
    if code not in coords or len(years) < 6:
        continue
    y0, y1 = years[0], years[-1]
    p0, p1, pprev = s[y0], s[y1], s[years[-2]]
    if p0 <= 0:
        continue
    g5 = (p1 / p0 - 1) * 100
    g1 = (p1 / pprev - 1) * 100
    # crecimiento absoluto (personas) y anualizado compuesto
    cagr = ((p1 / p0) ** (1 / (y1 - y0)) - 1) * 100
    rows.append({"id": code, "n": v["name"], "p": code[:2], "pop": int(p1), "p0": int(p0), "abs": int(p1 - p0),
                 "g5": round(g5, 2), "g1": round(g1, 2), "cagr": round(cagr, 2),
                 "lat": round(coords[code][0], 4), "lon": round(coords[code][1], 4)})

# Índice de crecimiento (0-100): percentil ponderado entre municipios con >= 1000 hab.
def pct_rank(vals):
    order = sorted(vals)
    n = len(order)
    import bisect
    return lambda x: bisect.bisect_left(order, x) / max(n - 1, 1) * 100

# Gasto público: inversión real (cap. 6) del ayuntamiento, € por habitante (Hacienda, CONPREL)
gasto = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/gasto_cap6.csv"))}
for r in rows:
    g = gasto.get(r["id"])
    pcs = []  # €/hab de los años con dato (>0); la media 2019/2024 suaviza obras puntuales
    if g:
        if float(g["inv2019"]) > 0:
            pcs.append(float(g["inv2019"]) / r["p0"])
        if float(g["inv2024"]) > 0:
            pcs.append(float(g["inv2024"]) / r["pop"])
    if pcs:
        r["inv"] = round(sum(pcs) / len(pcs))
        has24 = float(g["inv2024"]) > 0
        r["inv24"] = round(float(g["inv2024"]) / r["pop"]) if has24 else None
        r["invT"] = round(float(g["inv2024"])) if has24 else None  # total 2024 (€)
    else:
        r["inv"] = r["inv24"] = r["invT"] = None
    del r["p0"]

# Negocios (OpenStreetMap): supermercados, gimnasios y hostelería.
# Con --historico en fetch_osm.py hay datos de nov-2020 y se mide el crecimiento; si no, solo la densidad actual.
osm = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/osm_counts.csv"))}
HIST = "super_2020" in next(iter(osm.values()))
_first = next(iter(osm.values()))
NEG_W = {c: w for c, w in {"super": 5, "gym": 3, "horeca": 1}.items() if f"{c}_now" in _first}  # un supermercado "pesa" más que un bar
for r in rows:
    o = osm.get(r["id"])
    if o:
        now = {c: int(o[f"{c}_now"]) for c in NEG_W}
        r["sup"], r["gym"], r["hor"] = now["super"], now["gym"], now.get("horeca")
        if HIST:
            old = {c: int(o[f"{c}_2020"]) for c in NEG_W}
            r["dS"], r["dG"], r["dH"] = now["super"] - old["super"], now["gym"] - old["gym"], (now["horeca"] - old["horeca"] if "horeca" in now else None)
            # negocios nuevos ponderados por 1.000 hab. (neto: aperturas - cierres, según OSM)
            r["negPc"] = round(sum(NEG_W[c] * (now[c] - old[c]) for c in NEG_W) / r["pop"] * 1000, 2)
        else:
            r["dS"] = r["dG"] = r["dH"] = None
            # servicios comerciales ponderados por 1.000 hab. (nivel actual)
            r["negPc"] = round(sum(NEG_W[c] * now[c] for c in NEG_W) / r["pop"] * 1000, 2)
    else:
        r["sup"] = r["gym"] = r["hor"] = r["dS"] = r["dG"] = r["dH"] = r["negPc"] = None

# Universidades (demanda de alquiler de habitaciones): instituciones de Wikidata + campus de OSM
uni = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/universidades.csv", encoding="utf-8"))}
for r in rows:
    u = uni.get(r["id"])
    r["uni"] = int(u["wd"]) if u else 0           # nº de universidades (Wikidata)
    r["uniOsm"] = int(u["osm"]) if u else 0       # nº de elementos de campus en OSM (proxy de tamaño)
    r["uniN"] = (u["names"] if u else "") or None
    r["uniSize"] = 3 * r["uni"] + r["uniOsm"]
    r["uniD"] = float(u["dkm"]) if u and u.get("dkm") else None  # km del centro del municipio al campus más cercano

# Precio del suelo urbano (€/m²): Ministerio de Transportes, por PROVINCIA y TRAMO de población (no existe por municipio)
suelo = {(r["prov"], int(r["tramo"])): r for r in csv.DictReader(open(ROOT / "data/raw/suelo_provincia_tramo.csv"))}
for r in rows:
    tramo = 0 if r["pop"] < 1000 else 1 if r["pop"] < 5000 else 2 if r["pop"] < 10000 else 3 if r["pop"] < 50000 else 4
    s = suelo.get((r["p"], tramo))
    now = float(s["now"]) if s and s["now"] else None
    ago = float(s["ago5"]) if s and s["ago5"] else None
    r["suelo"] = round(now) if now else None
    r["sueloG"] = round((now / ago - 1) * 100) if now and ago else None  # % de variación en 5 años

# Valor tasado de la vivienda libre (€/m²), por municipio, solo >25.000 hab. (Ministerio de Transportes)
tasado = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/tasado_municipios.csv"))}
for r in rows:
    t = tasado.get(r["id"])
    r["vt"] = int(t["now"]) if t else None
    r["vtG"] = round((int(t["now"]) / int(t["ago5"]) - 1) * 100) if t and t["ago5"] else None  # % en 5 años
_vts = {}
for _t in csv.DictReader(open(ROOT / "data/raw/tasado_serie.csv")):
    _vts.setdefault(_t["ine"], []).append([int(_t["anyo"]), int(_t["eur_m2"])])
for r in rows:
    r["vtS"] = sorted(_vts[r["id"]]) if r["id"] in _vts and len(_vts[r["id"]]) >= 3 else None  # [año, €/m²] para la gráfica
    r["vtN"] = int(t["tasaciones"]) if t else None  # nº de tasaciones en los últimos 4 trimestres

# Alquiler: mediana de €/m² al mes y de la renta mensual por municipio (Ministerio de Vivienda, SERPAVI; IRPF + Catastro). Sin País Vasco ni Navarra.
import datetime
ALQ_NOW = datetime.date.today().year
_alq = {}
for _t in csv.DictReader(open(ROOT / "data/raw/alquiler_mun.csv")):
    _alq.setdefault(_t["ine"], []).append((int(_t["anyo"]), float(_t["eur_m2_mes"]), int(_t["renta_mes"]) if _t["renta_mes"] else None))
for r in rows:
    a = sorted(_alq.get(r["id"], []))
    last = a[-1] if a and a[-1][0] >= 2022 else None  # un dato de hace muchos años no sirve como precio actual
    r["alq"] = last[1] if last else None            # €/m² al mes
    r["alqR"] = last[2] if last else None           # renta mensual mediana (€)
    r["alqY"] = last[0] if last else None
    ago = next((x for x in a if last and x[0] == last[0] - 5), None)
    r["alqG"] = round((last[1] / ago[1] - 1) * 100) if last and ago else None  # % en 5 años
    ser = [[y, v] for y, v, _ in a if y >= 2015]
    r["alqS"] = ser if last and len(ser) >= 3 else None
    # El último dato oficial va con dos años de retraso: se lleva a hoy con el ritmo anual de sus tres últimos años (entre 0 % y 8 %).
    # Es una ESTIMACIÓN y la app la marca como tal ("≈"); la serie de la gráfica sigue siendo la oficial.
    prev = next((x for x in a if last and x[0] == last[0] - 3), None)
    rate = min(0.08, max(0.0, (last[1] / prev[1]) ** (1 / 3) - 1)) if last and prev else 0.04
    k = (1 + rate) ** (ALQ_NOW - last[0]) if last else None
    r["alqE"] = round(last[1] * k, 2) if last else None                       # €/m² al mes estimado hoy
    r["alqRE"] = int(round(last[2] * k, -1)) if last and last[2] else None    # renta mensual estimada hoy
    r["alqK"] = round(rate * 100, 1) if last else None                        # ritmo anual aplicado (%)
    # Rentabilidad bruta orientativa: alquiler anual estimado hoy / valor tasado (solo donde hay valor tasado municipal)
    r["rb"] = round(r["alqE"] * 12 / r["vt"] * 100, 1) if last and r["vt"] else None

# Obra pública adjudicada en los últimos 12 meses (Plataforma de Contratación del Sector Público; scripts/process_contratos.py).
# Solo las obras que se pueden ubicar en un municipio: las que solo indican provincia (autovías, AVE...) no entran. No forma parte del índice.
_op = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/obra_publica_mun.csv"))}
_opt = json.load(open(ROOT / "data/raw/obra_publica_top.json", encoding="utf-8"))
for r in rows:
    o = _op.get(r["id"])
    r["op"] = round(int(o["eur"]) / r["pop"]) if o and r["pop"] else None   # € por habitante
    r["opN"] = int(o["n"]) if o else None                                    # nº de obras
    # las 3 mayores: [título, €, fecha, enlace]; solo en municipios de 2.000 hab. o más, para no engordar el fichero que descarga la app
    r["opT"] = ([[t[0][:110], t[1], t[2], t[3]] for t in _opt.get(r["id"], [])] or None) if r["pop"] >= 2000 else None

# Futuro: proyección INE por provincia + suelo disponible y obra nueva (Catastro, 2021 vs 2026; no cubre País Vasco ni Navarra)
proy = {r["prov"]: r for r in csv.DictReader(open(ROOT / "data/raw/proyeccion_prov.csv"))}
cat = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/catastro_futuro.csv"))}
PROY_Y = None
for r in rows:
    pj = proy.get(r["p"])
    r["proy"] = float(pj["pct"]) if pj else None  # % de población provincial 2026-2041
    if pj and PROY_Y is None:
        PROY_Y = [int(pj["y_ini"]), int(pj["y_fin"])]
    c = cat.get(r["id"])
    if c and float(c["superf_urb"] or 0) > 0:
        r["solarN"] = int(c["solares"])                                   # nº de solares (suelo urbano sin construir)
        r["solarPc"] = round(float(c["sup_solar"]) / r["pop"], 1)          # m² de solar por habitante
        r["solarSh"] = round(float(c["sup_solar"]) / float(c["superf_urb"]) * 100)  # % del suelo urbano que es solar
        if c["viv2026"] and c["viv2021"]:
            r["vivN"] = int(c["viv2026"]) - int(c["viv2021"])              # viviendas nuevas en 5 años
            r["vivPm"] = round(r["vivN"] / r["pop"] * 1000, 1)             # por 1.000 habitantes
        else:
            r["vivN"] = r["vivPm"] = None
    else:
        r["solarN"] = r["solarPc"] = r["solarSh"] = r["vivN"] = r["vivPm"] = None

# Proyectos concretos (lista curada a mano, con fuente; informativa, no entra en el índice)
_cur = json.load(open(ROOT / "data/curated/proyectos.json", encoding="utf-8"))["proyectos"]
_by_id = {r["id"]: r for r in rows}
for r in rows:
    r["proj"] = None
for p in _cur:
    r = _by_id.get(p["ine"])
    assert r is not None, f"código INE inexistente en proyectos.json: {p['ine']} ({p['muni']})"
    assert r["n"] == p["muni"], f"el nombre no coincide: {p['ine']} es {r['n']!r}, no {p['muni']!r}"
    r["proj"] = (r["proj"] or []) + [{"t": p["tipo"], "n": p["nombre"], "e": p["estado"], "u": p["url"]}]

# ---- Cercanía a una ciudad grande (más de 100.000 hab.): distancia en línea recta al centro del municipio ----
def _km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


# Red de municipios: cada municipio es un nodo unido a sus vecinos más cercanos (hasta 45 km); el coste de cada arista es la distancia en línea
# recta x 1,3 (circuito medio de carretera). Dijkstra desde las universidades y desde las ciudades grandes da la distancia "por carretera" estimada.
import numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra

_la = np.radians([r["lat"] for r in rows]); _lo = np.radians([r["lon"] for r in rows])
_xyz = 6371 * np.c_[np.cos(_la) * np.cos(_lo), np.cos(_la) * np.sin(_lo), np.sin(_la)]
_dd, _ii = cKDTree(_xyz).query(_xyz, k=9)
_ei, _ej, _ew = [], [], []
for i in range(len(rows)):
    for d, j in zip(_dd[i][1:], _ii[i][1:]):
        if d <= 45:
            _ei.append(i); _ej.append(int(j)); _ew.append(d * 1.3)
GRAPH = coo_matrix((_ew, (_ei, _ej)), shape=(len(rows),) * 2).tocsr()
CIRCUITO_MAX = 45  # km: más allá no se considera accesible a diario

# Ciudades grandes (más de 100.000 hab.): distancia y nombre de la más cercana por la red
_src = [i for i, r in enumerate(rows) if r["pop"] >= 100000]
_D = dijkstra(GRAPH, directed=False, indices=_src, limit=CIRCUITO_MAX * 3)
_best = _D.argmin(axis=0)
for i, r in enumerate(rows):
    d = float(_D[_best[i], i])
    if math.isinf(d):  # isla o zona aislada: línea recta
        j = min(_src, key=lambda k: _km(r, rows[k])); d = _km(r, rows[j]) * 1.3; _best[i] = _src.index(j)
    c = rows[_src[_best[i]]]
    r["dc"] = round(d)                                                    # km por carretera (estimados) hasta la ciudad grande más cercana (0 si lo es)
    r["cn"] = c["n"].split("/")[-1] if "/" in c["n"] else c["n"]          # nombre corto de esa ciudad

# Universidades: para cada municipio, la mejor universidad accesible = tamaño del campus x factor de cercanía exp(-km/12)
# (km = ruta estimada centro a centro + distancia del campus al centro de su municipio). Con campus propio, solo cuenta el campus al centro.
_usrc = [i for i, r in enumerate(rows) if r["uniSize"] > 0 and (r["uni"] > 0 or r["uniOsm"] >= 1)]
_DU = dijkstra(GRAPH, directed=False, indices=_usrc, limit=CIRCUITO_MAX)
_us0 = np.array([min(100.0, 100 * math.log1p(rows[i]["uniSize"]) / math.log1p(40)) for i in _usrc])
_off = np.array([rows[i]["uniD"] or 0.0 for i in _usrc])
_km_u = _DU + _off[:, None]
_val = np.where(np.isfinite(_DU), _us0[:, None] * np.exp(-_km_u / 12), 0.0)
_bu = _val.argmax(axis=0)
for i, r in enumerate(rows):
    k = int(_bu[i])
    r["uniS"] = float(_val[k, i])                                         # puntuación 0-100 de acceso universitario
    if _val[k, i] > 0.5:
        u = rows[_usrc[k]]
        _nm = (u["uniN"] or "Sede universitaria").split("; ")
        _short = u["n"].split("/")[-1]
        _pub = [x for x in _nm if x.startswith(("Universidad de ", "Universitat de ", "Universidade de ", "Universidad Complutense", "Universitat Politècnica"))]
        r["uniNear"] = next((x for x in _nm if _short in x), _pub[0] if _pub else _nm[0])  # universidad (o sede) que más aporta
        r["uniKm"] = round(float(_km_u[k, i]), 1)
        r["uniAt"] = u["n"].split("/")[-1] if _usrc[k] != i else None   # municipio donde está, si no es el propio
    else:
        r["uniNear"] = r["uniKm"] = r["uniAt"] = None

# ---- Edad, paro y costa (INE Atlas de renta, SEPE, Natural Earth) ----
_edad = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/edad_mun.csv"))}
_paro = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/paro_mun.csv"))}
_costa = {r["ine"]: float(r["km"]) for r in csv.DictReader(open(ROOT / "data/raw/costa_mun.csv"))}
for r in rows:
    e = _edad.get(r["id"])
    r["m18"] = float(e["pct_menor18"]) if e and e["pct_menor18"] else None   # % menores de 18 años
    r["edM"] = float(e["edad_media"]) if e and e["edad_media"] else None     # edad media
    r["m65"] = float(e["pct_mayor65"]) if e and e["pct_mayor65"] else None   # % de 65 y más
    r["costa"] = _costa.get(r["id"])                                         # km al mar
    pr = _paro.get(r["id"])
    r["paro"] = r["paroT"] = None
    if pr and r["m18"] is not None and r["m65"] is not None:
        act = r["pop"] * (100 - r["m18"] - r["m65"]) / 100  # población de 18 a 64 años, aprox.
        if act >= 200:
            now = float(pr["paro_now"])
            r["paro"] = round(now / act * 100, 1)                                  # paro registrado / población de 18-64 (%)
            if pr["paro_ago"] != "":
                r["paroT"] = round((now - float(pr["paro_ago"])) / act * 100, 2)  # variación interanual, en puntos

# ---- Calidad de la zona (NO entra en el índice de crecimiento; se muestra aparte y sirve de filtro) ----
# Seguridad: criminalidad convencional por 1.000 hab. (Interior; solo capitales y municipios >20.000 hab.).
# Okupación: allanamiento/usurpación por 10.000 hab., solo PROVINCIAL (Interior no la publica por municipio).
# Nivel socioeconómico: renta neta media por persona y % de población bajo el 60 % de la mediana (INE, Atlas de renta).
crim = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/crimen_mun.csv", encoding="utf-8"))}
usu = {r["prov"]: r for r in csv.DictReader(open(ROOT / "data/raw/usurpacion_prov.csv", encoding="utf-8"))}
renta = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/renta_mun.csv", encoding="utf-8"))}
vac = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/vacias_mun.csv"))}
tur = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/turismo_mun.csv"))}


# Pernoctaciones en alojamientos turísticos (INE, puntos turísticos): se casan por nombre, con o sin artículo y en cualquiera de sus idiomas
def _nkey(n):
    import unicodedata
    out = set()
    for alt in n.split("/"):
        t = unicodedata.normalize("NFD", alt.lower()).encode("ascii", "ignore").decode().strip()
        if "," in t:  # "alcazares, los" -> "los alcazares"
            a_, b_ = [x.strip() for x in t.split(",", 1)]
            t = f"{b_} {a_}"
        out.add(" ".join(t.replace("'", " ").replace("-", " ").split()))
    return out


_pern = {}
_PERN_ALIAS = {"Santa Eulalia": "Santa Eulària des Riu", "San José": "Sant Josep de sa Talaia"}  # el INE abrevia algunos puntos turísticos; sin el alias casaría con otro municipio
for _p in csv.DictReader(open(ROOT / "data/raw/pernoct_puntos.csv", encoding="utf-8")):
    for k in _nkey(_PERN_ALIAS.get(_p["nombre"], _p["nombre"])):
        _pern.setdefault(k, []).append(_p)
_pp = {}
for r in rows:
    _pp[r["p"]] = _pp.get(r["p"], 0) + r["pop"]


def _f(x):
    return float(x) if x not in ("", None) else None


for r in rows:
    c = crim.get(r["id"])
    c25, c24 = (_f(c["c25"]), _f(c["c24"])) if c else (None, None)
    if c25:
        r["crim"] = round(c25 / r["pop"] * 1000, 1)                                  # hechos conocidos por 1.000 hab. (2025)
        r["crimT"] = round((c25 / c24 - 1) * 100) if c24 else None                   # variación frente a 2024
        r["crimV"] = round(sum(_f(c[k]) or 0 for k in ("h25", "l25", "s25", "rv25")) / r["pop"] * 1000, 1)  # violentos: homicidios, lesiones, sexuales, robos con violencia
        r["crimD"] = round((_f(c["rd25"]) or 0) / r["pop"] * 1000, 1)                # robos con fuerza en domicilios por 1.000 hab.
    else:
        r["crim"] = r["crimT"] = r["crimV"] = r["crimD"] = None
    u = usu.get(r["p"])
    if u and _f(u["y2025"]) is not None and _pp.get(r["p"]):
        r["ocup"] = round(_f(u["y2025"]) / _pp[r["p"]] * 10000, 1)                    # por 10.000 hab. de la provincia
        r["ocupT"] = round((_f(u["y2025"]) / _f(u["y2021"]) - 1) * 100) if _f(u["y2021"]) else None  # variación 2021-2025
        r["ocupS"] = [int(_f(u[k]) or 0) for k in ("y2021", "y2022", "y2023", "y2024", "y2025")]  # denuncias en la provincia, 2021-2025
    else:
        r["ocup"] = r["ocupT"] = r["ocupS"] = None
    vc = vac.get(r["id"])
    r["vac"] = round(int(vc["vacias"]) / int(vc["viviendas"]) * 100, 1) if vc and int(vc["viviendas"]) > 0 else None  # % de viviendas vacías (Censo 2021)
    r["vacN"] = int(vc["vacias"]) if vc else None
    t = tur.get(r["id"])
    r["tur"] = float(t["pct"]) if t and t["pct"] != "" else None                  # % de viviendas turísticas (INE, experimental)
    r["turN"] = int(t["viviendas"]) if t and t["viviendas"] != "" else None
    r["turP"] = round(int(t["plazas"]) / r["pop"] * 100, 1) if t and t["plazas"] != "" and r["pop"] else None  # plazas turísticas por 100 hab.
    _hits = {id(p): p for k in _nkey(r["n"]) for p in _pern.get(k, [])}
    if len(_hits) == 1 and r["pop"] >= 1000:
        _p = next(iter(_hits.values()))
        r["pern"] = int(_p["pernoct_ult"])                                       # pernoctaciones al año en alojamientos turísticos
        r["pernH"] = round(int(_p["pernoct_ult"]) / r["pop"], 1)                  # por habitante
        r["pernT"] = round((int(_p["pernoct_ult"]) / int(_p["pernoct_ant"]) - 1) * 100, 1) if _p["pernoct_ant"] else None
        r["pernY"] = int(_p["y_ult"])
    else:
        r["pern"] = r["pernH"] = r["pernT"] = r["pernY"] = None
    rt = renta.get(r["id"])
    r["renta"] = int(_f(rt["renta_persona"])) if rt and _f(rt["renta_persona"]) else None  # € netos por persona
    r["rentaH"] = int(_f(rt["renta_hogar"])) if rt and _f(rt["renta_hogar"]) else None    # € netos por hogar
    r["pob"] = round(_f(rt["pct_bajo60"]), 1) if rt and _f(rt["pct_bajo60"]) is not None else None  # % bajo el 60 % de la mediana

_big = [r for r in rows if r["pop"] >= 1000]
_sc = sorted(r["crim"] for r in rows if r["crim"] is not None)
_pr = sorted({r["p"]: r["ocup"] for r in rows if r["ocup"] is not None}.values())
_rn = sorted(r["renta"] for r in _big if r["renta"] is not None)
_pb = sorted(r["pob"] for r in _big if r["pob"] is not None)
_med = lambda v: v[len(v) // 2] if v else None
q_crim, q_ocup, q_renta, q_pob = pct_rank(_sc), pct_rank(_pr), pct_rank(_rn), pct_rank(_pb)
_vc = sorted(r["vac"] for r in _big if r["vac"] is not None)
_cd = sorted(r["crimD"] for r in rows if r["crimD"] is not None)
q_vac, q_crimD = pct_rank(_vc), pct_rank(_cd)
# Riesgo de okupación ESTIMADO por municipio (0 = bajo, 100 = alto). No hay ningún dato público por municipio ni por partido judicial, así que:
# 1) Tasa provincial: media de dos fuentes, cada una comparada con su media nacional: denuncias de allanamiento y usurpación (Interior) y
#    juicios por ocupación ilegal de viviendas (CGPJ, el dato específico de okupación).
# 2) Reparto dentro de la provincia: la okupación se concentra en ciudades grandes y en municipios con más vivienda vacía y más pobreza, así
#    que cada municipio recibe un multiplicador por tamaño ((hab./10.000)^0,25), vivienda vacía y pobreza (percentiles; la vivienda vacía pesa la
#    mitad donde hay mucha vivienda turística, porque el Censo cuenta como vacías las de uso estacional). Los multiplicadores se normalizan para
#    que la media de la provincia (ponderada por población) siga siendo su tasa.
# 3) Escala absoluta: un municipio en la media nacional da 40; el doble, 63; el triple, 78. Donde hay dato, robos en domicilios ajustan ±4.
cgpj = {r["prov"]: int(r["juicios"]) for r in csv.DictReader(open(ROOT / "data/raw/ocupacion_judicial_prov.csv"))}
_nat_ocup = sum(_f(u["y2025"]) or 0 for u in usu.values()) / sum(_pp.values()) * 10000
_nat_cgpj = sum(cgpj.values()) / sum(v for k, v in _pp.items() if k in cgpj) * 10000
_prov_ratio = {}
for pc, ptot in _pp.items():
    parts_r = []
    u = usu.get(pc)
    if u and _f(u["y2025"]) is not None:
        parts_r.append(_f(u["y2025"]) / ptot * 10000 / _nat_ocup)
    if pc in cgpj:
        parts_r.append(cgpj[pc] / ptot * 10000 / _nat_cgpj)
    if parts_r:
        _prov_ratio[pc] = sum(parts_r) / len(parts_r)


def _mult(r):
    m = (max(r["pop"], 500) / 10000) ** 0.25
    if r["vac"] is not None:
        m *= 1 + (q_vac(r["vac"]) - 50) / 100 * (0.3 if (r["tur"] or 0) >= 5 else 0.6)
    if r["pob"] is not None:
        m *= 1 + (q_pob(r["pob"]) - 50) / 100 * 0.6
    return m


_msum, _psum = {}, {}
for r in rows:
    if r["p"] in _prov_ratio:
        r["_m"] = _mult(r)
        _msum[r["p"]] = _msum.get(r["p"], 0) + r["_m"] * r["pop"]
        _psum[r["p"]] = _psum.get(r["p"], 0) + r["pop"]
for r in rows:
    if "_m" in r:
        ratio = _prov_ratio[r["p"]] * r["_m"] / (_msum[r["p"]] / _psum[r["p"]])
        v = 100 * (1 - math.exp(-0.5 * ratio))
        if r["crimD"] is not None:
            v += (q_crimD(r["crimD"]) - 50) / 50 * 4
        r["okR"] = round(min(100, max(0, v)))
        r["okX"] = round(ratio, 2)                   # veces la media nacional (estimado)
        r["okP"] = round(_prov_ratio[r["p"]], 2)     # la provincia, veces la media nacional
        del r["_m"]
    else:
        r["okR"] = r["okX"] = r["okP"] = None
    pj = cgpj.get(r["p"])
    r["okJ"] = round(pj / _pp[r["p"]] * 10000, 2) if pj is not None and _pp.get(r["p"]) else None  # juicios por ocupación por 10.000 hab. (provincia)
ZW = {"seg": 0.35, "okr": 0.30, "renta": 0.20, "pob": 0.15}
for r in rows:
    zp = {}
    if r["crim"] is not None:
        zp["seg"] = 100 - q_crim(r["crim"])        # más seguro = más puntos
    if r["okR"] is not None:
        zp["okr"] = 100 - r["okR"]                 # menos riesgo de okupación = más puntos
    if r["renta"] is not None:
        zp["renta"] = q_renta(r["renta"])
    if r["pob"] is not None:
        zp["pob"] = 100 - q_pob(r["pob"])
    r["sSeg"], r["sOcup"], r["sRenta"], r["sPob"] = (round(zp[k]) if k in zp else None for k in ("seg", "okr", "renta", "pob"))
    # Solo se valora la zona si hay SEGURIDAD MUNICIPAL (Interior: capitales y municipios >20.000 hab.) además de renta o pobreza.
    # Sin ese dato prefiero no dar veredicto antes que dar un falso positivo ("buena zona") sin evidencia suficiente.
    r["zona"] = round(sum(ZW[k] * v for k, v in zp.items()) / sum(ZW[k] for k in zp), 1) if ("seg" in zp and ("renta" in zp or "pob" in zp)) else None
    # Una zona no puede ser "buena" con riesgo de okupación medio, ni "media" con riesgo medio-alto o alto
    if r["zona"] is not None and r["okR"] is not None:
        if r["okR"] >= 60:
            r["zona"] = min(r["zona"], 39.9)
        elif r["okR"] >= 40:
            r["zona"] = min(r["zona"], 59.9)
ZREF = {"cgpj": round(_nat_cgpj, 2), "vac": _med(_vc), "crim": _med(_sc), "ocup": round(sum(_f(u["y2025"]) or 0 for u in usu.values()) / sum(_pp.values()) * 10000, 1), "renta": _med(_rn), "pob": _med(_pb)}

# Planeamiento (SIU, Ministerio de Vivienda): viviendas y suelo de actividad económica previstos y pendientes en áreas de desarrollo.
# OJO: son planes sobre el papel (muchos antiguos, del boom), no obra garantizada. Cobertura: 5.898 municipios (CCAA aportan los datos).
siu = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/siu_mun.csv", encoding="utf-8"))}
for r in rows:
    s = siu.get(r["id"])
    if s and s["viv_pend"] != "":
        vp = float(s["viv_pend"] or 0)
        r["pend"] = int(vp)                                             # viviendas previstas pendientes de materializar
        r["pendK"] = round(vp / r["pop"] * 1000)                        # por cada 1.000 habitantes
        r["pendNo"] = round(float(s["pct_sin_urbanizar"])) if s["pct_sin_urbanizar"] != "" else None  # % del suelo de desarrollo sin urbanizar
        r["aeP"] = round(float(s["ae_pend_m2"] or 0) / r["pop"], 1)     # m² edificables de actividad económica pendientes por habitante
        r["plan"] = s["plan"] or None                                   # figura de planeamiento vigente y año
    else:
        r["pend"] = r["pendK"] = r["pendNo"] = r["aeP"] = r["plan"] = None

elig = [r for r in rows if r["pop"] >= 1000]
# escalas saturantes (0-100): una vivienda planificada por habitante ya es mucho; 10 por habitante (planes del boom) no vale 10 veces más
r_pend = lambda vk: 100 * (1 - math.exp(-vk / 600))   # 156 ‰ (mediana) -> 23 ; 585 -> 62 ; 1.000 -> 81 ; 2.300 -> 98
r_ae = lambda m2: 100 * (1 - math.exp(-m2 / 150))     # m² de actividad económica pendiente por habitante
r_proy = pct_rank([r["proy"] for r in elig if r["proy"] is not None])
r_solar = pct_rank([r["solarPc"] for r in elig if r["solarPc"] is not None])
r_viv = pct_rank([r["vivPm"] for r in elig if r["vivPm"] is not None])
r_vt = pct_rank([r["vtG"] for r in elig if r["vtG"] is not None])
r_suelo = pct_rank([r["sueloG"] for r in elig if r["sueloG"] is not None])
r_m18 = pct_rank([r["m18"] for r in elig if r["m18"] is not None])
r_edM = pct_rank([-r["edM"] for r in elig if r["edM"] is not None])
r_paro = pct_rank([-r["paro"] for r in elig if r["paro"] is not None])
r_paroT = pct_rank([-r["paroT"] for r in elig if r["paroT"] is not None])
r_costa = lambda km: 100 * math.exp(-km / 30)   # 0 km = 100; 30 km = 37; 100 km = 4
r_ciu = lambda km: 100 * math.exp(-km / 45)     # distancia a una ciudad de más de 100.000 hab.
r_g5, r_g1, r_abs = pct_rank([r["g5"] for r in elig]), pct_rank([r["g1"] for r in elig]), pct_rank([r["abs"] for r in elig])
r_inv = pct_rank([r["inv"] for r in elig if r["inv"] is not None])
r_neg = pct_rank([r["negPc"] for r in elig if r["negPc"] is not None])
import math
# escala logarítmica por tamaño (0 = sin universidad; ≥40 = gran ciudad universitaria): una sede minúscula no puntúa como Salamanca
# Pesos nominales (suman 100 con todos los indicadores). Si falta alguno se reponderan los demás.
# Se descartaron del índice por poco informativos: suelo urbano y precio de la vivienda (reflejan precio, no crecimiento), proyección
# provincial (igual para todo el municipio de una provincia), solares (capacidad, no demanda) y la lista curada de proyectos (muestra incompleta).
# Población 25 + futuro 22 (obra nueva 9, planeamiento 9, actividad 4) + ciudad 10 + universidad 8 + juventud 8 + paro 8 (+2 evolución)
# + inversión 5 + mar 5 + mercado tensionado (poca vivienda vacía) 4 + negocios 3.
# Criterio: pesa más lo fiable y municipal (padrón, catastro, SEPE) y menos lo ruidoso (variación anual del paro, OSM, inversión puntual).
W = {"g5": 0.11, "g1": 0.06, "abs": 0.08, "inv": 0.05, "neg": 0.03 if HIST else 0.015, "uni": 0.08,
     "viv": 0.09, "pend": 0.09, "ae": 0.04,
     "juv": 0.08, "paro": 0.08, "paroT": 0.02, "cos": 0.05, "ciu": 0.10, "vac": 0.04}
for r in rows:
    if r["pop"] >= 1000:
        parts = {"g5": r_g5(r["g5"]), "g1": r_g1(r["g1"]), "abs": r_abs(r["abs"]), }
        # Más allá de 45 km por carretera no se considera accesible: el indicador no puntúa ni penaliza (se reponderan los demás)
        if r["uniNear"] is not None:
            parts["uni"] = r["uniS"]
        if r["dc"] <= CIRCUITO_MAX:
            parts["ciu"] = r_ciu(r["dc"])
        if r["inv"] is not None:
            parts["inv"] = r_inv(r["inv"])
        if r["negPc"] is not None:
            parts["neg"] = r_neg(r["negPc"])
        if r["m18"] is not None and r["edM"] is not None:
            parts["juv"] = (r_m18(r["m18"]) + r_edM(-r["edM"])) / 2
        if r["costa"] is not None and r["costa"] <= 60:  # el mar es un bonus: el interior no se penaliza (se reponderan los demás)
            parts["cos"] = r_costa(r["costa"])
        if r["vac"] is not None:
            parts["vac"] = 100 - q_vac(r["vac"])  # poca vivienda vacía = mercado tensionado
        if r["paro"] is not None:
            parts["paro"] = r_paro(-r["paro"])
        if r["paroT"] is not None:
            parts["paroT"] = r_paroT(-r["paroT"])
        if r["vivPm"] is not None:
            parts["viv"] = r_viv(r["vivPm"])
        if r["pendK"] is not None:
            parts["pend"] = r_pend(r["pendK"])
        if r["aeP"] is not None:
            parts["ae"] = r_ae(r["aeP"])
        wsum = sum(W[k] for k in parts)  # si falta algún indicador se reponderan los demás
        r["score"] = round(sum(W[k] * v for k, v in parts.items()) / wsum, 1)
        # Índice de futuro: obra nueva, vivienda y suelo de actividad previstos en el planeamiento
        fp = {k: parts[k] for k in ("viv", "pend", "ae") if k in parts}
        r["fut"] = round(sum(W[k] * v for k, v in fp.items()) / sum(W[k] for k in fp), 1) if fp else None
        r["sInv"] = round(parts["inv"]) if "inv" in parts else None
        r["sNeg"] = round(parts["neg"]) if "neg" in parts else None
        r["sPop"] = round((W["g5"] * parts["g5"] + W["g1"] * parts["g1"] + W["abs"] * parts["abs"]) / (W["g5"] + W["g1"] + W["abs"]))
        r["sUni"] = round(parts["uni"]) if "uni" in parts else None
        for _k, _f in (("juv", "sJuv"), ("paro", "sParo"), ("paroT", "sParoT"), ("vac", "sVac")):
            r[_f] = round(parts[_k]) if _k in parts else None
        r["sCos"] = round(parts["cos"]) if "cos" in parts else None
        r["sCiu"] = round(parts["ciu"]) if "ciu" in parts else None
        r["sViv"] = round(parts["viv"]) if "viv" in parts else None
        r["sPend"] = round(parts["pend"]) if "pend" in parts else None
        r["sAe"] = round(parts["ae"]) if "ae" in parts else None
    else:
        r["score"] = r["sVac"] = r["sJuv"] = r["sParo"] = r["sParoT"] = r["sCos"] = r["sCiu"] = r["sInv"] = r["sNeg"] = r["sPop"] = r["sUni"] = r["sViv"] = r["sPend"] = r["sAe"] = r["fut"] = None
    r["prov"] = PROV.get(r["p"], r["p"])
    del r["p"]

out = ROOT / "public/municipios.json"
out.parent.mkdir(exist_ok=True)
# Valor tasado por provincia (referencia en la gráfica de los municipios sin dato propio)
_vtprov = {}
for _t in csv.DictReader(open(ROOT / "data/raw/tasado_prov_serie.csv")):
    _vtprov.setdefault(_t["prov"], []).append([int(_t["anyo"]), int(_t["eur_m2"])])

# Serie de población 2015-2025 (para las curvas de la app): "ps" = habitantes por año, "psY" = primer año
_serie = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/pob_serie.csv"))}
_sy = sorted(int(k[1:]) for k in next(iter(_serie.values())) if k.startswith("y"))
for r in rows:
    sr = _serie.get(r["id"])
    vals = [int(sr[f"y{y}"]) if sr and sr[f"y{y}"] != "" else None for y in _sy]
    r["ps"] = vals if all(v is not None for v in vals) else None

with open(out, "w", encoding="utf-8") as f:
    json.dump({"years": [y0, y1], "psY": _sy[0], "vtProv": _vtprov, "negHist": HIST, "proyYears": PROY_Y, "zref": ZREF, "rows": rows}, f, ensure_ascii=False, separators=(",", ":"))
print(len(rows), "municipios ->", out, f"{out.stat().st_size/1e6:.2f} MB")
top = sorted([r for r in rows if r["score"] is not None], key=lambda r: -r["score"])[:10]
for r in top: print(r["score"], r["n"], r["prov"], r["pop"], r["g5"])
