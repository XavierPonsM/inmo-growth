"""Juicios por ocupación ilegal de viviendas por provincia: CGPJ, "Datos sobre el efecto de la crisis en los órganos judiciales" (anual).
Es el dato judicial específico de okupación (verbales posesorios del art. 250.1.4 LEC, desde 2018); no existe por municipio ni por partido judicial.
Entrada: curl -o /tmp/cgpj.xlsx "https://www.poderjudicial.es/stfls/ESTADISTICA/FICHEROS/Crisis/Datos%20sobre%20el%20efecto%20de%20la%20crisis%20en%20los%20organos%20judiciales%20-%20Anual%202025.xlsx"
Salida:  data/raw/ocupacion_judicial_prov.csv  (prov, juicios)
Uso: python3 scripts/process_cgpj.py /tmp/cgpj.xlsx
"""
import csv, pathlib, sys, unicodedata
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROV = {"ALAVA": "01", "ARABA": "01", "ARABA/ALAVA": "01", "ALBACETE": "02", "ALICANTE": "03", "ALICANTE/ALACANT": "03", "ALMERIA": "04", "AVILA": "05", "BADAJOZ": "06",
        "BALEARES": "07", "ILLES BALEARS": "07", "BALEARS, ILLES": "07", "BARCELONA": "08", "BURGOS": "09", "CACERES": "10", "CADIZ": "11", "CASTELLON": "12",
        "CASTELLON/CASTELLO": "12", "CIUDAD REAL": "13", "CORDOBA": "14", "A CORUNA": "15", "CORUNA, A": "15", "LA CORUNA": "15", "CUENCA": "16", "GIRONA": "17",
        "GRANADA": "18", "GUADALAJARA": "19", "GIPUZKOA": "20", "GUIPUZCOA": "20", "HUELVA": "21", "HUESCA": "22", "JAEN": "23", "LEON": "24", "LLEIDA": "25",
        "LA RIOJA": "26", "RIOJA, LA": "26", "LUGO": "27", "MADRID": "28", "MALAGA": "29", "MURCIA": "30", "NAVARRA": "31", "OURENSE": "32", "ASTURIAS": "33",
        "PALENCIA": "34", "LAS PALMAS": "35", "PALMAS, LAS": "35", "PONTEVEDRA": "36", "SALAMANCA": "37", "SANTA CRUZ DE TENERIFE": "38", "S.C. TENERIFE": "38",
        "CANTABRIA": "39", "SEGOVIA": "40", "SEVILLA": "41", "SORIA": "42", "TARRAGONA": "43", "TERUEL": "44", "TOLEDO": "45", "VALENCIA": "46",
        "VALENCIA/VALENCIA": "46", "VALLADOLID": "47", "BIZKAIA": "48", "VIZCAYA": "48", "ZAMORA": "49", "ZARAGOZA": "50", "CEUTA": "51", "MELILLA": "52"}


def key(s):
    return unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().upper().strip()


ws = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)["Provincias"]
rows = list(ws.iter_rows(values_only=True))
head = next(r for r in rows if r and any(c and "ocupaci" in str(c).lower() for c in r))
col = next(i for i, c in enumerate(head) if c and "ocupaci" in str(c).lower())
out, miss = {}, []
for r in rows:
    name = r[1] if len(r) > 1 else None
    if not name or not isinstance(r[col], (int, float)):
        continue
    code = PROV.get(key(name))
    if code:
        out[code] = int(r[col])
    else:
        miss.append(name)
with open(ROOT / "data/raw/ocupacion_judicial_prov.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["prov", "juicios"])
    for k in sorted(out):
        w.writerow([k, out[k]])
print(len(out), "provincias; sin mapear:", miss)
