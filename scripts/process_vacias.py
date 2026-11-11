"""Vivienda vacía por municipio: INE, Censo de Población y Viviendas 2021 (viviendas según consumo eléctrico; municipios de 1.000 hab. o más).
Entrada: curl -A "Mozilla/5.0" -o /tmp/censo59531.csv https://www.ine.es/jaxi/files/tpx/csv_bdsc/59531.csv
Salida:  data/raw/vacias_mun.csv  (ine, viviendas, vacias, esporadico)
Uso: python3 scripts/process_vacias.py /tmp/censo59531.csv
"""
import csv, pathlib, sys, collections

ROOT = pathlib.Path(__file__).resolve().parent.parent
CAMPOS = {"Viviendas totales": "viviendas", "Viviendas vacías": "vacias", "Viviendas de uso esporádico": "esporadico"}
d = collections.defaultdict(dict)
with open(sys.argv[1], encoding="utf-8-sig") as f:
    for row in csv.reader(f, delimiter=";"):
        if len(row) < 6 or row[4] not in CAMPOS or not row[3][:5].isdigit():
            continue
        v = row[5].replace(".", "")
        if v.isdigit():
            d[row[3][:5]][CAMPOS[row[4]]] = int(v)
with open(ROOT / "data/raw/vacias_mun.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["ine", "viviendas", "vacias", "esporadico"])
    for k in sorted(d):
        if "viviendas" in d[k] and "vacias" in d[k]:
            w.writerow([k, d[k]["viviendas"], d[k]["vacias"], d[k].get("esporadico", "")])
print(len(d), "municipios")
