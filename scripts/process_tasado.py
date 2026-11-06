"""Valor tasado medio de la vivienda libre (€/m²) en municipios de más de 25.000 habitantes.
Fuente: Ministerio de Transportes, Boletín Estadístico Online, "Valor tasado de la vivienda", tabla 5 (trimestral).
La tabla no trae código INE: se empareja por provincia + nombre normalizado con los nombres INE del padrón (data/raw/pob.json).
Salida: data/raw/tasado_municipios.csv  (ine, now, ago5, tasaciones)
  now  = media de los últimos 4 trimestres; ago5 = media de los mismos 4 trimestres de hace 5 años.
Uso: python3 scripts/process_tasado.py   (requiere xlrd; ejecutar antes build_dataset.py con public/municipios.json ya generado)
"""
import csv, json, pathlib, re, unicodedata
import xlrd

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARTICLES = {"el", "la", "los", "las", "l", "els", "es", "sa", "ses", "o", "a", "as", "les"}
PROV_NAMES = {"01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Avila", "06": "Badajoz", "07": "Balears", "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "Coruña", "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Guipúzcoa", "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida", "26": "Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia", "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Palmas", "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz", "39": "Cantabria", "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia", "47": "Valladolid", "48": "Vizcaya", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta", "52": "Melilla"}


def toks(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    t = [w for w in re.findall(r"[a-z0-9]+", s) if w not in ARTICLES]
    return tuple(sorted(t))


def keys(name):
    """Claves de un nombre INE: separa alternativas bilingües 'Alicante/Alacant'."""
    return {toks(p) for p in re.split(r"/", str(name)) if p.strip()} | {toks(name)}


def prov_code(txt):
    t = toks(txt)
    for code, n in PROV_NAMES.items():
        if toks(n)[:1] and set(toks(n)) <= set(t):
            return code
    return None


_raw = json.load(open(ROOT / "data/raw/pob.json"))  # nombres INE del padrón (no depende de public/municipios.json)
rows = [{"id": s["MetaData"][0]["Codigo"], "n": s["MetaData"][0]["Nombre"]} for s in _raw if s["MetaData"][1]["Codigo"] == "0"]
index = {}  # (prov, clave) -> ine
for r in rows:
    for k in keys(r["n"]):
        index[(r["id"][:2], k)] = r["id"]

book = xlrd.open_workbook(ROOT / "data/raw/tasado/35103500.xls")
sheets = {n.strip(): book.sheet_by_name(n) for n in book.sheet_names()}
NOW = ["T3A2025", "T4A2025", "T1A2026", "T2A2026"]
AGO = ["T3A2020", "T4A2020", "T1A2021", "T2A2021"]


def num(v):
    return float(v) if isinstance(v, (int, float)) else None


def collect(names):
    out = {}  # (prov, muni) -> {'v': [..], 'n': [..]}
    for q in names:
        s = sheets[q]
        prov = None
        for r in range(17, s.nrows):
            p, m = str(s.cell_value(r, 1)).strip(), str(s.cell_value(r, 2)).strip()
            if p:
                prov = prov_code(p)
            if not m or prov is None:
                continue
            d = out.setdefault((prov, m), {"v": [], "n": []})
            v, n = num(s.cell_value(r, 5)), num(s.cell_value(r, 9))
            if v:
                d["v"].append(v)
            if n:
                d["n"].append(n)
    return out


now, ago = collect(NOW), collect(AGO)
# nombre usado por el Ministerio -> nombre INE (casos que no coinciden tras normalizar)
ALIAS = {"Mahón": "Maó", "Palma de Mallorca": "Palma", "Santa Eulalia del Río": "Santa Eulària des Riu",
         "Santa Coloma Gramanet": "Santa Coloma de Gramenet", "Vitoria": "Vitoria-Gasteiz"}
by_name = {}  # clave -> {ine}: para casos con la provincia mal etiquetada en la tabla del Ministerio
for (p, k), ine in index.items():
    by_name.setdefault(k, set()).add(ine)
res, miss = [], []
for (prov, m), d in now.items():
    ine = None
    ks = keys(ALIAS.get(m, m))
    for k in ks:
        ine = ine or index.get((prov, k))
    if not ine:  # provincia mal etiquetada: vale si el nombre es único en toda España
        cand = set().union(*(by_name.get(k, set()) for k in ks))
        ine = next(iter(cand)) if len(cand) == 1 else None
    if not ine or not d["v"]:
        miss.append((prov, m))
        continue
    a = ago.get((prov, m), {"v": []})["v"]
    res.append([ine, round(sum(d["v"]) / len(d["v"])), round(sum(a) / len(a)) if a else "", int(sum(d["n"]))])
with open(ROOT / "data/raw/tasado_municipios.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["ine", "now", "ago5", "tasaciones"]); w.writerows(res)
print(len(res), "municipios emparejados;", len(miss), "sin emparejar:", miss[:25])
