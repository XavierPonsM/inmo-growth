"""Descarga histórica (1-nov-2020) de supermercados y gimnasios de OSM, por teselas, con curl.
Overpass 'attic' solo lo soporta overpass-api.de, que falla el handshake con el Python del sistema, por eso curl.
Cada tesela se guarda en data/raw/osm_hist_tiles/ (se puede interrumpir y reanudar).
Salida: data/raw/osm_super_2020.csv y data/raw/osm_gym_2020.csv
Uso: python3 scripts/fetch_osm_hist.py
"""
import pathlib, subprocess, sys, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
NOW = "--now" in sys.argv  # estado actual con las MISMAS teselas (misma base geográfica que el histórico)
SUF = "now" if NOW else "2020"
TILES = ROOT / ("data/raw/osm_now_tiles" if NOW else "data/raw/osm_hist_tiles")
TILES.mkdir(parents=True, exist_ok=True)
URL = "https://overpass-api.de/api/interpreter"
STEP = 2.0

# (lat_min, lat_max, lon_min, lon_max): península + Baleares, y Canarias
BOXES = [(35.9, 43.9, -9.4, 4.5), (27.5, 29.5, -18.3, -13.3)]


def tiles():
    for la0, la1, lo0, lo1 in BOXES:
        la = la0
        while la < la1:
            lo = lo0
            while lo < lo1:
                yield (round(la, 2), round(lo, 2), round(min(la + STEP, la1), 2), round(min(lo + STEP, lo1), 2))
                lo += STEP
            la += STEP


def run(t):
    f = TILES / f"{t[0]}_{t[1]}.tsv"
    if f.exists():
        return True
    bb = f"({t[0]},{t[1]},{t[2]},{t[3]})"
    date = "" if NOW else '[date:"2020-11-01T00:00:00Z"]'
    q = (f'[out:csv(::lat,::lon,shop,leisure;false)][timeout:300]{date};'
         f'(nwr["shop"="supermarket"]{bb};nwr["leisure"="fitness_centre"]{bb};);out center;')
    for attempt in range(8):
        r = subprocess.run(["curl", "-s", "-m", "340", "-A", "inmo-growth/0.1 (proyecto personal)", URL, "--data-urlencode", f"data={q}"],
                           capture_output=True, text=True)
        out = r.stdout
        bad = (not out.strip() and r.returncode != 0) or "Gateway Timeout" in out or "<html" in out[:200].lower() or "runtime error" in out.lower() or "too many requests" in out.lower()
        if not bad:
            f.write_text(out, encoding="utf-8")
            print(t, len([l for l in out.splitlines() if l.strip()]), "filas", flush=True)
            return True
        print(t, "reintento", attempt + 1, out[:60].replace("\n", " "), flush=True)
        time.sleep(30 * (attempt + 1))
    return False


failed = [t for t in tiles() if not run(t)]
if failed:
    print("FALLARON", failed)
    sys.exit(1)

sup, gym = [], []
for f in sorted(TILES.glob("*.tsv")):
    for line in f.read_text(encoding="utf-8").splitlines():
        p = line.split("\t")
        if len(p) >= 4 and p[0]:
            (sup if p[2] == "supermarket" else gym if p[3] == "fitness_centre" else []).append(f"{p[0]}\t{p[1]}")
(ROOT / f"data/raw/osm_super_{SUF}.csv").write_text("\n".join(sup) + "\n", encoding="utf-8")
(ROOT / f"data/raw/osm_gym_{SUF}.csv").write_text("\n".join(gym) + "\n", encoding="utf-8")
print(f"OK supermercados {SUF}:", len(sup), f"gimnasios {SUF}:", len(gym))
