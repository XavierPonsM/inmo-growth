"""Serie de población por municipio y año (para las curvas de la app): INE, tabla 29005 (padrón continuo).
Entrada: curl -o /tmp/pob11.json "https://servicios.ine.es/wstempus/jsCache/ES/DATOS_TABLA/29005?nult=11&tip=AM"
Salida:  data/raw/pob_serie.csv  (ine, y2015 ... y2025)
Uso: python3 scripts/process_serie.py /tmp/pob11.json
"""
import csv, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
d = json.load(open(sys.argv[1]))
out, years = {}, set()
for s in d:
    md = s["MetaData"]
    code = next((m.get("Codigo") for m in md if m.get("Codigo", "").isdigit() and len(m.get("Codigo", "")) == 5), None)
    names = [m["Nombre"] for m in md]
    if not code or "Total" not in names[1:2]:  # solo el total (ambos sexos)
        continue
    serie = {x["Anyo"]: int(x["Valor"]) for x in s["Data"] if x["Valor"] is not None}
    years |= set(serie)
    out[code] = serie
ys = sorted(years)
with open(ROOT / "data/raw/pob_serie.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ine"] + [f"y{y}" for y in ys])
    for k in sorted(out):
        w.writerow([k] + [out[k].get(y, "") for y in ys])
print(len(out), "municipios;", ys[0], "-", ys[-1])
