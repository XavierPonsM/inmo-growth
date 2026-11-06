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
    r["vtN"] = int(t["tasaciones"]) if t else None  # nº de tasaciones en los últimos 4 trimestres

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


_cities = [r for r in rows if r["pop"] >= 100000]
for r in rows:
    best = min(_cities, key=lambda c: _km(r, c))
    r["dc"] = round(_km(r, best))                                   # km hasta la ciudad grande más cercana (0 si lo es)
    r["cn"] = best["n"].split("/")[-1] if "/" in best["n"] else best["n"]  # nombre corto de esa ciudad

# ---- Calidad de la zona (NO entra en el índice de crecimiento; se muestra aparte y sirve de filtro) ----
# Seguridad: criminalidad convencional por 1.000 hab. (Interior; solo capitales y municipios >20.000 hab.).
# Okupación: allanamiento/usurpación por 10.000 hab., solo PROVINCIAL (Interior no la publica por municipio).
# Nivel socioeconómico: renta neta media por persona y % de población bajo el 60 % de la mediana (INE, Atlas de renta).
crim = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/crimen_mun.csv", encoding="utf-8"))}
usu = {r["prov"]: r for r in csv.DictReader(open(ROOT / "data/raw/usurpacion_prov.csv", encoding="utf-8"))}
renta = {r["ine"]: r for r in csv.DictReader(open(ROOT / "data/raw/renta_mun.csv", encoding="utf-8"))}
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
    else:
        r["ocup"] = r["ocupT"] = None
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
ZW = {"seg": 0.30, "ocup": 0.10, "renta": 0.30, "pob": 0.30}
for r in rows:
    zp = {}
    if r["crim"] is not None:
        zp["seg"] = 100 - q_crim(r["crim"])        # más seguro = más puntos
    if r["ocup"] is not None:
        zp["ocup"] = 100 - q_ocup(r["ocup"])       # menos okupación provincial = más puntos
    if r["renta"] is not None:
        zp["renta"] = q_renta(r["renta"])
    if r["pob"] is not None:
        zp["pob"] = 100 - q_pob(r["pob"])
    r["sSeg"], r["sOcup"], r["sRenta"], r["sPob"] = (round(zp[k]) if k in zp else None for k in ("seg", "ocup", "renta", "pob"))
    # Solo se valora la zona si hay SEGURIDAD MUNICIPAL (Interior: capitales y municipios >20.000 hab.) además de renta o pobreza.
    # Sin ese dato prefiero no dar veredicto antes que dar un falso positivo ("buena zona") sin evidencia suficiente.
    r["zona"] = round(sum(ZW[k] * v for k, v in zp.items()) / sum(ZW[k] for k in zp), 1) if ("seg" in zp and ("renta" in zp or "pob" in zp)) else None
ZREF = {"crim": _med(_sc), "ocup": round(sum(_f(u["y2025"]) or 0 for u in usu.values()) / sum(_pp.values()) * 10000, 1), "renta": _med(_rn), "pob": _med(_pb)}

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
r_g5, r_g1, r_abs = pct_rank([r["g5"] for r in elig]), pct_rank([r["g1"] for r in elig]), pct_rank([r["abs"] for r in elig])
r_inv = pct_rank([r["inv"] for r in elig if r["inv"] is not None])
r_neg = pct_rank([r["negPc"] for r in elig if r["negPc"] is not None])
import math
# escala logarítmica por tamaño (0 = sin universidad; ≥40 = gran ciudad universitaria): una sede minúscula no puntúa como Salamanca
r_uni = lambda s: min(100.0, 100 * math.log1p(s) / math.log1p(40))
# Pesos nominales (suman 100 con todos los indicadores). Si falta alguno se reponderan los demás.
# suelo y proy son datos provinciales (pesan poco); vt solo existe para >25.000 hab.; solar/viv no existen en País Vasco ni Navarra.
# "proj" es un bonus: 100 si el municipio tiene algún proyecto de la lista curada; si no, no cuenta (no penaliza). La lista no es
# exhaustiva, por eso pesa poco (3 %). Futuro (proy + solar + viv + pend + ae) = 32 %.
W = {"g5": 0.14, "g1": 0.08, "abs": 0.10, "inv": 0.11, "neg": 0.07 if HIST else 0.035, "uni": 0.11,
     "suelo": 0.02, "vt": 0.02, "proy": 0.06, "solar": 0.04, "viv": 0.08, "pend": 0.10, "ae": 0.04, "proj": 0.03}
