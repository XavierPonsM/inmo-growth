"""Vivienda turística por municipio: INE, estadística experimental "Viviendas turísticas en España" (operación 410).
Entrada (último periodo disponible):
  curl -o /tmp/vt39366.json "https://servicios.ine.es/wstempus/jsCache/ES/DATOS_TABLA/39366?nult=1&tip=AM"  (% sobre viviendas censadas)
  curl -o /tmp/vt39363.json "https://servicios.ine.es/wstempus/jsCache/ES/DATOS_TABLA/39363?nult=1&tip=AM"  (viviendas y plazas)
Salida: data/raw/turismo_mun.csv  (ine, pct, viviendas, plazas, periodo)
Uso: python3 scripts/process_turismo.py /tmp/vt39366.json /tmp/vt39363.json
"""
import csv, json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
out = {}


def walk(path):
    for s in json.load(open(path)):
        md = s["MetaData"]
        code = md[0].get("Codigo", "")
        if len(code) != 5 or not code.isdigit() or not s["Data"] or s["Data"][0]["Valor"] is None:
            continue
        yield code, md[1]["Nombre"], s["Data"][0]


for code, var, d in walk(sys.argv[1]):
    out.setdefault(code, {})["pct"] = d["Valor"]
    out[code]["periodo"] = f'{d["Anyo"]}-{d["T3_Periodo"].lstrip("M")}'
for code, var, d in walk(sys.argv[2]):
    if var == "Viviendas turísticas":
        out.setdefault(code, {})["viviendas"] = int(d["Valor"])
    elif var == "Plazas":
        out.setdefault(code, {})["plazas"] = int(d["Valor"])
with open(ROOT / "data/raw/turismo_mun.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ine", "pct", "viviendas", "plazas", "periodo"])
    for k in sorted(out):
        o = out[k]
        w.writerow([k, o.get("pct", ""), o.get("viviendas", ""), o.get("plazas", ""), o.get("periodo", "")])
print(len(out), "municipios;", out.get("07015"))
