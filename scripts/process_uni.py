"""Universidades por municipio = Wikidata (instituciones filtradas) + campus de OpenStreetMap (amenity=university).
Entrada: data/raw/wikidata_universidades.csv, data/raw/osm_uni_now.csv, data/raw/coords.csv
Salida:  data/raw/universidades.csv  (ine, wd, osm, names)
Aproximación: sin cifras de alumnos (Wikidata solo las tiene para unas pocas); sirve como señal de presencia/tamaño.
"""
import csv, pathlib, re, collections
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw"
munis = [(r["ine"], float(r["lat"]), float(r["lon"])) for r in csv.DictReader(open(RAW / "coords.csv"))]
ids = [m[0] for m in munis]
mlat = np.radians([m[1] for m in munis]); mlon = np.radians([m[2] for m in munis])


idx = {m: i for i, m in enumerate(ids)}
dist = collections.defaultdict(list)  # ine -> distancias (km) de cada punto de campus al centro del municipio


def km(lat, lon, i):
    la, lo = np.radians(lat), np.radians(lon)
    h = np.sin((mlat[i] - la) / 2) ** 2 + np.cos(la) * np.cos(mlat[i]) * np.sin((mlon[i] - lo) / 2) ** 2
    return float(2 * 6371 * np.arcsin(np.sqrt(h)))


def nearest(lat, lon, max_km):
    la, lo = np.radians(lat), np.radians(lon)
    h = np.sin((mlat - la) / 2) ** 2 + np.cos(la) * np.cos(mlat) * np.sin((mlon - lo) / 2) ** 2
    d = 2 * 6371 * np.arcsin(np.sqrt(h))
    j = int(d.argmin())
    return ids[j] if d[j] <= max_km else None


IS_UNI = re.compile(r"^(Universidad|Universitat|Universidade|Unibertsitatea|University)\b", re.I)
BAD = re.compile(r"(Siglo|Antigua|Real Universidad|Estudis|Bircham|Royal|Internacional de Andaluc|Ateneo|Seminario|Instituto|Academia|Escuela|Facultad|Faculty|Edificio|Central$|Osuna)", re.I)

wd = collections.defaultdict(set)  # ine -> {nombre base}
for r in csv.DictReader(open(RAW / "wikidata_universidades.csv", encoding="utf-8")):
    name = r["uLabel"].split(" - ")[0].strip()
    if not IS_UNI.search(name) or BAD.search(name):
        continue
    ine = r["ine"] or (nearest(float(r["lat"]), float(r["lon"]), 8) if r["lat"] else None)
    if ine in ids:
        wd[ine].add(name)
        if r["lat"]:
            dist[ine].append(km(float(r["lat"]), float(r["lon"]), idx[ine]))

osm = collections.Counter()
for line in open(RAW / "osm_uni_now.csv", encoding="utf-8"):
    p = line.strip().split("\t")
    if len(p) >= 2:
        try:
            j = nearest(float(p[0]), float(p[1]), 8)
        except ValueError:
            continue
        if j:
            osm[j] += 1
            dist[j].append(km(float(p[0]), float(p[1]), idx[j]))

# Nombres de OpenStreetMap (amenity=university con nombre) para los municipios que Wikidata no cubre: sede de la UIB en Alaior, UC3M en Getafe...
# Se descargan con: [out:csv(::lat,::lon,name;true;"\t")];area["ISO3166-1"="ES"][admin_level=2]->.es;nwr["amenity"="university"](area.es);out center;
osm_names = collections.defaultdict(collections.Counter)
_namef = RAW / "osm_uni_names.tsv"
if _namef.exists():
    for line in open(_namef, encoding="utf-8").read().splitlines()[1:]:
        p_ = line.split("\t")
        if len(p_) >= 3 and p_[2].strip():
            try:
                j = nearest(float(p_[0]), float(p_[1]), 8)
            except ValueError:
                continue
            nm = p_[2].strip()
            if j and IS_UNI.search(nm) or (j and re.match(r"^(Campus|Facultad|Escuela|Sede|Seu|Centre|Centro)\b", nm, re.I)):
                osm_names[j][nm] += 1

rows = []
for ine in sorted(set(wd) | {k for k, v in osm.items() if v >= 1}):  # una sola sede en OSM también cuenta (p. ej. la UIB en Alaior)
    names = sorted(wd.get(ine, []))
    if not names and osm_names.get(ine):  # sin Wikidata: nombres de OSM, primero los que se llaman "Universidad..."
        names = sorted(osm_names[ine], key=lambda n: (not IS_UNI.search(n), -osm_names[ine][n], n))
    rows.append([ine, len(wd.get(ine, [])), osm.get(ine, 0), "; ".join(names[:8]), round(min(dist[ine]), 1) if dist.get(ine) else ""])
with open(RAW / "universidades.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(["ine", "wd", "osm", "names", "dkm"]); w.writerows(rows)
print(len(rows), "municipios con universidad;", sum(1 for r in rows if r[1]), "por Wikidata;", sum(1 for r in rows if r[2] >= 2), "por OSM")
