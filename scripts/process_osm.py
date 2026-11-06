"""Asigna cada comercio de OSM al municipio más cercano (centroide Wikidata, máx. 15 km) y cuenta.
Aproximación: no usa polígonos municipales; los comercios están casi siempre en el núcleo principal.
Entrada: data/raw/osm_<cat>_<now|2020>.csv  y  data/raw/coords.csv
Salida:  data/raw/osm_counts.csv
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
idx = {c: i for i, c in enumerate(ids)}


def counts(path):
    pts = []
    for line in open(path, encoding="utf-8"):
        p = line.strip().split("\t")
        if len(p) >= 2:
            try:
                pts.append((float(p[0]), float(p[1])))
            except ValueError:
                pass
    out = np.zeros(len(ids), dtype=np.int32)
    if not pts:
        return out
    a = np.radians(np.array(pts))
    for s in range(0, len(a), 1500):
        lat, lon = a[s:s + 1500, 0][:, None], a[s:s + 1500, 1][:, None]
        # haversine
        h = np.sin((mlat[None, :] - lat) / 2) ** 2 + np.cos(lat) * np.cos(mlat[None, :]) * np.sin((mlon[None, :] - lon) / 2) ** 2
        d = 2 * 6371 * np.arcsin(np.sqrt(h))
        j = d.argmin(axis=1)
        ok = d[np.arange(len(j)), j] <= MAX_KM
        np.add.at(out, j[ok], 1)
    return out


cats = [c for c in ["super", "gym", "horeca"] if (RAW / f"osm_{c}_now.csv").exists()]  # 'uni' lo procesa process_uni.py  # horeca es opcional (consulta muy pesada)
res = {}
tags = ["now"] + (["2020"] if all((RAW / f"osm_{c}_2020.csv").exists() for c in cats) else [])  # 2020 solo si se descargó con --historico
for c in cats:
    for t in tags:
        f = RAW / f"osm_{c}_{t}.csv"
        res[(c, t)] = counts(f)
        print(f.name, int(res[(c, t)].sum()), "asignados")

with open(RAW / "osm_counts.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ine"] + [f"{c}_{t}" for c in cats for t in tags])
    for i, code in enumerate(ids):
        w.writerow([code] + [int(res[(c, t)][i]) for c in cats for t in tags])
print("ok", len(ids))
