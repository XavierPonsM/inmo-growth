"""Estructura de edad por municipio: INE, Atlas de distribución de renta (operación 353), tabla "Indicadores demográficos".
Por provincia (54 tablas) se descarga el último año: edad media, % menores de 18 años y % de 65 y más.
Salida: data/raw/edad_mun.csv  (ine, edad_media, pct_menor18, pct_mayor65, anyo)
Uso: python3 scripts/fetch_edad.py
"""
import csv, json, pathlib, subprocess, tempfile, collections, time
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw/edad_mun.csv"
API = "https://servicios.ine.es/wstempus"


def curl(url, dest=None, timeout=240):
    cmd = ["curl", "-s", "-m", str(timeout), "-A", "inmo-growth/0.1 (proyecto personal)", url]
    if dest:
        cmd += ["-o", str(dest)]
    return subprocess.run(cmd, capture_output=True)


tablas = json.loads(curl(f"{API}/js/ES/TABLAS_OPERACION/353").stdout)
ids = collections.defaultdict(list)
for t in tablas:
    ids[t["Nombre"].strip()].append(t["Id"])
EDAD = ids["Indicadores demográficos"]
print(len(EDAD), "tablas", flush=True)


def procesa(args):
    kind, tid = args
    with tempfile.TemporaryDirectory() as tmp:
        f = pathlib.Path(tmp) / "t.json"
        data = None
        for intento in range(5):
            curl(f"{API}/jsCache/ES/DATOS_TABLA/{tid}?nult=1&tip=AM", f)
            try:
                d = json.loads(f.read_text(encoding="utf-8"))
                if isinstance(d, list) and d and isinstance(d[0], dict) and "MetaData" in d[0]:
                    data = d
                    break
            except Exception:
                pass
            time.sleep(5 * (intento + 1))  # el INE puede limitar peticiones seguidas
        if data is None:
            return kind, tid, None
    res = {}
    for s in data:
        md = s["MetaData"]
        code = md[0]["Codigo"]
        if len(code) != 5 or not s["Data"]:
            continue
        v, y = s["Data"][0]["Valor"], s["Data"][0]["Anyo"]
        names = [m["Nombre"] for m in md]
        campo = {"Edad media de la población": "edad_media", "Porcentaje de población menor de 18 años": "pct_menor18", "Porcentaje de población de 65 y más años": "pct_mayor65"}.get(names[1])
        if campo:
            res.setdefault(code, {})[campo] = v
        if code in res:
            res[code]["anyo"] = y
    return kind, tid, res


jobs = [("edad", i) for i in EDAD]
merged = collections.defaultdict(dict)
fallos = []
with ThreadPoolExecutor(max_workers=4) as ex:
    for n, (kind, tid, res) in enumerate(ex.map(procesa, jobs), 1):
        if res is None:
            fallos.append((kind, tid))
        else:
            for code, d in res.items():
                merged[code].update(d)
        if n % 10 == 0 or n == len(jobs):
            print(f"{n}/{len(jobs)} tablas; {len(merged)} municipios", flush=True)

with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ine", "edad_media", "pct_menor18", "pct_mayor65", "anyo"])
    for code in sorted(merged):
        d = merged[code]
        w.writerow([code, d.get("edad_media", ""), d.get("pct_menor18", ""), d.get("pct_mayor65", ""), d.get("anyo", "")])
print("OK", len(merged), "municipios;", "fallos:", fallos, flush=True)
