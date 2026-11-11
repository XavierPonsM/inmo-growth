"""Pernoctaciones anuales en alojamientos turísticos (hoteles, apartamentos, campings y rurales) por punto turístico: INE, OAT, tabla 48431.
Solo cubre los ~130 municipios que el INE trata como "puntos turísticos"; el resto no tiene dato (no significa que no haya turismo).
Entrada: curl -o /tmp/oat.json "https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/48431?nult=12"
Salida:  data/raw/pernoct_puntos.csv  (nombre, y_ult, pernoct_ult, pernoct_ant)  — el código INE se asigna por nombre en build_dataset.py
Uso: python3 scripts/process_oat.py /tmp/oat.json
"""
import csv, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
rows = []
for s in json.load(open(sys.argv[1])):
    parts = s["Nombre"].split(". ")
    if len(parts) < 3 or parts[1] != "Total":
        continue
    data = sorted((d for d in s["Data"] if d["Valor"] is not None), key=lambda d: d["Anyo"])
    if not data:
        continue
    last = data[-1]
    prev = next((d for d in data if d["Anyo"] == last["Anyo"] - 1), None)
    rows.append([parts[2], last["Anyo"], int(last["Valor"]), int(prev["Valor"]) if prev else ""])
with open(ROOT / "data/raw/pernoct_puntos.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["nombre", "y_ult", "pernoct_ult", "pernoct_ant"])
    w.writerows(sorted(rows))
print(len(rows), "puntos turísticos;", rows[:2])
