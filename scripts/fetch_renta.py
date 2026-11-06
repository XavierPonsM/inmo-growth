"""Renta por municipio: INE, Atlas de distribución de renta de los hogares (operación 353).

Por provincia (54 tablas de cada tipo) se descargan, con curl, el último año disponible de:
  - "Indicadores de renta media y mediana": renta neta media por persona y por hogar (€)
  - "Porcentaje de población con ingresos por unidad de consumo por debajo/encima de umbrales relativos por sexo":
    % de población (total) con ingresos por debajo del 60 % de la mediana (indicador de riesgo de pobreza)
Solo se guardan los municipios (código INE de 5 dígitos), no distritos ni secciones censales.
Cada tabla se procesa y se descarta (pesan 2-7 MB; en total unos 460 MB).

Salida: data/raw/renta_mun.csv  (ine, renta_persona, renta_hogar, pct_bajo60, anyo)
Uso: python3 scripts/fetch_renta.py        (reanuda si se interrumpe)
"""
import csv, json, pathlib, subprocess, tempfile, collections, time
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw/renta_mun.csv"
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
RENTA = ids["Indicadores de renta media y mediana"]
UMBRAL = ids["Porcentaje de población con ingresos por unidad de consumo por debajo/encima de determinados umbrales relativos por sexo"]
print(len(RENTA), "tablas de renta;", len(UMBRAL), "tablas de umbrales", flush=True)


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
        if kind == "renta":
            if "Renta neta media por persona" in names:
                res.setdefault(code, {})["renta_persona"] = v
            elif "Renta neta media por hogar" in names:
                res.setdefault(code, {})["renta_hogar"] = v
        else:
            if names[1] == "Total" and any("por debajo 60% de la mediana" in n for n in names):
                res.setdefault(code, {})["pct_bajo60"] = v
        if code in res:
            res[code]["anyo"] = y
    return kind, tid, res


jobs = [("renta", i) for i in RENTA] + [("umbral", i) for i in UMBRAL]
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
    w.writerow(["ine", "renta_persona", "renta_hogar", "pct_bajo60", "anyo"])
    for code in sorted(merged):
        d = merged[code]
        w.writerow([code, d.get("renta_persona", ""), d.get("renta_hogar", ""), d.get("pct_bajo60", ""), d.get("anyo", "")])
print("OK", len(merged), "municipios;", "fallos:", fallos, flush=True)
