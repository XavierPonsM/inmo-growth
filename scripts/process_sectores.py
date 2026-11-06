"""Sectores de desarrollo urbanístico por municipio (SIU, Ministerio de Vivienda y Agenda Urbana).

Fuente: tabla_sectores.xlsx del Excel alfanumérico del SIU (suelo urbano no consolidado y suelo urbanizable delimitado/sectorizado).
Por sector: nombre, clase de suelo, superficie (m²), uso predominante y edificabilidad total (m² de techo). NO trae nº de viviendas.
Son planes sobre el papel: no indica si el sector se ha urbanizado ni su calendario.

Entrada: <dir>/tabla_sectores.xlsx  y  data/raw/pob.json (para limitar a municipios de 1.000 hab. o más)
Salida:  public/sectores.json  { ine: { s: [[nombre, clase, uso, ha, edificabilidad_m2t], ...], n: nº sectores con nombre, r: nº sin nombre, rha: ha sin nombre } }
         (la interfaz lo carga solo al abrir una ficha)
Uso: python3 scripts/process_sectores.py <dir>   (requiere pandas y openpyxl)
"""
import json, pathlib, re, sys
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1])
MAX_POR_MUNI = 8

# población 2025 por municipio (padrón INE)
pop = {}
for s in json.load(open(ROOT / "data/raw/pob.json")):
    md = s["MetaData"]
    if md[1]["Codigo"] == "0" and s["Data"]:
        d = max(s["Data"], key=lambda d: d["Anyo"])
        pop[md[0]["Codigo"]] = d["Valor"]

t = pd.read_excel(src / "tabla_sectores.xlsx", dtype={"ProvINE": str})
t["ProvINE"] = t["ProvINE"].str.zfill(5)
t = t[t["ProvINE"].map(lambda i: pop.get(i, 0) >= 1000)]

CLASE = {"Suelo urbano no consolidado": "urbano no consolidado", "Suelo urbanizable delimitado o sectorizado": "urbanizable"}


def limpia(nombre: str) -> str:
    """EL_OLIVAR -> El Olivar; SD_1 / ST-1_TERCIARIO_NORTE conservan códigos con dígitos."""
    menores = {"de", "del", "la", "el", "los", "las", "y", "en", "al", "a", "e", "o"}
    out = []
    for w in re.split(r"[_\s]+", nombre.strip()):
        if any(c.isdigit() for c in w):
            out.append(w)  # códigos como SD_1, ST-3: se conservan
        else:
            out.append(w.lower() if w.lower() in menores else w.capitalize())
    s = " ".join(out)
    return s[:1].upper() + s[1:]


res = {}
for ine, g in t.groupby("ProvINE"):
    sin = g["DenSector"].fillna("SIN DATOS").str.upper().eq("SIN DATOS")
    con = g[~sin].copy()
    # los más grandes primero (edificabilidad si existe, si no superficie)
    con["k"] = con["EdifSuma"].fillna(0) + con["SupTotADGr"].fillna(0) * 1e-6
    con = con.sort_values("k", ascending=False)
    filas = [
        [limpia(str(r.DenSector)), CLASE.get(r.ClaseSuelo, str(r.ClaseSuelo)), (r.UsoPredominante if isinstance(r.UsoPredominante, str) else None),
         round(float(r.SupTotADGr) / 1e4, 1) if pd.notna(r.SupTotADGr) else None, int(r.EdifSuma) if pd.notna(r.EdifSuma) else None]
        for r in con.head(MAX_POR_MUNI).itertuples()
    ]
    if filas or sin.any():
        res[ine] = {"s": filas, "n": int(len(con)), "r": int(sin.sum()), "rha": round(float(g[sin]["SupTotADGr"].sum()) / 1e4, 1)}

out = ROOT / "public/sectores.json"
out.write_text(json.dumps(res, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(len(res), "municipios;", sum(v["n"] for v in res.values()), "sectores con nombre;", f"{out.stat().st_size/1e6:.2f} MB")
print("Brunete:", res.get("28026"))
