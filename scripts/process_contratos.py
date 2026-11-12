"""Obra pública adjudicada por municipio en los últimos 12 meses.
Fuente: Plataforma de Contratación del Sector Público (Ministerio de Hacienda), datos abiertos en ATOM/CODICE, dos conjuntos mensuales:
  - "estado":    licitaciones publicadas en la propia plataforma (Estado, muchos ayuntamientos y diputaciones)
  - "agregadas": licitaciones de las plataformas autonómicas que se agregan (Cataluña, País Vasco, Madrid, Andalucía, Galicia...)
Cada mes pesa ~190 MB comprimido (1,9 GB abierto) y el servidor va lento, así que:
  1) se descarga cada mes, se extraen solo los contratos de OBRAS a data/raw/contratos/<conjunto>_<aaaamm>.jsonl y se borra el zip;
  2) se juntan los meses, se deja la última versión de cada licitación y se asigna a un municipio.
Los .jsonl no se guardan en el repositorio. El certificado del servidor es de la FNMT: curl necesita un almacén que la incluya (el de OpenSSL).

Asignación a municipio (de más a menos fiable):
  "ayto"   el órgano de contratación es un ayuntamiento (código DIR3 L01 + código INE)
  "ciudad" el lugar de ejecución trae un nombre de ciudad que coincide con un único municipio de la provincia
  "titulo" el título de la obra nombra un único municipio de la provincia
Lo que solo indica provincia (autovías, alta velocidad, muchas obras autonómicas) queda sin asignar.

Uso:  python3 scripts/process_contratos.py            # descarga lo que falte y agrega
      python3 scripts/process_contratos.py --solo-agregar
Salida: data/raw/obra_publica_mun.csv (ine, eur, n) y data/raw/obra_publica_top.json (ine -> [[título, €, fecha, enlace, origen], ...])
"""
import collections, csv, datetime, json, pathlib, re, subprocess, sys, unicodedata, zipfile
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIR = ROOT / "data/raw/contratos"
CACERT = "/opt/homebrew/etc/openssl@4/cert.pem"  # incluye la raíz de la FNMT; ajústalo si tu OpenSSL está en otra ruta
FEEDS = {
    "estado": "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3_{m}.zip",
    "agregadas": "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1044/PlataformasAgregadasSinMenores_{m}.zip",
}
MESES = 12
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"

ENTRY = re.compile(r"<entry>(.*?)</entry>", re.S)


def g(pat, s):
    m = re.search(pat, s, re.S)
    return m.group(1).strip() if m else None


def meses():
    hoy = datetime.date.today()
    y, m = hoy.year, hoy.month
    out = []
    for _ in range(MESES):
        m -= 1  # el mes en curso aún no está publicado
        if m == 0:
            y, m = y - 1, 12
        out.append(f"{y}{m:02d}")
    return out


def extraer(zpath, out):
    """Del zip de un mes, guarda una línea JSON por cada versión de contrato de obras (TypeCode 3)."""
    n = 0
    with zipfile.ZipFile(zpath) as z, open(out, "w", encoding="utf-8") as f:
        for name in z.namelist():
            t = z.read(name).decode("utf-8", "replace")
            for m in ENTRY.finditer(t):
                e = m.group(1)
                if g(r"<cbc:TypeCode[^>]*>(.*?)<", e) != "3":
                    continue
                loc = g(r"<cac:RealizedLocation>(.*?)</cac:RealizedLocation>", e) or ""
                adj = [float(x) for x in re.findall(r"<cac:TenderResult>.*?<cac:LegalMonetaryTotal>.*?<cbc:TaxExclusiveAmount[^>]*>([\d.]+)<", e, re.S)]
                f.write(json.dumps({
                    "id": g(r"<id>(.*?)</id>", e),
                    "up": g(r"<updated>(.*?)</updated>", e),
                    "st": g(r"ContractFolderStatusCode[^>]*>(.*?)<", e),
                    "dir3": g(r'schemeName="DIR3">(.*?)<', e),
                    "org": g(r"<cac:PartyName>\s*<cbc:Name>(.*?)<", e),
                    "pres": float(g(r"<cac:BudgetAmount>.*?<cbc:TaxExclusiveAmount[^>]*>([\d.]+)<", e) or 0),
                    "adj": round(sum(adj), 2),
                    "fadj": g(r"<cbc:AwardDate>(.*?)<", e),
                    "nuts": g(r"<cbc:CountrySubentityCode[^>]*>(.*?)<", loc),
                    "city": g(r"<cbc:CityName>(.*?)<", loc),
                    "cp": g(r"<cbc:PostalZone>(.*?)<", loc),
                    "t": re.sub(r"\s+", " ", g(r"<title>(.*?)</title>", e) or "")[:220],
                    "url": (g(r'<link href="(.*?)"', e) or "").replace("&amp;", "&"),
                }, ensure_ascii=False) + "\n")
                n += 1
    return n


def bajar(job):
    feed, mes = job
    out = DIR / f"{feed}_{mes}.jsonl"
    if out.exists():
        return f"{feed} {mes}: ya estaba"
    zpath = DIR / f"{feed}_{mes}.zip"
    if not zpath.exists():
        tmp = zpath.with_suffix(".part")
        r = subprocess.run(["curl", "-sS", "-f", "-m", "3000", "--retry", "3", "--cacert", CACERT, "-A", UA, "-o", str(tmp), FEEDS[feed].format(m=mes)], capture_output=True, text=True)
        if r.returncode != 0:
            tmp.unlink(missing_ok=True)
            return f"{feed} {mes}: ERROR de descarga ({r.stderr.strip()[:120]})"
        tmp.rename(zpath)
    try:
        n = extraer(zpath, out.with_suffix(".tmp"))
    except zipfile.BadZipFile:
        zpath.unlink(missing_ok=True)
        return f"{feed} {mes}: ERROR, zip corrupto (borrado; vuelve a lanzar)"
    out.with_suffix(".tmp").rename(out)
    zpath.unlink()
    return f"{feed} {mes}: {n} versiones de contratos de obras"


