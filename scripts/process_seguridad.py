"""Seguridad: Portal Estadístico de Criminalidad del Ministerio del Interior.

1) Balance de criminalidad (año completo 2025 y 2024) de capitales de provincia, municipios de más de 20.000 habitantes e islas.
   Tabla 1509012 del portal. Las filas traen el código INE ("45081 Illescas"). Hechos conocidos.
2) Allanamiento / usurpación de inmuebles, hechos conocidos por PROVINCIA (serie anual, tabla 11002).
   Interior no publica esta serie por municipio, y la estadística no distingue entre allanamiento y usurpación (okupación).

Descarga (curl con Referer del portal):
  https://estadisticasdecriminalidad.ses.mir.es/sec/jaxiPx/files/_px/es/csv_bdsc/DatosBalanceAnt/l0/1509012.csv_bdsc?nocab=1
  https://estadisticasdecriminalidad.ses.mir.es/sec/jaxiPx/files/_px/es/csv_bdsc/Datos11/l0/11002.csv_bdsc?nocab=1

Entrada: <dir>/balance_munis.csv y <dir>/usurp_11002.csv
Salida:  data/raw/crimen_mun.csv (ine, c25, c24, h25, l25, s25, rv25, rd25, hu25, ve25, dr25) y data/raw/usurpacion_prov.csv (prov, y2021..y2025)
Uso: python3 scripts/process_seguridad.py <dir>
"""
import csv, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1])

PROV = {"Araba/Álava": "01", "Albacete": "02", "Alicante/Alacant": "03", "Almería": "04", "Ávila": "05", "Badajoz": "06", "Balears (Illes)": "07", "Barcelona": "08", "Burgos": "09", "Cáceres": "10", "Cádiz": "11", "Castellón/Castelló": "12", "Ciudad Real": "13", "Córdoba": "14", "Coruña (A)": "15", "Cuenca": "16", "Girona": "17", "Granada": "18", "Guadalajara": "19", "Gipuzkoa": "20", "Huelva": "21", "Huesca": "22", "Jaén": "23", "León": "24", "Lleida": "25", "Rioja (La)": "26", "Lugo": "27", "Madrid": "28", "Málaga": "29", "Murcia": "30", "Navarra": "31", "Ourense": "32", "Asturias": "33", "Palencia": "34", "Palmas (Las)": "35", "Pontevedra": "36", "Salamanca": "37", "Santa Cruz de Tenerife": "38", "Cantabria": "39", "Segovia": "40", "Sevilla": "41", "Soria": "42", "Tarragona": "43", "Teruel": "44", "Toledo": "45", "Valencia/València": "46", "Valladolid": "47", "Bizkaia": "48", "Zamora": "49", "Zaragoza": "50", "Ceuta": "51", "Melilla": "52"}
TIPOS = {
    "I. CRIMINALIDAD CONVENCIONAL": "c",
    "1. Homicidios dolosos y asesinatos consumados": "h",
    "3. Delitos graves y menos graves de lesiones y riña tumultuaria": "l",
    "5. Delitos contra la libertad sexual": "s",
    "6. Robos con violencia e intimidación": "rv",
    "7.1.-Robos con fuerza en domicilios": "rd",
    "8. Hurtos": "hu",
    "9. Sustracciones de vehículos": "ve",
    "10. Tráfico de drogas": "dr",
}


def num(s):
    """'1.676' -> 1676 ; '-6,4' -> -6.4"""
    s = s.strip().replace(".", "").replace(",", ".")
    return float(s) if s not in ("", "-") else None


# 1) criminalidad municipal
m = {}
with open(src / "balance_munis.csv", encoding="utf-8-sig") as f:
    for geo, tipo, per, val in csv.reader(f, delimiter=";"):
        mm = re.match(r"^(\d{5}) ", geo)
        if not mm or tipo not in TIPOS or not per.startswith("enero-diciembre"):
            continue
        y = per[-2:]  # '25' / '24'
        m.setdefault(mm.group(1), {})[TIPOS[tipo] + y] = num(val)
cols = ["c25", "c24", "h25", "l25", "s25", "rv25", "rd25", "hu25", "ve25", "dr25"]
with open(ROOT / "data/raw/crimen_mun.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ine"] + cols)
    for k in sorted(m):
        w.writerow([k] + ["" if m[k].get(c) is None else int(m[k][c]) for c in cols])
print(len(m), "municipios con criminalidad")

# 2) usurpación por provincia
u = {}
with open(src / "usurp_11002.csv", encoding="utf-8-sig") as f:
    for prov, per, val in list(csv.reader(f, delimiter=";"))[1:]:
        if prov in PROV and per in ("2021", "2022", "2023", "2024", "2025"):
            u.setdefault(PROV[prov], {})[per] = int(num(val))
with open(ROOT / "data/raw/usurpacion_prov.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["prov", "y2021", "y2022", "y2023", "y2024", "y2025"])
    for p in sorted(u):
        w.writerow([p] + [u[p].get(str(y), "") for y in range(2021, 2026)])
print(len(u), "provincias con usurpación;", "Toledo:", u.get("45"))