for r in rows:
    if r["pop"] >= 1000:
        parts = {"g5": r_g5(r["g5"]), "g1": r_g1(r["g1"]), "abs": r_abs(r["abs"]), "uni": r_uni(r["uniSize"])}
        if r["inv"] is not None:
            parts["inv"] = r_inv(r["inv"])
        if r["negPc"] is not None:
            parts["neg"] = r_neg(r["negPc"])
        if r["sueloG"] is not None:
            parts["suelo"] = r_suelo(r["sueloG"])
        if r["vtG"] is not None:
            parts["vt"] = r_vt(r["vtG"])
        if r["proy"] is not None:
            parts["proy"] = r_proy(r["proy"])
        if r["solarPc"] is not None:
            parts["solar"] = r_solar(r["solarPc"])
        if r["vivPm"] is not None:
            parts["viv"] = r_viv(r["vivPm"])
        if r["pendK"] is not None:
            parts["pend"] = r_pend(r["pendK"])
        if r["aeP"] is not None:
            parts["ae"] = r_ae(r["aeP"])
        if r["proj"]:
            parts["proj"] = 100.0
        wsum = sum(W[k] for k in parts)  # si falta algún indicador se reponderan los demás
        r["score"] = round(sum(W[k] * v for k, v in parts.items()) / wsum, 1)
        # Índice de futuro: solo proyección provincial, suelo disponible, obra nueva y proyectos (bonus si hay)
        fp = {k: parts[k] for k in ("proy", "solar", "viv", "pend", "ae", "proj") if k in parts}
        r["fut"] = round(sum(W[k] * v for k, v in fp.items()) / sum(W[k] for k in fp), 1) if fp else None
        r["sInv"] = round(parts["inv"]) if "inv" in parts else None
        r["sNeg"] = round(parts["neg"]) if "neg" in parts else None
        r["sPop"] = round((W["g5"] * parts["g5"] + W["g1"] * parts["g1"] + W["abs"] * parts["abs"]) / (W["g5"] + W["g1"] + W["abs"]))
        r["sUni"] = round(parts["uni"])
        r["sSuelo"] = round(parts["suelo"]) if "suelo" in parts else None
        r["sVt"] = round(parts["vt"]) if "vt" in parts else None
        r["sProy"] = round(parts["proy"]) if "proy" in parts else None
        r["sSolar"] = round(parts["solar"]) if "solar" in parts else None
        r["sViv"] = round(parts["viv"]) if "viv" in parts else None
        r["sPend"] = round(parts["pend"]) if "pend" in parts else None
        r["sAe"] = round(parts["ae"]) if "ae" in parts else None
    else:
        r["score"] = r["sInv"] = r["sNeg"] = r["sPop"] = r["sUni"] = r["sSuelo"] = r["sVt"] = r["sProy"] = r["sSolar"] = r["sViv"] = r["sPend"] = r["sAe"] = r["fut"] = None
    r["prov"] = PROV.get(r["p"], r["p"])
    del r["p"]

out = ROOT / "public/municipios.json"
out.parent.mkdir(exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    json.dump({"years": [y0, y1], "negHist": HIST, "proyYears": PROY_Y, "zref": ZREF, "rows": rows}, f, ensure_ascii=False, separators=(",", ":"))
print(len(rows), "municipios ->", out, f"{out.stat().st_size/1e6:.2f} MB")
top = sorted([r for r in rows if r["score"] is not None], key=lambda r: -r["score"])[:10]
for r in top: print(r["score"], r["n"], r["prov"], r["pop"], r["g5"])