def na(s):
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", unicodedata.normalize("NFD", (s or "").lower()).encode("ascii", "ignore").decode()).split())


def agregar():
    rows = json.load(open(ROOT / "public/municipios.json"))["rows"]
    ids = {r["id"] for r in rows}
    por_prov = collections.defaultdict(dict)  # provincia -> nombre normalizado -> ine (None si se repite)
    for r in rows:
        for part in r["n"].split("/"):
            k = na(part)
            d = por_prov[r["id"][:2]]
            d[k] = None if k in d and d[k] != r["id"] else r["id"]
    # última versión de cada licitación
    recs = {}
    files = sorted(DIR.glob("*.jsonl"))
    for fp in files:
        for line in open(fp, encoding="utf-8"):
            x = json.loads(line)
            if x["id"] not in recs or recs[x["id"]]["up"] < x["up"]:
                recs[x["id"]] = x
    desde = (datetime.date.today() - datetime.timedelta(days=365)).isoformat()
    R = [x for x in recs.values() if x["st"] in ("ADJ", "RES") and (x["fadj"] or x["up"][:10]) >= desde]
    # provincia de cada código NUTS3, aprendida de los contratos de ayuntamientos (que traen las dos cosas)
    votos = collections.defaultdict(collections.Counter)
    for x in R:
        d = x["dir3"] or ""
        if d.startswith("L01") and d[3:8] in ids and len(x["nuts"] or "") == 5:
            votos[x["nuts"]][d[3:5]] += 1
    nuts_prov = {k: v.most_common(1)[0][0] for k, v in votos.items()}
    # las plataformas autonómicas no traen código DIR3, así que sus provincias no se pueden aprender: se fijan a mano
    nuts_prov.update({"ES511": "08", "ES512": "17", "ES513": "25", "ES514": "43", "ES211": "01", "ES212": "20", "ES213": "48", "ES220": "31",
                      "ES230": "26", "ES300": "28", "ES111": "15", "ES112": "27", "ES113": "32", "ES114": "36", "ES611": "04", "ES612": "11",
                      "ES613": "14", "ES614": "18", "ES615": "21", "ES616": "23", "ES617": "29", "ES618": "41"})
    AYTO = re.compile(r"\b(ajuntament|ayuntamiento|concello|udala)\b")

    def ubicar(x):
        d = x["dir3"] or ""
        if d.startswith("L01") and d[3:8] in ids:
            return d[3:8], "ayto"
        prov = x["cp"][:2] if x["cp"] and len(x["cp"]) == 5 else nuts_prov.get(x["nuts"] or "")
        if not prov:
            return None, None
        names = por_prov.get(prov, {})
        # ayuntamiento reconocido por su nombre ("Ajuntament de Martorell", "Ayuntamiento de Galdakao-Alcalde", "Concello de...")
        o = f" {na(x['org'])} "
        if AYTO.search(o):
            hit = max((k for k, i in names.items() if i and f" {k} " in o), key=len, default=None)
            if hit:
                return names[hit], "ayto"
        c = na(x["city"])
        if c and names.get(c):
            return names[c], "ciudad"
        t = f" {na(x['t'])} "
        hits = {i for k, i in names.items() if i and len(k) >= 5 and f" {k} " in t}
        if len(hits) == 1:
            return hits.pop(), "titulo"
        return None, None

    tot = collections.Counter()
    eur_src = collections.Counter()
    n_src = collections.Counter()
    mun = collections.defaultdict(list)
    for x in R:
        eur = x["adj"] or x["pres"]
        if eur <= 0 or eur > 2e9:  # importes absurdos (acuerdos marco, erratas)
            continue
        ine, src = ubicar(x)
        n_src[src] += 1
        eur_src[src] += eur
        if ine:
            tot[ine] += eur
            mun[ine].append([x["t"], round(eur), (x["fadj"] or x["up"])[:10], x["url"], src])
    with open(ROOT / "data/raw/obra_publica_mun.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ine", "eur", "n"])
        for ine in sorted(tot):
            w.writerow([ine, round(tot[ine]), len(mun[ine])])
    top = {ine: sorted(v, key=lambda o: -o[1])[:3] for ine, v in mun.items()}
    json.dump(top, open(ROOT / "data/raw/obra_publica_top.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(f"{len(files)} ficheros mensuales; {len(recs)} licitaciones de obras; {len(R)} adjudicadas desde {desde}")
    print("por nº:", dict(n_src))
    print("por importe (M€):", {k: round(v / 1e6) for k, v in eur_src.items()})
    g5 = [r for r in rows if r["pop"] >= 5000]
    print(f"municipios con obra: {len(tot)}; de 5.000 hab. o más: {sum(1 for r in g5 if r['id'] in tot)} de {len(g5)}")
    por_ccaa = collections.Counter(r["id"][:2] for r in g5 if r["id"] not in tot)
    print("provincias con más municipios (>=5.000) sin obra:", por_ccaa.most_common(8))


if __name__ == "__main__":
    DIR.mkdir(parents=True, exist_ok=True)
    if "--solo-agregar" not in sys.argv:
        jobs = [(f, m) for m in meses() for f in FEEDS]
        with ThreadPoolExecutor(3) as ex:
            for msg in ex.map(bajar, jobs):
                print(msg, flush=True)
    agregar()
