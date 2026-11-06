"""Planeamiento urbanístico por municipio (SIU, Ministerio de Vivienda y Agenda Urbana).

Fuente: https://www.mivau.gob.es/urbanismo-y-suelo/sistema-de-informacion-urbana  ->  "Información alfanumérica (Excel)".
  areas_desarrollo_mun.xlsx: viviendas previstas y pendientes de materializar en Áreas de Suelo de Desarrollo, edificabilidad
                             pendiente de uso económico, % del suelo de desarrollo sin urbanizar.
  clases_suelo_mun.xlsx:     % del municipio por clase de suelo y figura de planeamiento vigente.
Cobertura: 5.898 municipios (98,6 % de la población), con información aportada por las CCAA (vintage 2020-2025 según municipio).
OJO: son planes sobre el papel (suelo urbanizable previsto), no obra garantizada.

Entrada: <dir>/areas_desarrollo_mun.xlsx y <dir>/clases_suelo_mun.xlsx
Salida:  data/raw/siu_mun.csv
Uso: python3 scripts/process_siu.py <dir>   (requiere pandas y openpyxl)
"""
import pathlib, sys
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1])

a = pd.read_excel(src / "areas_desarrollo_mun.xlsx", dtype={"ProvINE": str})
c = pd.read_excel(src / "clases_suelo_mun.xlsx", dtype={"ProvINE": str})
a["ine"] = a["ProvINE"].str.zfill(5)
c["ine"] = c["ProvINE"].str.zfill(5)

out = a[["ine", "Planeamiento", "munnumviv", "munnvivpnd", "munpradsnu", "munedaepnd"]].rename(
    columns={"Planeamiento": "plan", "munnumviv": "viv_prev", "munnvivpnd": "viv_pend", "munpradsnu": "pct_sin_urbanizar", "munedaepnd": "ae_pend_m2"}
)
suz = c.assign(pct_urbanizable=c["MunPrSuzDe"].fillna(0) + c["MunPrSuzNd"].fillna(0))[["ine", "pct_urbanizable"]]
out = out.merge(suz, on="ine", how="left").drop_duplicates("ine")
out.to_csv(ROOT / "data/raw/siu_mun.csv", index=False, encoding="utf-8")
print(len(out), "municipios;", int((out.viv_pend > 0).sum()), "con viviendas pendientes;", int(out.viv_pend.sum()), "viviendas pendientes en total")
