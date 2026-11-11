"""Valor tasado medio de la vivienda libre (€/m²) por PROVINCIA, serie anual desde 2015 (media de los trimestres de cada año).
Sirve de referencia en la gráfica de los municipios pequeños, que no tienen dato propio (el Ministerio solo lo publica en los de más de 25.000 hab.).
Fuente: Ministerio de Transportes, Boletín Estadístico Online, tabla 35101000:
  curl -o data/raw/tasado/35101000.xls https://apps.fomento.gob.es/BoletinOnline2/sedal/35101000.XLS
Salida: data/raw/tasado_prov_serie.csv  (prov, anyo, eur_m2)
"""
import csv, pathlib, re, unicodedata
import xlrd

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAMES = {"alava": "01", "araba": "01", "albacete": "02", "alicante": "03", "almeria": "04", "avila": "05", "badajoz": "06", "balears": "07",
         "barcelona": "08", "burgos": "09", "caceres": "10", "cadiz": "11", "castellon": "12", "ciudad real": "13", "cordoba": "14", "coruna": "15",
         "cuenca": "16", "girona": "17", "gerona": "17", "granada": "18", "guadalajara": "19", "guipuzcoa": "20", "gipuzkoa": "20", "huelva": "21",
         "huesca": "22", "jaen": "23", "leon": "24", "lleida": "25", "lerida": "25", "rioja": "26", "lugo": "27", "madrid": "28", "malaga": "29",
         "murcia": "30", "navarra": "31", "ourense": "32", "orense": "32", "asturias": "33", "palencia": "34", "palmas": "35", "pontevedra": "36",
         "salamanca": "37", "santa cruz de tenerife": "38", "tenerife": "38", "cantabria": "39", "segovia": "40", "sevilla": "41", "soria": "42",
         "tarragona": "43", "teruel": "44", "toledo": "45", "valencia": "46", "valladolid": "47", "vizcaya": "48", "bizkaia": "48", "zamora": "49",
         "zaragoza": "50", "ceuta": "51", "melilla": "52"}


def code(txt):
    t = unicodedata.normalize("NFD", str(txt)).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"\(.*?\)", "", t).replace("/", " ").strip()
    t = " ".join(t.split())
    if t in NAMES:
        return NAMES[t]
    for k, v in NAMES.items():  # "alicante alacant", "valencia valencia", "castellon castello"...
        if t.startswith(k + " ") or t == k:
            return v
    return None


book = xlrd.open_workbook(ROOT / "data/raw/tasado/35101000.xls")
vals = {}  # (prov, año) -> [trimestres]
for s in book.sheets():
    head = next((r for r in range(s.nrows) if any(str(s.cell_value(r, c)).startswith("Año ") for c in range(s.ncols))), None)
    if head is None:
        continue
    cols = {}  # columna -> año: solo las 4 columnas de trimestres que siguen a cada "Año XXXX" (detrás puede haber variaciones en %)
    for c in range(s.ncols):
        h = str(s.cell_value(head, c))
        if h.startswith("Año "):
            for k in range(4):
                if c + k < s.ncols and str(s.cell_value(head + 2, c + k)).strip().startswith(("1", "2", "3", "4")):
                    cols[c + k] = int(h[4:8])
    for r in range(head + 3, s.nrows):
        pc = code(s.cell_value(r, 1))
        if not pc:
            continue
        for c, y in cols.items():
            v = s.cell_value(r, c)
            if isinstance(v, (int, float)) and y >= 2015:
                vals.setdefault((pc, y), []).append(v)
with open(ROOT / "data/raw/tasado_prov_serie.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["prov", "anyo", "eur_m2"])
    for (pc, y) in sorted(vals):
        q = vals[(pc, y)]
        w.writerow([pc, y, round(sum(q) / len(q))])
print(len({k[0] for k in vals}), "provincias;", sorted({k[1] for k in vals}))
