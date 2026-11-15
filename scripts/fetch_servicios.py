"""Descarga de OpenStreetMap (Overpass) los servicios que importan para vivir: colegios, centros sanitarios, hospitales y estaciones.
Salida: data/raw/osm_<categoria>_now.csv  (lat, lon separados por tabulador)
Uso: python3 -I scripts/fetch_servicios.py     (no vuelve a bajar lo que ya está)

Notas de la primera descarga:
- se usa curl porque el Python del sistema (LibreSSL) falla el handshake con overpass-api.de;
- el servidor principal va primero: el espejo kumi devolvió los colegios incompletos (15.758 frente a 21.266);
- una consulta por etiqueta: las uniones con expresiones regulares agotaban el tiempo del servidor.
"""
import pathlib, re, subprocess, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data/raw"
ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
UA = "inmo-growth/0.1 (proyecto personal; datos abiertos)"

CATS = {
    "colegio": ['nwr["amenity"="school"](area.a);'],
    # centros de salud y consultorios: en OSM aparecen como clinic, doctors o healthcare=centre (incluye privados)
    "salud": ['nwr["amenity"="clinic"](area.a);', 'nwr["amenity"="doctors"](area.a);', 'nwr["healthcare"="centre"](area.a);'],
    "hospital": ['nwr["amenity"="hospital"](area.a);'],
    # tren y metro en servicio (los tranvías son tram_stop y quedan fuera)
    "tren": ['nwr["railway"~"^(station|halt)$"]["station"!="miniature"]["tourism"!~"."](area.a);'],
}
LINE = re.compile(r"^-?[\d.]+\t-?[\d.]+$")


def fetch(sel):
    q = f'[out:csv(::lat,::lon;false)][timeout:180];area["ISO3166-1"="ES"][admin_level=2]->.a;({sel});out center;'
    for attempt in range(5):
        for ep in ENDPOINTS:
            r = subprocess.run(["curl", "-sS", "-m", "200", "-A", UA, "--data-urlencode", f"data={q}", ep], capture_output=True, text=True)
            lines = [l for l in r.stdout.splitlines() if LINE.match(l)]
            if lines and len(lines) >= len(r.stdout.splitlines()) - 1:  # si el servidor está saturado devuelve una página de error
                return lines
            print("  reintento", ep.split("/")[2], flush=True)
            time.sleep(15 * (attempt + 1))
    raise RuntimeError("Overpass no responde")


for cat, sels in CATS.items():
    f = OUT / f"osm_{cat}_now.csv"
    if f.exists() and f.stat().st_size > 1000:
        continue
    print("descargando", f.name, flush=True)
    lines = []
    for sel in sels:
        lines += fetch(sel)
        time.sleep(5)
    f.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("  ", len(lines), "filas", flush=True)
