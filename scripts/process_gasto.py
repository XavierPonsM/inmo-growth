"""Agrega la inversión real (capítulo 6) y transferencias de capital (capítulo 7) de los ayuntamientos.
Fuente: Hacienda, CONPREL, liquidaciones de presupuestos (ACCESS, máximo desglose), obligaciones reconocidas netas.

Entrada: CSV exportados con mdb-export (tb_economica y tb_inventario) por año.
Uso: python3 -I scripts/process_gasto.py <dir_con_csv>   (espera e19.csv,i19.csv,e24.csv,i24.csv)
Salida: data/raw/gasto_cap6.csv  (ine, inv2019, inv2024, cap7_2024)
"""
import csv, pathlib, sys, collections

src = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(year):
    yy = str(year)[2:]
    # entidades principales (ayuntamientos): sufijo AA000 -> código INE de 5 dígitos
    ent = {}
    for r in csv.DictReader(open(src / f"i{yy}.csv", encoding="utf-8")):
        cod = r["codbdgel"].strip()
        if cod[5:] == "AA000":
            ent[r["idente"]] = cod[:5]
    rows = collections.defaultdict(dict)  # idente -> {cdcta: importe}
    for r in csv.DictReader(open(src / f"e{yy}.csv", encoding="utf-8")):
        if r["tipreig"] != "G" or r["idente"] not in ent:
            continue
        k = r["cdcta"].strip()
        if k[:1] in ("6", "7"):
            rows[r["idente"]][k] = rows[r["idente"]].get(k, 0.0) + float(r["importer"] or 0)
    out = collections.defaultdict(lambda: {"6": 0.0, "7": 0.0})
    for ide, codes in rows.items():
        # solo filas sin ancestro presente (evita doble conteo entre niveles de desglose)
        for k, v in codes.items():
            base = k.split(".")[0]
            if any(base[:n] in codes for n in range(1, len(base))):
                continue
            out[ent[ide]][k[0]] += v
    return out


a19, a24 = load(2019), load(2024)
rows = []
for ine in sorted(set(a19) | set(a24)):
    rows.append([ine, round(a19.get(ine, {}).get("6", 0), 2), round(a24.get(ine, {}).get("6", 0), 2), round(a24.get(ine, {}).get("7", 0), 2)])
with open(ROOT / "data/raw/gasto_cap6.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ine", "inv2019", "inv2024", "cap7_2024"])
    w.writerows(rows)
print(len(rows), "municipios; total cap6 2024 = %.0f M€" % (sum(r[2] for r in rows) / 1e6), "2019 = %.0f M€" % (sum(r[1] for r in rows) / 1e6))
