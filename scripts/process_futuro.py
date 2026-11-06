"""Indicadores de futuro / capacidad de crecimiento.

1) Proyección de población 2026-2041 por provincia (INE, Proyecciones de Población, tabla 36726, corto plazo).
2) Catastro, estadísticas por municipio (31-dic de cada año): solares (suelo urbano sin construir) y viviendas
   (UU_RES) en 2021 y 2026. El Catastro no cubre País Vasco ni Navarra (catastros forales).

Entrada: <dir>/proy.json (INE), <dir>/PARCELAS2026.xls, <dir>/URBANA2026.xls, <dir>/URBANA2021.xls
Salida: data/raw/proyeccion_prov.csv (prov, pop2026, pop2041, pct)  y  data/raw/catastro_futuro.csv
Uso: python3 scripts/process_futuro.py <dir>   (requiere xlrd)
"""
import csv, json, pathlib, sys
import xlrd

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1])
PROV = {"Albacete": "02", "Alicante/Alacant": "03", "Almería": "04", "Araba/Álava": "01", "Asturias": "33", "Badajoz": "06", "Balears, Illes": "07", "Barcelona": "08", "Bizkaia": "48", "Burgos": "09", "Cantabria": "39", "Castellón/Castelló": "12", "Ceuta": "51", "Ciudad Real": "13", "Coruña, A": "15", "Cuenca": "16", "Cáceres": "10", "Cádiz": "11", "Córdoba": "14", "Gipuzkoa": "20", "Girona": "17", "Granada": "18", "Guadalajara": "19", "Huelva": "21", "Huesca": "22", "Jaén": "23", "León": "24", "Lleida": "25", "Lugo": "27", "Madrid": "28", "Melilla": "52", "Murcia": "30", "Málaga": "29", "Navarra": "31", "Ourense": "32", "Palencia": "34", "Palmas, Las": "35", "Pontevedra": "36", "Rioja, La": "26", "Salamanca": "37", "Santa Cruz de Tenerife": "38", "Segovia": "40", "Sevilla": "41", "Soria": "42", "Tarragona": "43", "Teruel": "44", "Toledo": "45", "Valencia/València": "46", "Valladolid": "47", "Zamora": "49", "Zaragoza": "50", "Ávila": "05"}

# 1) Proyecciones INE por provincia
out = []
for s in json.load(open(src / "proy.json")):
    n = s["Nombre"]
    if not n.startswith("Total. Población.") or "Todas las edades" not in n:
        continue
    name = n.split(". ")[2]
    if name not in PROV:
        continue
    by = {d["Anyo"]: d["Valor"] for d in s["Data"] if d["Valor"] is not None}
    a, b = by[min(by)], by[max(by)]
    out.append([PROV[name], round(a), round(b), round((b / a - 1) * 100, 2), min(by), max(by)])
with open(ROOT / "data/raw/proyeccion_prov.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["prov", "pop_ini", "pop_fin", "pct", "y_ini", "y_fin"]); w.writerows(sorted(out))
print("proyecciones:", len(out), "provincias;", "rango", out[0][4], "-", out[0][5])


# 2) Catastro por municipio
def table(path):
    s = xlrd.open_workbook(path, logfile=open("/dev/null", "w")).sheet_by_index(0)
    h = s.row_values(0)
    return {str(s.cell_value(r, h.index("COD_INE_MUNI"))): dict(zip(h, s.row_values(r))) for r in range(1, s.nrows)}


p26, u26, u21 = table(src / "PARCELAS2026.xls"), table(src / "URBANA2026.xls"), table(src / "URBANA2021.xls")
rows = []
for ine, p in p26.items():
    u, v = u26.get(ine), u21.get(ine)
    rows.append([ine, round(p["SUP_SOLAR"]), int(p["SOLAR_URB"]), int(p["PARCELAS_URB"]), round(p["SUPERF_URB"]),
                 int(u["UU_RES"]) if u else "", int(v["UU_RES"]) if v else ""])
with open(ROOT / "data/raw/catastro_futuro.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["ine", "sup_solar", "solares", "parcelas", "superf_urb", "viv2026", "viv2021"]); w.writerows(rows)
print("catastro:", len(rows), "municipios")
