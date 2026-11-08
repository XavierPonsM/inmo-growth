"""Distancia al mar de cada municipio (km, en línea recta desde su punto central a la línea de costa más cercana).
Entrada: Natural Earth 10m coastline (dominio público):
  curl -o /tmp/coast.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_coastline.geojson
         data/raw/coords.csv
Salida:  data/raw/costa_mun.csv  (ine, km)
Los vértices de la costa se densifican a ~1 km para que el error sea pequeño.
Uso: python3 scripts/process_costa.py /tmp/coast.geojson
"""
import csv, json, pathlib, sys
import numpy as np
from scipy.spatial import cKDTree

ROOT = pathlib.Path(__file__).resolve().parent.parent
gj = json.load(open(sys.argv[1]))
pts = []
for f in gj["features"]:
    g = f["geometry"]
    lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
    for ln in lines:
        for (x0, y0), (x1, y1) in zip(ln[:-1], ln[1:]):
            if not (-12 < x0 < 6 and 33 < y0 < 46) and not (-12 < x1 < 6 and 33 < y1 < 46):
                continue  # solo la zona de España (más margen)
            n = max(1, int(np.hypot((x1 - x0) * 0.8, y1 - y0) * 111 / 1.0))
            t = np.linspace(0, 1, n, endpoint=False)
            pts += list(zip(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
pts = np.array(pts)


def xyz(lon, lat):
    la, lo = np.radians(lat), np.radians(lon)
    return np.c_[6371 * np.cos(la) * np.cos(lo), 6371 * np.cos(la) * np.sin(lo), 6371 * np.sin(la)]


tree = cKDTree(xyz(pts[:, 0], pts[:, 1]))
rows = list(csv.DictReader(open(ROOT / "data/raw/coords.csv")))
d, _ = tree.query(xyz(np.array([float(r["lon"]) for r in rows]), np.array([float(r["lat"]) for r in rows])))
with open(ROOT / "data/raw/costa_mun.csv", "w", newline="") as f:
    w = csv.writer(f); w.writerow(["ine", "km"])
    for r, k in zip(rows, d):
        w.writerow([r["ine"], round(float(k), 1)])
print(len(pts), "puntos de costa;", len(rows), "municipios")
