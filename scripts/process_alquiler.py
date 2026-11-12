"""Precio del alquiler por municipio: mediana de €/m² al mes y de la renta mensual, serie anual 2011-2024.
Fuente: Ministerio de Vivienda y Agenda Urbana, Sistema Estatal de Referencia del Precio del Alquiler de Vivienda (SERPAVI), a partir de las
declaraciones de IRPF (Agencia Tributaria) y el Catastro. No cubre País Vasco ni Navarra (haciendas forales). El libro pesa 71 MB y no se
guarda en el repositorio:
  curl -A "Mozilla/5.0" -o data/raw/alquiler/serpavi_2011_2024.xlsx \
    "https://cdn.mivau.gob.es/portal-web-mivau/vivienda/serpavi/2026-03_09_bd_SERPAVI_2011-2024%20-%20DEFINITIVO%20WEB_v2.xlsx"
Columnas usadas (hoja "Municipios"): ALQM2_LV_M_{VC|VU}_{aa} = mediana €/m²·mes; ALQTBID12_M_{VC|VU}_{aa} = mediana de la renta mensual;
BI_ALVHEPCO_T{VC|VU}_{aa} = nº de viviendas alquiladas. VC = vivienda colectiva (pisos), VU = unifamiliar. Se toma el tipo con más viviendas.
Salida: data/raw/alquiler_mun.csv  (ine, anyo, eur_m2_mes, renta_mes, viviendas)
"""
import csv, pathlib
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
wb = openpyxl.load_workbook(ROOT / "data/raw/alquiler/serpavi_2011_2024.xlsx", read_only=True)
ws = wb["Municipios"]
it = ws.iter_rows(values_only=True)
head = list(next(it))
col = {h: i for i, h in enumerate(head)}
years = sorted({int(h.rsplit("_", 1)[1]) for h in head if h and h.startswith("ALQM2_LV_M_VC_")})
out = []
for row in it:
    ine = row[col["CUMUN"]]
    if not ine:
        continue
    for y in years:
        best = None
        for t in ("VC", "VU"):
            n = row[col[f"BI_ALVHEPCO_T{t}_{y}"]]
            m2 = row[col[f"ALQM2_LV_M_{t}_{y}"]]
            mes = row[col[f"ALQTBID12_M_{t}_{y}"]]
            if n and m2 and (best is None or n > best[0]):
                best = (n, m2, mes)
        if best:
            out.append((str(ine).zfill(5), 2000 + y, round(best[1], 2), round(best[2]) if best[2] else "", int(best[0])))
with open(ROOT / "data/raw/alquiler_mun.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ine", "anyo", "eur_m2_mes", "renta_mes", "viviendas"])
    w.writerows(out)
print(len(out), "filas;", len({o[0] for o in out}), "municipios; años", years[0], "-", years[-1])
