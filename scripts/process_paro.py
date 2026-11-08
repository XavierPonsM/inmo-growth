"""Paro registrado por municipio: SEPE (estadística de municipios), septiembre de este año y del anterior.
Entrada: dos .xls descargados de https://www.sepe.es/HomeSepe/que-es-el-sepe/estadisticas/datos-estadisticos/municipios.html
         (uno por año, fichero ESTADISTICA_MUNICIPIOS.xls de la página de septiembre); ruta por argumento.
Salida:  data/raw/paro_mun.csv  (ine, paro_now, paro_ago)
Los valores "<5" (secreto estadístico) se tratan como 2,5.
Uso: python3 scripts/process_paro.py paro_2026.xls paro_2025.xls
"""
import csv, pathlib, sys
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parent.parent


def lee(path):
    out = {}
    xl = pd.ExcelFile(path)
    for sh in xl.sheet_names:
        if not sh.startswith("PARO "):
            continue
        df = xl.parse(sh, header=None)
        for _, r in df.iterrows():
            code = r[0]
            if isinstance(code, (int, float)) and code == code:
                v = r[2]
                v = 2.5 if str(v).strip().startswith("<") else v
                try:
                    out[f"{int(code):05d}"] = float(v)
                except (TypeError, ValueError):
                    pass
    return out


now, ago = lee(sys.argv[1]), lee(sys.argv[2])
with open(ROOT / "data/raw/paro_mun.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ine", "paro_now", "paro_ago"])
    for k in sorted(now):
        w.writerow([k, now[k], ago.get(k, "")])
print(len(now), "municipios;", sum(1 for k in now if k in ago), "con año anterior")
