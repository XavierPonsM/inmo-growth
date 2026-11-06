"""Descarga de OpenStreetMap (Overpass) los comercios clave de España en dos fechas.
Salida: data/raw/osm_<categoria>_<año>.csv  (lat,lon)  — 'now' = estado actual, '2020' = 1 nov 2020.
Uso: python3 -I scripts/fetch_osm.py
"""
import pathlib, time, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw"
# kumi primero: el Python del sistema (LibreSSL) falla el handshake con overpass-api.de
ENDPOINTS = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"]
UA = "inmo-growth/0.1 (proyecto personal; datos abiertos)"

CATS = {
    "super": 'nwr["shop"="supermarket"](area.a);',
    "gym": 'nwr["leisure"="fitness_centre"](area.a);',
    "uni": 'nwr["amenity"="university"](area.a);',
    # "horeca": 'nwr["amenity"~"^(restaurant|cafe|bar)$"](area.a);',  # consulta demasiado pesada para el Overpass público
}
import sys
DATES = {"now": ""}
if "--historico" in sys.argv:  # consultas 'attic' muy pesadas: el Overpass público suele estar saturado
    DATES["2020"] = '[date:"2020-11-01T00:00:00Z"]'


def fetch(query):
    body = urllib.parse.urlencode({"data": query}).encode()
    for attempt in range(6):
        for ep in ENDPOINTS:
            try:
                req = urllib.request.Request(ep, data=body, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=600) as r:
                    return r.read().decode("utf-8")
            except Exception as e:  # 429/504: esperar y reintentar
                print("  retry", ep.split("/")[2], e)
                time.sleep(20 * (attempt + 1))
    raise RuntimeError("Overpass no responde")


for cat, sel in CATS.items():
    for tag, date in DATES.items():
        f = OUT / f"osm_{cat}_{tag}.csv"
        if f.exists() and f.stat().st_size > 1000:
            continue
        q = f'[out:csv(::lat,::lon;false)][timeout:600]{date};area["ISO3166-1"="ES"][admin_level=2]->.a;({sel});out center;'
        print("descargando", f.name, flush=True)
        f.write_text(fetch(q), encoding="utf-8")
        print("  ", sum(1 for _ in open(f)), "filas", flush=True)
        time.sleep(5)
