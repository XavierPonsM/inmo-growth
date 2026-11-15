"""Servicios para vivir por municipio, a partir de los puntos de OpenStreetMap que baja fetch_servicios.py.
- colegios y centros sanitarios: los que hay a menos de 3 km del centro del municipio (mide lo que se tiene a mano, no depende de los
  límites municipales y no penaliza a las ciudades grandes como lo haría un recuento por habitante)
- estaciones en el municipio: asignando cada una al centro de municipio más cercano (máx. 15 km), como en process_osm.py
- hospital y estación de tren o metro: km en línea recta desde el centro del municipio al más cercano
Aproximación: no usa polígonos municipales, y OpenStreetMap no está igual de completo en todas partes.
Salida: data/raw/servicios_mun.csv (ine, col, sal, hospKm, trenKm, trenN)
"""
import csv, pathlib
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / "data/raw"
MAX_KM = 15.0

munis = [(r["ine"], float(r["lat"]), float(r["lon"])) for r in csv.DictReader(open(RAW / "coords.csv"))]
ids = [m[0] for m in munis]
mlat = np.radians(np.array([m[1] for m in munis]))
mlon = np.radians(np.array([m[2] for m in munis]))


def puntos(cat):
    pts = []
    for line in open(RAW / f"osm_{cat}_now.csv", encoding="utf-8"):
        p = line.strip().split("\t")
        if len(p) >= 2:
            try:
                pts.append((float(p[0]), float(p[1])))
            except ValueError:
                pass
    return np.radians(np.array(sorted(set(pts))))  # sin duplicados exactos


def dist(a, s):
    lat, lon = a[s:s + 1500, 0][:, None], a[s:s + 1500, 1][:, None]
    h = np.sin((mlat[None, :] - lat) / 2) ** 2 + np.cos(lat) * np.cos(mlat[None, :]) * np.sin((mlon[None, :] - lon) / 2) ** 2
    return 2 * 6371 * np.arcsin(np.sqrt(h))  # puntos x municipios


def contar(a):
    out = np.zeros(len(ids), dtype=np.int32)
    for s in range(0, len(a), 1500):
        d = dist(a, s)
        j = d.argmin(axis=1)
        ok = d[np.arange(len(j)), j] <= MAX_KM
        np.add.at(out, j[ok], 1)
    return out


def alrededor(a, km=3.0):
    out = np.zeros(len(ids), dtype=np.int32)
    for s in range(0, len(a), 1500):
        out += (dist(a, s) <= km).sum(axis=0)
    return out


def cercano(a):
    best = np.full(len(ids), np.inf)
    for s in range(0, len(a), 1500):
        best = np.minimum(best, dist(a, s).min(axis=0))
    return best


col, sal = alrededor(puntos("colegio")), alrededor(puntos("salud"))
hosp, tren = puntos("hospital"), puntos("tren")
hkm, tkm, tn = cercano(hosp), cercano(tren), contar(tren)
with open(RAW / "servicios_mun.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ine", "col", "sal", "hospKm", "trenKm", "trenN"])
    for i, code in enumerate(ids):
        w.writerow([code, int(col[i]), int(sal[i]), round(float(hkm[i]), 1), round(float(tkm[i]), 1), int(tn[i])])
print("colegios a 3 km (suma)", int(col.sum()), "| salud a 3 km (suma)", int(sal.sum()), "| hospitales", len(hosp), "| estaciones", len(tren))
