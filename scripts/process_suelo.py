"""Precio medio del m² de suelo urbano por provincia y tramo de tamaño de municipio.
Fuente: Ministerio de Transportes (Boletín Estadístico Online, Estadística de precios de suelo urbano, tablas 4.1-4.5, trimestral).
NO es del INE y NO existe por municipio: se asigna a cada municipio el valor de su provincia y su tramo de población.
Salida: data/raw/suelo_provincia_tramo.csv (prov, tramo, now, ago5)  -> €/m²; now = media últimos 4 trimestres, ago5 = media de los mismos 4 hace 5 años.
Uso: python3 scripts/process_suelo.py   (requiere xlrd)
"""
import csv, pathlib
import xlrd

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw/suelo"
FILES = {0: "36401000", 1: "36401500", 2: "36402000", 3: "36402500", 4: "36403000"}  # tramos: <1k, 1-5k, 5-10k, 10-50k, >50k
PROV_ROW = {"01": "Álava", "02": "Albacete", "03": "Alicante/Alacant", "04": "Almería", "05": "Avila", "06": "Badajoz", "07": "Balears (Illes)", "08": "Barcelona", "09": "Burgos", "10": "Cáceres", "11": "Cádiz", "12": "Castellón/Castelló", "13": "Ciudad Real", "14": "Córdoba", "15": "Coruña (A)", "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Guipúzcoa", "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida", "26": "Rioja (La)", "27": "Lugo", "28": "Madrid (Comunidad de)", "29": "Málaga", "30": "Murcia (Región de)", "31": "Navarra (Comunidad Foral de)", "32": "Ourense", "33": "Asturias (Principado de )", "34": "Palencia", "35": "Palmas (Las)", "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia", "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo", "46": "Valencia/València", "47": "Valladolid", "48": "Vizcaya", "49": "Zamora", "50": "Zaragoza", "51": "Ceuta y Melilla", "52": "Ceuta y Melilla"}


def num(v):
    return float(v) if isinstance(v, (int, float)) and v != "" else None


def window(vals):
    v = [x for x in vals if x is not None and x > 0]
    return round(sum(v) / len(v), 1) if len(v) >= 2 else None  # al menos 2 de 4 trimestres con transacciones


out = []
for tramo, f in FILES.items():
    s = xlrd.open_workbook(RAW / f"{f}.xls").sheet_by_index(0)
    hdr = s.row_values(12)
    # columnas trimestrales: de la 2 hasta la última que tenga '1º'..'4º' (las 2 últimas son variaciones)
    qcols = [c for c, v in enumerate(hdr) if str(v).strip() in ("1º", "2º", "3º", "4º")]
    last = qcols[-1]
    rows = {str(s.cell_value(r, 1)).strip(): s.row_values(r) for r in range(13, s.nrows) if str(s.cell_value(r, 1)).strip()}
    for code, name in PROV_ROW.items():
        row = rows.get(name.strip())
        if row is None:
            continue
        now = window([num(row[c]) for c in range(last - 3, last + 1)])
        ago = window([num(row[c]) for c in range(last - 3 - 20, last + 1 - 20)])
        out.append([code, tramo, now, ago])
with open(ROOT / "data/raw/suelo_provincia_tramo.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["prov", "tramo", "now", "ago5"]); w.writerows(out)
print(len(out), "filas;", sum(1 for r in out if r[2] is not None), "con precio actual;", sum(1 for r in out if r[2] and r[3]), "con precio actual y de hace 5 años")
print("ventana actual: columnas", last - 3, "-", last, "| hace 5 años:", last - 23, "-", last - 20)
