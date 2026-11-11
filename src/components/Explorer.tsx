"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Row = {
  id: string;
  n: string;
  prov: string;
  pop: number;
  abs: number;
  g5: number;
  g1: number;
  cagr: number;
  lat: number;
  lon: number;
  score: number | null;
  fut: number | null; // índice de futuro (proyección, suelo disponible, obra nueva, proyectos)
  inv: number | null; // inversión real media 2019/2024, €/hab
  inv24: number | null; // inversión real 2024, €/hab
  invT: number | null; // inversión real 2024, € totales
  sInv: number | null; // percentil de inversión (0-100)
  sup: number | null; // supermercados hoy (OSM)
  gym: number | null; // gimnasios hoy
  hor: number | null; // bares, cafés y restaurantes hoy
  dS: number | null; // variación desde nov-2020
  dG: number | null;
  dH: number | null;
  negPc: number | null; // negocios ponderados por 1.000 hab.
  sNeg: number | null; // percentil de negocios
  uni: number; // nº de universidades (Wikidata)
  uniOsm: number; // elementos de campus en OSM (proxy de tamaño)
  uniN: string | null; // nombres (hasta 3)
  uniD: number | null; // km del centro del municipio a su propio campus
  ps: number[] | null; // habitantes por año desde psY
  vtS: [number, number][] | null; // [año, €/m² tasado]
  uniNear: string | null; // universidad que más aporta (puede estar en otro municipio)
  uniKm: number | null; // km estimados por carretera hasta ella
  uniAt: string | null; // municipio donde está, si no es el propio
  m18: number | null; // % menores de 18 años
  m65: number | null; // % de 65 y más
  edM: number | null; // edad media
  costa: number | null; // km al mar
  paro: number | null; // paro registrado / población de 18-64 (%)
  paroT: number | null; // variación interanual del paro, en puntos
  sJuv: number | null;
  sParo: number | null;
  sParoT: number | null;
  sCos: number | null;
  sCiu: number | null;
  suelo: number | null; // €/m² suelo urbano (provincia y tramo de población)
  sueloG: number | null; // variación % en 5 años
  sPop: number | null; // percentil población (compuesto)
  sUni: number | null; // 0-100 tamaño universitario
  sSuelo: number | null; // percentil de revalorización del suelo
  vt: number | null; // valor tasado vivienda libre €/m² (solo >25.000 hab.)
  vtG: number | null; // variación % en 5 años
  vtN: number | null; // tasaciones en los últimos 4 trimestres
  sVt: number | null; // percentil de revalorización de la vivienda
  proy: number | null; // % población provincial 2026-2041 (INE)
  solarN: number | null; // nº de solares (Catastro)
  solarPc: number | null; // m² de solar por habitante
  solarSh: number | null; // % del suelo urbano que es solar
  vivN: number | null; // viviendas nuevas en 5 años (Catastro)
  vivPm: number | null; // por 1.000 habitantes
  sProy: number | null;
  sSolar: number | null;
  sViv: number | null;
  pend: number | null; // viviendas previstas pendientes de materializar (SIU)
  pendK: number | null; // por 1.000 habitantes
  pendNo: number | null; // % del suelo de desarrollo sin urbanizar
  aeP: number | null; // m² edificables de actividad económica pendientes por habitante
  plan: string | null; // figura de planeamiento vigente y año
  sPend: number | null;
  sAe: number | null;
  proj: { t: string; n: string; e: string; u: string }[] | null; // proyectos concretos (lista curada, con fuente)
  // Calidad de la zona (no entra en el índice de crecimiento)
  crim: number | null; // hechos conocidos de criminalidad convencional por 1.000 hab. (2025; solo municipios >20.000 hab.)
  crimT: number | null; // variación % frente a 2024
  crimV: number | null; // delitos violentos por 1.000 hab.
  crimD: number | null; // robos con fuerza en domicilios por 1.000 hab.
  ocup: number | null; // allanamiento/usurpación por 10.000 hab. (PROVINCIA)
  ocupT: number | null; // variación % 2021-2025 (provincia)
  renta: number | null; // renta neta media por persona (€)
  rentaH: number | null; // renta neta media por hogar (€)
  pob: number | null; // % de población con ingresos bajo el 60 % de la mediana
  sSeg: number | null; // 0-100, más alto = más seguro
  sOcup: number | null; // 0-100, más alto = menos okupación provincial
  sRenta: number | null;
  sPob: number | null; // 0-100, más alto = menos pobreza
  zona: number | null; // 0-100: calidad de la zona
  okR: number | null; // riesgo de okupación estimado (0 bajo - 100 alto)
  okX: number | null; // veces la media nacional (estimado para el municipio)
  okP: number | null; // la provincia, veces la media nacional
  okJ: number | null; // juicios por ocupación ilegal por 10.000 hab. en la provincia (CGPJ)
  ocupS: number[] | null; // denuncias de allanamiento/usurpación en la provincia, 2021-2025
  vac: number | null; // % de viviendas vacías (Censo 2021)
  vacN: number | null;
  sVac: number | null;
  tur: number | null; // % de viviendas turísticas (INE)
  turN: number | null; // nº de viviendas turísticas
  turP: number | null; // plazas turísticas por 100 habitantes
  pern: number | null; // pernoctaciones al año en alojamientos turísticos (solo puntos turísticos del INE)
  pernH: number | null; // por habitante
  pernT: number | null; // variación anual (%)
  pernY: number | null; // año
  dc: number; // km hasta la ciudad grande (más de 100.000 hab.) más cercana
  cn: string; // nombre de esa ciudad
};

type ZRef = { cgpj?: number | null; vac: number | null; crim: number | null; ocup: number | null; renta: number | null; pob: number | null };

// Veredicto de zona (criterio orientativo)
function zoneVerdict(z: number | null): { label: string; emoji: string; cls: string } {
  if (z === null) return { label: "Sin datos suficientes", emoji: "⚪", cls: "bg-paper text-muted border-edge" };
  if (z >= 60) return { label: "Zona buena", emoji: "🟢", cls: "bg-tint text-forest border-forest/40" };
  if (z >= 40) return { label: "Zona media", emoji: "🟡", cls: "bg-gold-soft text-ink border-gold/60" };
  return { label: "Zona por debajo de la media", emoji: "🔴", cls: "bg-brick-soft text-brick border-brick/40" };
}

// Riesgo de okupación estimado: niveles
const okLevel = (v: number) => (v < 40 ? "Bajo" : v < 60 ? "Medio" : v < 75 ? "Medio-alto" : "Alto");
const okDot = (v: number | null) => (v === null ? "var(--edge)" : v < 40 ? "var(--forest)" : v < 60 ? "var(--gold)" : "var(--brick)");

// Veredicto orientativo para un inversor: cruza crecimiento, zona y riesgo de okupación. Reglas fijas, no asesoramiento.
type Rec = { lvl: 0 | 1 | 2 | 3; label: string; color: string; good: string[]; warn: string[]; bad: string[] };
const REC_LABEL = ["Descartar", "Con cautela", "A estudiar", "Buena candidata"] as const;
const REC_COLOR = ["var(--brick)", "var(--gold)", "#5a9a72", "var(--forest)"] as const;
function recommend(r: Row): Rec | null {
  if (r.score === null) return null;
  const good: string[] = [], warn: string[] = [], bad: string[] = [];
  if (r.score < 40) bad.push("crecimiento bajo");
  else if (r.score < 50) warn.push("crecimiento discreto");
  else if (r.score >= 60) good.push("crecimiento alto");
  if (r.zona === null) warn.push("zona sin verificar (sin datos de seguridad)");
  else if (r.zona < 40) bad.push("zona por debajo de la media");
  else if (r.zona < 55) warn.push("zona media");
  else good.push("zona buena");
  if (r.okR !== null) {
    if (r.okR >= 75) bad.push("riesgo de okupación alto");
    else if (r.okR >= 60) warn.push("riesgo de okupación medio-alto");
    else if (r.okR < 40) good.push("riesgo de okupación bajo");
  }
  if ((r.pendK ?? 0) >= 3000) warn.push("planeamiento sobredimensionado");
  const hard = warn.filter((w) => !w.startsWith("zona sin verificar"));
  const lvl: Rec["lvl"] =
    bad.length > 0 ? 0 : r.score >= 60 && r.zona !== null && r.zona >= 55 && r.okR !== null && r.okR < 60 && hard.length === 0 ? 3 : r.score >= 50 && hard.length === 0 ? 2 : 1;
  return { lvl, label: REC_LABEL[lvl], color: REC_COLOR[lvl], good, warn, bad };
}

const PROJ_ICON: Record<string, string> = { industria: "🏭", datos: "🖥️", ferrocarril: "🚄", sanidad: "🏥", vivienda: "🏘️" };
type Data = { years: [number, number]; psY: number; vtProv?: Record<string, [number, number][]>; negHist: boolean; proyYears: [number, number] | null; zref: ZRef; rows: Row[] };
// Sectores de desarrollo del SIU (se cargan al abrir una ficha): [nombre, clase, uso, hectáreas, edificabilidad m² de techo]
type SectInfo = { s: [string, string, string | null, number | null, number | null][]; n: number; r: number; rha: number };

const fmt = new Intl.NumberFormat("es-ES");
const sgn = (n: number) => (n > 0 ? "+" : "") + n;
const SRC = "munis";
// El worker se sirve desde /public (copiado de node_modules) porque el bundler de Next no lo resuelve.
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// Escala de color del índice (misma que el mapa y la leyenda): un solo tono, de arena a verde bosque (más calmada que mezclar varios)
const STOPS: [number, [number, number, number], string][] = [
  [0, [221, 229, 168], "#DDE5A8"],
  [30, [183, 210, 122], "#B7D27A"],
  [48, [120, 184, 90], "#78B85A"],
  [62, [46, 154, 94], "#2E9A5E"],
  [80, [11, 93, 69], "#0B5D45"], // las puntuaciones reales llegan hasta ~80: la escala satura ahí
];
function scoreColor(v: number): string {
  for (let i = 1; i < STOPS.length; i++) {
    if (v <= STOPS[i][0]) {
      const [a, ca] = STOPS[i - 1];
      const [b, cb] = STOPS[i];
      const t = (v - a) / (b - a);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * t)).join(",")})`;
    }
  }
  return "rgb(47,70,56)";
}
// Radio de la burbuja según la puntuación: 2 px (puntuación ~0) hasta 14 px (80 o más) a zoom 5; el doble a zoom 10 (k = 1 ó 2)
const SIZE_AT = (k: number) =>
  ["*", k, ["+", 2, ["*", 12, ["^", ["/", ["min", ["get", "score"], 80], 80], 2]]]] as unknown as maplibregl.ExpressionSpecification;
// Expresión de color de MapLibre y degradado de la leyenda, derivados de la misma escala
const MAP_COLOR = ["interpolate", ["linear"], ["get", "score"], ...STOPS.flatMap(([v, , hex]) => [v, hex])];
const LEGEND_GRADIENT = `linear-gradient(90deg, ${STOPS.map(([v, , hex]) => `${hex} ${v}%`).join(", ")})`;

function Bar({ label, value, hint, weight }: { label: string; value: number | null; hint: string; weight: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold text-ink">
          {label} <span className="font-normal text-muted">· {weight}</span>
        </span>
        <span className="font-semibold tabular-nums text-ink">{value === null ? "sin datos" : value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
        {value !== null && <div className="h-full rounded-full" style={{ width: `${Math.max(value, 2)}%`, background: scoreColor(Math.max(value, 8)) }} />}
      </div>
      <div className="mt-1 text-xs text-muted">{hint}</div>
    </div>
  );
}

const fmt1 = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ---- Enlaces de compra (idealista) ----
const noAcc = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slug = (s: string) => noAcc(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
// Nombres de provincia (como en el dataset) -> como las escribe idealista
const IDEALISTA_PROV: Record<string, string> = {
  Baleares: "balears",
  "A Coruña": "a-coruna",
  "Las Palmas": "las-palmas",
  "S.C. Tenerife": "santa-cruz-de-tenerife",
  Bizkaia: "vizcaya",
  Gipuzkoa: "guipuzcoa",
  "Álava": "alava",
};
function muniSlug(name: string): string {
  let n = name;
  if (n.includes("/")) n = n.split("/").sort((a, b) => b.length - a.length)[0]; // "Alacant/Alicante" -> "Alicante"
  const m = n.match(/^(.+?),\s*(.+)$/); // "Muela, La" -> "La Muela"
  if (m) n = `${m[2]} ${m[1]}`;
  return slug(n);
}
function idealistaUrl(r: Row): string {
  return `https://www.idealista.com/venta-viviendas/${muniSlug(r.n)}-${IDEALISTA_PROV[r.prov] ?? slug(r.prov)}/`;
}
function googleUrl(r: Row): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`idealista venta viviendas ${r.n} ${r.prov}`)}`;
}

// ---- Factores del índice: peso nominal, percentil (0-100) y explicación con datos ----
type Factor = { k: string; label: string; w: number; v: number | null; hint: string; group: "past" | "future" | "context" };
function buildFactors(s: Row, d: Data | null, hist: boolean): Factor[] {
  const yrs = (d?.years[1] ?? 0) - (d?.years[0] ?? 0);
  return [
    { k: "pop", label: "Población", w: 0.25, v: s.sPop, group: "past", hint: `${sgn(s.g5)}% en ${yrs} años (${sgn(s.abs)} personas); último año ${sgn(s.g1)}%` },
    {
      k: "inv",
      label: "Inversión pública",
      w: 0.05,
      v: s.sInv,
      group: "past",
      hint:
        s.inv24 === null
          ? s.inv === null
            ? "Sin datos de Hacienda"
            : `Sin dato 2024; media ${fmt.format(s.inv)} €/hab.`
          : `${fmt.format(s.inv24)} €/hab. en 2024 (${fmt.format(Math.round((s.invT ?? 0) / 1000))} mil € en total)`,
    },
    {
      k: "uni",
      label: "Universidad",
      w: 0.08,
      v: s.sUni,
      group: "past",
      hint: s.uniNear === null ? "Ninguna universidad accesible a menos de 45 km" : `${s.uniNear}${s.uniAt ? ` (${s.uniAt})` : ""}, a ${fmt1.format(s.uniKm ?? 0)} km${s.uniAt ? " por carretera (estimado)" : " del centro"}`,
    },
    {
      k: "neg",
      label: hist ? "Negocios nuevos" : "Comercios",
      w: hist ? 0.03 : 0.015,
      v: s.sNeg,
      group: "past",
      hint:
        s.sup === null
          ? "Sin datos"
          : `${s.sup} supermercados${s.dS === null ? "" : ` (${sgn(s.dS)} desde 2020)`} y ${s.gym} gimnasios${s.dG === null ? "" : ` (${sgn(s.dG)})`}`,
    },
    {
      k: "pend",
      label: "Vivienda prevista en el planeamiento",
      w: 0.09,
      v: s.sPend,
      group: "future",
      hint:
        s.pend === null
          ? "Sin datos del SIU"
          : `${fmt.format(s.pend)} viviendas previstas aún por materializar (${fmt.format(s.pendK ?? 0)} por 1.000 hab.)${s.pendNo === null ? "" : `; ${s.pendNo}% del suelo de desarrollo sin urbanizar`}${s.plan ? `; ${s.plan}` : ""}`,
    },
    {
      k: "viv",
      label: "Obra nueva reciente",
      w: 0.09,
      v: s.sViv,
      group: "future",
      hint: s.vivN === null ? "Sin datos (el Catastro no cubre País Vasco ni Navarra)" : `${sgn(s.vivN)} viviendas en 5 años (${sgn(s.vivPm ?? 0)} por 1.000 hab.), Catastro 2021–2026`,
    },
    {
      k: "ae",
      label: "Suelo previsto para actividad económica",
      w: 0.04,
      v: s.sAe,
      group: "future",
      hint: s.aeP === null ? "Sin datos del SIU" : `${fmt.format(Math.round(s.aeP * s.pop))} m² edificables pendientes de industria, comercio y oficinas (${fmt.format(s.aeP)} m²/hab.)`,
    },
    {
      k: "juv",
      label: "Población joven",
      w: 0.08,
      v: s.sJuv,
      group: "context",
      hint: s.m18 === null || s.edM === null ? "Sin datos" : `Edad media ${fmt1.format(s.edM)} años; ${fmt1.format(s.m18)}% menores de 18 y ${fmt1.format(s.m65 ?? 0)}% de 65 o más (INE)`,
    },
    {
      k: "paro",
      label: "Paro",
      w: 0.08,
      v: s.sParo,
      group: "context",
      hint: s.paro === null ? "Sin datos" : `${fmt1.format(s.paro)}% de la población de 18 a 64 años está en paro registrado (SEPE, septiembre)`,
    },
    {
      k: "paroT",
      label: "Evolución del paro",
      w: 0.02,
      v: s.sParoT,
      group: "context",
      hint: s.paroT === null ? "Sin datos" : `${sgn(s.paroT)} puntos en un año (negativo = baja el paro)`,
    },
    {
      k: "vac",
      label: "Mercado tensionado",
      w: 0.04,
      v: s.sVac,
      group: "context",
      hint: s.vac === null ? "Sin datos" : `${fmt1.format(s.vac)}% de viviendas vacías (Censo 2021); cuantas menos, más presión de demanda`,
    },
    {
      k: "cos",
      label: "Cerca del mar",
      w: 0.05,
      v: s.sCos,
      group: "context",
      hint: s.costa === null ? "Sin datos" : s.costa > 60 ? `A ${fmt.format(Math.round(s.costa))} km del mar: no puntúa ni penaliza` : `A ${fmt1.format(s.costa)} km del mar`,
    },
    {
      k: "ciu",
      label: "Cerca de una ciudad grande",
      w: 0.1,
      v: s.sCiu,
      group: "context",
      hint: s.dc === 0 ? "Es una ciudad de más de 100.000 habitantes" : s.dc > 45 ? `A ${fmt.format(s.dc)} km de ${s.cn}: demasiado lejos, no puntúa ni penaliza` : `A ${fmt.format(s.dc)} km de ${s.cn} (más de 100.000 hab.), por carretera (estimado)`,
    },
  ];
}

function ZoneRow({ label, state, main, sub }: { label: string; state: "ok" | "warn" | "bad" | "nd"; main: string; sub: string }) {
  const dot = { ok: "bg-forest", warn: "bg-gold", bad: "bg-brick", nd: "bg-edge" }[state];
  return (
    <li className="flex gap-3 py-2">
      <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="text-sm text-ink">{main}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
    </li>
  );
}
const zst = (v: number | null): "ok" | "warn" | "bad" | "nd" => (v === null ? "nd" : v >= 60 ? "ok" : v >= 35 ? "warn" : "bad");

// ¿Es una buena zona? Seguridad, okupación (solo provincial), renta y pobreza. No entra en el índice de crecimiento.
function ZonePanel({ sel, zref }: { sel: Row; zref: ZRef | undefined }) {
  const v = zoneVerdict(sel.zona);
  const nd = sel.zona === null; // sin veredicto: falta la seguridad municipal
  const alerts: string[] = [];
  if (sel.sSeg !== null && sel.sSeg < 25) alerts.push("criminalidad entre las más altas de los municipios grandes");
  if (sel.okR !== null && sel.okR >= 75) alerts.push("riesgo de okupación estimado alto");
  if ((sel.vac ?? 0) >= 20) alerts.push("mucha vivienda vacía (puede ser segunda residencia)");
  if (sel.sPob !== null && sel.sPob < 25) alerts.push("porcentaje de población con ingresos bajos entre los más altos");
  if (sel.sRenta !== null && sel.sRenta < 25) alerts.push("renta por persona entre las más bajas");
  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold leading-snug">
          <span className="mr-2 inline-block h-3 w-3 rounded-full align-baseline" style={{ background: zoneDot(sel.zona) }} />
          ¿Es buena zona? {nd ? "No se puede valorar" : v.label}
        </h3>
        {sel.zona !== null && <span className="shrink-0 text-sm font-bold tabular-nums">{sel.zona}/100</span>}
      </div>
      <ul className="mt-1 divide-y divide-black/10">
        <ZoneRow
          label="Seguridad del municipio"
          state={zst(sel.sSeg)}
          main={
            sel.crim === null
              ? "Sin dato municipal"
              : `${fmt1.format(sel.crim)} hechos delictivos por 1.000 hab. en 2025${sel.crimT === null ? "" : ` (${sgn(sel.crimT)}% frente a 2024)`}`
          }
          sub={
            sel.crim === null
              ? "Interior solo publica criminalidad de las capitales y de los municipios de más de 20.000 habitantes."
              : `Mediana de los municipios grandes: ${fmt1.format(zref?.crim ?? 0)}. Violentos: ${fmt1.format(sel.crimV ?? 0)} por 1.000 hab.; robos con fuerza en domicilios: ${fmt1.format(sel.crimD ?? 0)}.`
          }
        />
        <ZoneRow
          label="Riesgo de okupación (estimado)"
          state={sel.okR === null ? "nd" : sel.okR < 40 ? "ok" : sel.okR < 60 ? "warn" : "bad"}
          main={sel.okR === null ? "Sin datos suficientes" : `${okLevel(sel.okR)} (${sel.okR}/100)`}
          sub={[
            sel.okX === null ? null : `Estimado para ${sel.n}: ${fmt1.format(sel.okX)} veces la media nacional; su provincia, ${fmt1.format(sel.okP ?? 0)} veces`,
            sel.ocup === null ? null : `Provincia: ${fmt1.format(sel.ocup)} denuncias de allanamiento o usurpación (Interior) y ${fmt1.format(sel.okJ ?? 0)} juicios por ocupación ilegal (CGPJ) por 10.000 hab.`,
            "No hay datos públicos por municipio: el dato provincial se reparte según tamaño, vivienda vacía y pobreza, porque la okupación se concentra en ciudades grandes",
            sel.ocupS ? `Denuncias en la provincia 2021–2025: ${sel.ocupS.map((v) => fmt.format(v)).join(" → ")}` : null,
          ]
            .filter(Boolean)
            .join(". ")}
        />
        <ZoneRow
          label="Renta"
          state={nd ? "nd" : zst(sel.sRenta)}
          main={sel.renta === null ? "Sin dato" : `${fmt.format(sel.renta)} € netos por persona al año${sel.rentaH === null ? "" : ` (${fmt.format(sel.rentaH)} € por hogar)`}`}
          sub={`Mediana de los municipios: ${fmt.format(zref?.renta ?? 0)} € por persona (INE, Atlas de renta).`}
        />
        <ZoneRow
          label="Pobreza"
          state={nd ? "nd" : zst(sel.sPob)}
          main={sel.pob === null ? "Sin dato" : `${fmt1.format(sel.pob)}% de la población con ingresos por debajo del 60% de la mediana`}
          sub={`Mediana de los municipios: ${fmt1.format(zref?.pob ?? 0)}% (INE).`}
        />
      </ul>
      {nd && <p className="mt-2 text-xs font-medium text-ink">Sin seguridad municipal (solo capitales y más de 20.000 hab.) no doy veredicto.</p>}
      {alerts.length > 0 && (
        <p className="mt-2 rounded bg-white/70 p-2 text-xs font-medium text-ink">
          ⚠ Señales de alerta: {alerts.join("; ")}.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">Seguridad 35 %, riesgo de okupación 30 %, renta 20 %, pobreza 15 %. El riesgo de okupación es una estimación: parte de la provincia (Interior y CGPJ) y se reparte por tamaño, vivienda vacía y pobreza del municipio. Datos del municipio entero, no de calles concretas.</p>
    </section>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function Fact({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="flex items-center gap-1.5 text-right text-sm font-semibold text-ink">
        {dot && <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />}
        {value}
      </dd>
    </div>
  );
}

// Informe con IA bajo demanda: noticias recientes del municipio (okupación, seguridad, proyectos) con sus fuentes
type InformeIA = { texto: string; fuentes: { url: string; titulo: string }[]; fecha: string; cache?: boolean };
function InformePanel({ id, name }: { id: string; name: string }) {
  const [st, setSt] = useState<{ id: string; loading: boolean; data: InformeIA | null; error: string | null }>({ id, loading: false, data: null, error: null });
  const cur = st.id === id ? st : { id, loading: false, data: null, error: null }; // al cambiar de municipio se parte de cero
  const run = async () => {
    setSt({ id, loading: true, data: null, error: null });
    try {
      const res = await fetch("/api/informe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await res.json();
      setSt({ id, loading: false, data: res.ok ? j : null, error: res.ok ? null : (j.error ?? "No se pudo generar el informe.") });
    } catch {
      setSt({ id, loading: false, data: null, error: "No se pudo contactar con el servidor." });
    }
  };
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">Precios y noticias de la zona (IA)</div>
          <div className="text-xs text-muted">Compra, alquiler, zonas, okupación y proyectos de {name}, con fuentes</div>
        </div>
        {!cur.data && (
          <button onClick={run} disabled={cur.loading} className="shrink-0 text-sm font-semibold text-forest underline underline-offset-4 hover:text-forest-dark disabled:opacity-60">
            {cur.loading ? "Buscando…" : "Generar"}
          </button>
        )}
      </div>
      {cur.loading && <p className="mt-2 text-xs text-muted">Busca en la web y resume; suele tardar entre 30 segundos y 2 minutos.</p>}
      {cur.error && <p className="mt-2 text-sm text-brick">{cur.error}</p>}
      {cur.data && (
        <div className="mt-2 space-y-1 text-sm">
          {cur.data.texto.split("\n").map((l, i) =>
            l.startsWith("## ") ? (
              <div key={i} className="pt-1.5 text-xs font-semibold text-forest">{l.slice(3)}</div>
            ) : l.trim() ? (
              <div key={i} className="text-ink">{l.replace(/^- /, "• ")}</div>
            ) : null,
          )}
          {cur.data.fuentes.length > 0 && (
            <div className="pt-2 text-xs text-muted">
              Fuentes:{" "}
              {cur.data.fuentes.map((f, i) => (
                <span key={f.url}>
                  {i > 0 && " · "}
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-forest underline">
                    {f.titulo.length > 50 ? `${f.titulo.slice(0, 50)}…` : f.titulo}
                  </a>
                </span>
              ))}
            </div>
          )}
          <div className="pt-1 text-xs text-muted">Generado con IA el {new Date(cur.data.fecha).toLocaleDateString("es-ES")}; puede contener errores: abre las fuentes.</div>
        </div>
      )}
    </section>
  );
}


// Comparador de guardados: una columna por municipio; en cada fila se resalta el mejor valor
function Compare({ rows, onClose, onOpen, onRemove }: { rows: Row[]; onClose: () => void; onOpen: (r: Row) => void; onRemove: (id: string) => void }) {
  const cols = rows.slice(0, 5);
  type Line = { label: string; get: (r: Row) => number | null; show: (v: number) => string; best: "max" | "min" | null };
  const lines: Line[] = [
    { label: "Índice de crecimiento", get: (r) => r.score, show: (v) => fmt1.format(v), best: "max" },
    { label: "Perspectivas de futuro", get: (r) => r.fut, show: (v) => fmt1.format(v), best: "max" },
    { label: "Zona (0-100)", get: (r) => r.zona, show: (v) => fmt1.format(v), best: "max" },
    { label: "Riesgo de okupación", get: (r) => r.okR, show: (v) => `${okLevel(v)} (${v})`, best: "min" },
    { label: "Habitantes", get: (r) => r.pop, show: (v) => fmt.format(v), best: null },
    { label: "Población en 5 años", get: (r) => r.g5, show: (v) => `${sgn(v)}%`, best: "max" },
    { label: "Paro", get: (r) => r.paro, show: (v) => `${fmt1.format(v)}%`, best: "min" },
    { label: "Renta por persona", get: (r) => r.renta, show: (v) => `${fmt.format(v)} €`, best: "max" },
    { label: "Vivienda vacía", get: (r) => r.vac, show: (v) => `${fmt1.format(v)}%`, best: "min" },
    { label: "Valor tasado", get: (r) => r.vt, show: (v) => `${fmt.format(v)} €/m²`, best: null },
    { label: "Vivienda prevista por 1.000 hab.", get: (r) => r.pendK, show: (v) => fmt.format(v), best: null },
    { label: "Universidad", get: (r) => r.uniKm, show: (v) => `${fmt1.format(v)} km`, best: "min" },
    { label: "Ciudad grande", get: (r) => r.dc, show: (v) => `${fmt.format(v)} km`, best: "min" },
    { label: "Mar", get: (r) => r.costa, show: (v) => `${fmt.format(Math.round(v))} km`, best: "min" },
  ];
  return (
    <div className="flex flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-lg font-semibold tracking-tight">Comparar guardados{rows.length > cols.length ? ` (los ${cols.length} primeros de ${rows.length})` : ""}</h2>
        <button onClick={onClose} className="rounded-md px-2 py-1 text-sm font-semibold text-muted hover:bg-line hover:text-ink">
          Cerrar
        </button>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white p-2 text-left text-xs font-medium text-muted" />
              {cols.map((r) => {
                const rc = recommend(r);
                return (
                  <th key={r.id} className="min-w-[130px] border-l border-line p-2 text-left align-top">
                    <button onClick={() => onOpen(r)} className="text-left text-[15px] font-semibold text-forest underline">
                      {r.n}
                    </button>
                    <div className="text-xs font-normal text-muted">{r.prov}</div>
                    {rc && (
                      <span className="mt-1 flex items-center gap-1.5 text-xs font-normal text-ink">
                        <span className="h-2 w-2 rounded-full" style={{ background: rc.color }} />
                        {rc.label}
                      </span>
                    )}
                    <button onClick={() => onRemove(r.id)} className="mt-1 block text-xs font-normal text-muted underline">
                      Quitar
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const vals = cols.map(l.get);
              const nums = vals.filter((v): v is number => v !== null);
              const bestV = l.best && nums.length > 1 ? (l.best === "max" ? Math.max(...nums) : Math.min(...nums)) : null;
              return (
                <tr key={l.label} className="border-t border-line">
                  <td className="sticky left-0 z-10 bg-white p-2 text-xs font-medium text-muted">{l.label}</td>
                  {vals.map((v, i) => (
                    <td key={cols[i].id} className={`border-l border-line p-2 tabular-nums ${v !== null && v === bestV ? "font-bold text-forest" : "text-ink"}`}>
                      {v === null ? <span className="text-muted">—</span> : l.show(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">En verde y negrita, el mejor valor de cada fila. Pulsa un nombre para abrir su ficha.</p>
    </div>
  );
}


// Punto de color de la zona (misma paleta que el resto: verde, dorado, ladrillo) y etiqueta corta
const zoneDot = (z: number | null) => (z === null ? "var(--edge)" : z >= 60 ? "var(--forest)" : z >= 40 ? "var(--gold)" : "var(--brick)");
const zoneShort = (z: number) => (z >= 60 ? "Zona buena" : z >= 40 ? "Zona media" : "Zona floja");

// ---- Filtros ----
const CCAA_BY_PROV: Record<string, string> = {
  "01": "País Vasco", "02": "Castilla-La Mancha", "03": "Comunidad Valenciana", "04": "Andalucía", "05": "Castilla y León", "06": "Extremadura",
  "07": "Illes Balears", "08": "Cataluña", "09": "Castilla y León", "10": "Extremadura", "11": "Andalucía", "12": "Comunidad Valenciana",
  "13": "Castilla-La Mancha", "14": "Andalucía", "15": "Galicia", "16": "Castilla-La Mancha", "17": "Cataluña", "18": "Andalucía",
  "19": "Castilla-La Mancha", "20": "País Vasco", "21": "Andalucía", "22": "Aragón", "23": "Andalucía", "24": "Castilla y León", "25": "Cataluña",
  "26": "La Rioja", "27": "Galicia", "28": "Madrid", "29": "Andalucía", "30": "Murcia", "31": "Navarra", "32": "Galicia", "33": "Asturias",
  "34": "Castilla y León", "35": "Canarias", "36": "Galicia", "37": "Castilla y León", "38": "Canarias", "39": "Cantabria", "40": "Castilla y León",
  "41": "Andalucía", "42": "Castilla y León", "43": "Cataluña", "44": "Aragón", "45": "Castilla-La Mancha", "46": "Comunidad Valenciana",
  "47": "Castilla y León", "48": "País Vasco", "49": "Castilla y León", "50": "Aragón", "51": "Ceuta", "52": "Melilla",
};
type Filters = {
  q: string;
  ccaa: string;
  prov: string;
  minPop: number;
  maxPop: number; // 0 = sin límite
  minG5: number | null; // crecimiento de población en 5 años (%), mínimo
  minViv: number | null; // obra nueva reciente por 1.000 hab., mínimo
  minPend: number | null; // viviendas previstas pendientes por 1.000 hab., mínimo
  minInv: number | null; // inversión pública €/hab., mínimo
  minRec: number; // veredicto mínimo (0 = cualquiera; 2 = a estudiar o mejor; 3 = solo buenas candidatas)
  maxOk: number | null; // riesgo de okupación estimado máximo
  zone: number; // 0 = cualquiera; 40 = buena o media (valorada); 60 = solo buena (valorada)
  minRenta: number | null;
  maxPob: number | null;
  maxVt: number | null; // valor tasado máximo €/m²
  near: number | null; // km máximos a una ciudad de más de 100.000 hab.
  maxCosta: number | null; // km máximos al mar
  minTur: number | null; // % mínimo de vivienda turística
  maxUniKm: number | null; // km máximos a una universidad
  onlyUni: boolean;
  onlyProj: boolean;
  minScore: number;
  maxScore: number;
  minFut: number; // perspectivas de futuro mínimas (0 = sin mínimo)
};
const DEFAULTS: Filters = {
  q: "", ccaa: "", prov: "", minPop: 5000, maxPop: 0, minG5: null, minViv: null, minPend: null, minInv: null, minRec: 0, maxOk: null, zone: 0,
  minRenta: null, maxPob: null, maxVt: null, near: null, maxCosta: null, minTur: null, maxUniKm: null, onlyUni: false, onlyProj: false, minScore: 0, maxScore: 100, minFut: 0,
};
// Secciones de filtros (chips de la barra superior): id, título y los campos que controlan (para contar y restablecer)
const SECTIONS: { id: string; label: string; title: string; keys: (keyof Filters)[] }[] = [
  { id: "ambito", label: "Ámbito", title: "Dónde buscar", keys: ["ccaa", "prov"] },
  { id: "tamano", label: "Tamaño", title: "Tamaño del municipio", keys: ["minPop", "maxPop"] },
  { id: "crec", label: "Crecimiento", title: "Crecimiento ya observado", keys: ["minG5", "minViv", "minScore", "maxScore", "minFut"] },
  { id: "plan", label: "Planeamiento", title: "Planeamiento y gasto público", keys: ["minPend", "minInv"] },
  { id: "zona", label: "Zona", title: "Zona y veredicto", keys: ["minRec", "maxOk", "zone", "minRenta", "maxPob"] },
  { id: "precio", label: "Precio", title: "Precio de la vivienda", keys: ["maxVt"] },
  { id: "cerca", label: "Cercanía", title: "Cercanía y turismo", keys: ["near", "maxCosta", "maxUniKm", "minTur"] },
  { id: "extras", label: "Extras", title: "Extras", keys: ["onlyUni", "onlyProj"] },
];
// Estrategias: puntos de partida de un clic. Cada una parte de los filtros por defecto y aplica los suyos.
type SortKey = "score" | "fut" | "ok" | "g5";
const PRESETS: { id: string; label: string; hint: string; f: Partial<Filters>; sort?: SortKey }[] = [
  { id: "buenas", label: "Buenas candidatas", hint: "Crecimiento alto, zona verificada y poco riesgo de okupación", f: { minRec: 3 } },
  { id: "recomendadas", label: "Las que más crecen", hint: "A estudiar o mejor: crecimiento suficiente y sin señales de alerta", f: { minRec: 2 } },
  { id: "seguras", label: "Zona tranquila", hint: "Zona buena y riesgo de okupación bajo, sin los descartados, ordenadas por menor riesgo", f: { zone: 60, maxOk: 40, minRec: 1 }, sort: "ok" },
  { id: "estudiantes", label: "Alquiler a estudiantes", hint: "Universidad a menos de 5 km, sin los descartados", f: { maxUniKm: 5, minRec: 1 } },
  { id: "cinturon", label: "Cerca de gran ciudad", hint: "A menos de 30 km de una ciudad grande y hasta 50.000 habitantes", f: { near: 30, maxPop: 50000, minRec: 1 } },
  { id: "turismo", label: "Destino turístico", hint: "Más del 5 % de las viviendas son turísticas, sin los descartados: demanda de alquiler vacacional (y más regulación)", f: { minTur: 5, minRec: 1 } },
  { id: "costa", label: "Costa", hint: "A menos de 10 km del mar, sin los descartados", f: { maxCosta: 10, minRec: 1 } },
  { id: "auge", label: "Pueblos en auge", hint: "De 2.000 a 25.000 habitantes que más crecen", f: { minPop: 2000, maxPop: 25000, minG5: 8, minRec: 1 }, sort: "g5" },
  { id: "todas", label: "Todo", hint: "Todos los municipios de 5.000 habitantes o más, incluidos los descartados", f: {} },
];
const SORTS: [SortKey, string][] = [
  ["score", "Índice de crecimiento"],
  ["fut", "Perspectivas de futuro"],
  ["ok", "Menor riesgo de okupación"],
  ["g5", "Crecimiento de población"],
];

const sectionCount = (f: Filters, keys: (keyof Filters)[]) => {
  let n = 0;
  // minScore y maxScore cuentan como un solo filtro
  const ks = keys.includes("minScore") ? keys.filter((k) => k !== "maxScore") : keys;
  for (const k of ks) {
    if (k === "minScore") n += f.minScore > 0 || f.maxScore < 100 ? 1 : 0;
    else if (f[k] !== DEFAULTS[k]) n++;
  }
  return n;
};

function Sel({ label, value, onChange, options, note }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; note?: string }) {
  return (
    <label className="block text-sm font-semibold text-ink">
      {label}
      <select className="mt-1 h-10 w-full rounded-lg border border-edge bg-white px-2 text-[15px] font-normal" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
      {note && <span className="mt-1 block text-xs font-normal text-muted">{note}</span>}
    </label>
  );
}
const numOrNull = (v: string) => (v === "" ? null : Number(v));
const optNum = (cur: number | null) => (cur === null ? "" : String(cur));

const FAV_KEY = "inmo-favs";
function subscribeFavs(cb: () => void) {
  window.addEventListener(FAV_KEY, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(FAV_KEY, cb);
    window.removeEventListener("storage", cb);
  };
}
function readFavs(): string {
  try {
    return localStorage.getItem(FAV_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

// ---- Curvas de población (estilo app de bolsa) ----
function trendColor(ps: number[]) {
  return ps[ps.length - 1] >= ps[0] ? "var(--forest)" : "var(--brick)";
}
function Sparkline({ ps, w = 72, h = 26 }: { ps: number[] | null; w?: number; h?: number }) {
  if (!ps || ps.length < 2) return <span style={{ width: w, height: h }} className="inline-block" />;
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  const span = hi - lo || 1;
  const pts = ps.map((v, i) => `${((i / (ps.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts} fill="none" stroke={trendColor(ps)} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Indicadores que son percentiles de verdad (los demás usan escalas absolutas: universidad, planeamiento, mar, ciudad)
const PCT_FACTORS = new Set(["pop", "inv", "neg", "juv", "paro", "paroT", "viv", "vac"]);

type Serie = { id: string; label: string; pts: [number, number][]; unit: string; note?: string; up: "good" | "bad" };
function TrendChart({ series }: { series: Serie[] }) {
  const [sid, setSid] = useState(series[0]?.id);
  const [span, setSpan] = useState<5 | 10>(10);
  const se = series.find((x) => x.id === sid) ?? series[0];
  if (!se) return null;
  const all = se.pts;
  const pts = all.length > 6 ? all.slice(-(span + 1)) : all;
  const vals = pts.map((p) => p[1]);
  const W = 600;
  const H = 150;
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || hi * 0.02 || 1) * 0.12;
  const yOf = (v: number) => H - 8 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (H - 16);
  const xOf = (i: number) => (i / Math.max(1, vals.length - 1)) * W;
  const line = vals.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const ch = vals[0] ? (vals[vals.length - 1] / vals[0] - 1) * 100 : 0;
  const good = se.up === "good" ? ch >= 0 : ch <= 0;
  const col = good ? "var(--forest)" : "var(--brick)";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 text-[13px]">
          {series.map((x) => (
            <button
              key={x.id}
              onClick={() => setSid(x.id)}
              aria-pressed={x.id === se.id}
              className={`rounded-full px-3 py-1 font-medium ${x.id === se.id ? "bg-ink text-white" : "bg-paper text-ink hover:bg-tint"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        {all.length > 6 && (
          <div className="flex gap-1 text-xs">
            {([5, 10] as const).map((n) => (
              <button key={n} onClick={() => setSpan(n)} className={`rounded-full px-2.5 py-1 font-semibold ${span === n ? "bg-paper text-ink" : "text-muted hover:text-ink"}`}>
                {n} años
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 text-sm text-muted">
        <span className="font-semibold tabular-nums" style={{ color: col }}>
          {ch >= 0 ? "+" : ""}
          {fmt1.format(ch)}%
        </span>{" "}
        desde {pts[0][0]}
        {se.note ? <span> · {se.note}</span> : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-36 w-full" role="img" aria-label={`${se.label} de ${pts[0][0]} a ${pts[pts.length - 1][0]}`}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--line)" strokeWidth="2" />
        <polyline points={line} fill="none" stroke={col} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs tabular-nums text-muted">
        <span>
          {pts[0][0]} · {fmt.format(pts[0][1])} {se.unit}
        </span>
        <span>
          {pts[pts.length - 1][0]} · {fmt.format(pts[pts.length - 1][1])} {se.unit}
        </span>
      </div>
    </div>
  );
}

// Minimapa de situación: solo para ubicar el municipio, sin interacción
function MiniMap({ r }: { r: Row }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [r.lon, r.lat],
      zoom: 5.4,
      interactive: false,
      attributionControl: false,
    });
    new maplibregl.Marker({ color: "#2f6a4a", scale: 0.6 }).setLngLat([r.lon, r.lat]).addTo(m);
    return () => m.remove();
  }, [r.lon, r.lat]);
  return (
    <div className="shrink-0 text-right">
      <div ref={el} className="h-24 w-28 overflow-hidden rounded-lg md:h-28 md:w-36" style={{ position: "relative" }} />
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted">
        © OpenStreetMap
      </a>
    </div>
  );
}

// Fila de municipio: nombre, minicurva, índice y crecimiento
function MuniRow({ r, onOpen, fav, onFav, rank }: { r: Row; onOpen: (r: Row) => void; fav: boolean; onFav: (id: string) => void; rank?: number }) {
  const rc = recommend(r);
  return (
    <li className="flex items-center gap-3 border-b border-line">
      <button onClick={() => onOpen(r)} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
        {rank !== undefined && <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{rank}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{r.n}</span>
          <span className="flex items-center gap-1.5 truncate text-[13px] text-muted">
            {rc && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: rc.color }} />}
            {rc ? `${rc.label} · ` : ""}
            {r.prov}
          </span>
        </span>
        <Sparkline ps={r.ps} />
        <span className="w-14 shrink-0 text-right">
          <span className="block text-[15px] font-semibold tabular-nums text-ink">{r.score === null ? "—" : fmt1.format(r.score)}</span>
          <span className="block text-xs tabular-nums" style={{ color: r.g5 >= 0 ? "var(--forest)" : "var(--brick)" }}>
            {sgn(r.g5)}%
          </span>
        </span>
      </button>
      <button
        onClick={() => onFav(r.id)}
        aria-pressed={fav}
        aria-label={fav ? `Quitar ${r.n} de guardados` : `Guardar ${r.n}`}
        className={`shrink-0 px-1 text-lg leading-none ${fav ? "text-gold" : "text-edge hover:text-muted"}`}
      >
        {fav ? "★" : "☆"}
      </button>
    </li>
  );
}

function SectionHead({ title, sub, onMore, more }: { title: string; sub?: string; onMore?: () => void; more?: string }) {
  return (
    <div className="mb-1 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {onMore && (
        <button onClick={onMore} className="shrink-0 text-sm font-semibold text-forest hover:text-forest-dark">
          {more ?? "Ver todas"} →
        </button>
      )}
    </div>
  );
}

// ---- Ficha de un municipio (estilo valor en bolsa) ----
function Ficha({
  sel,
  data,
  sect,
  rank,
  total,
  hist,
  fav,
  onFav,
  onBack,
  backLabel,
  onMap,
  mapLabel = "Ver en el mapa",
}: {
  sel: Row;
  data: Data | null;
  sect: Record<string, SectInfo> | null;
  rank?: number;
  total: number;
  hist: boolean;
  fav: boolean;
  onFav: () => void;
  onBack: () => void;
  backLabel: string;
  onMap: () => void;
  mapLabel?: string;
}) {
  const factors = buildFactors(sel, data, hist);
  const wsum = factors.reduce((a, f) => (f.v === null ? a : a + f.w), 0);
  const calc = factors.map((f) => ({ ...f, delta: f.v === null ? null : (f.w * (f.v - 50)) / wsum }));
  const pros = calc.filter((f) => f.delta !== null && f.delta >= 0.4).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 3);
  const cons = calc.filter((f) => f.delta !== null && f.delta <= -0.4).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 3);
  const si = sect?.[sel.id];
  const rec = recommend(sel);
  const detailWeight = (w: number) => `${fmt1.format(w * 100).replace(",0", "")}%`;

  const impact = (items: typeof calc, sign: 1 | -1) =>
    items.map((f) => (
      <li key={f.k} className="flex gap-2.5 py-2 text-sm">
        <span className={`mt-0.5 shrink-0 font-semibold ${sign > 0 ? "text-forest" : "text-brick"}`}>{sign > 0 ? "✓" : "✕"}</span>
        <span>
          <span className="font-semibold text-ink">{f.label}.</span> <span className="text-muted">{f.hint}.</span>{" "}
          {PCT_FACTORS.has(f.k) && (
            <span className={sign > 0 ? "text-forest" : "text-brick"}>
              {sign > 0 ? `Mejor que el ${Math.round(f.v ?? 0)} % de los municipios.` : `Peor que el ${Math.round(100 - (f.v ?? 0))} % de los municipios.`}
            </span>
          )}
        </span>
      </li>
    ));

  return (
    <article className="@container pb-16">
      <div className="flex items-center justify-between gap-2 py-3 text-sm">
        <button onClick={onBack} className="font-semibold text-forest hover:text-forest-dark">
          ← {backLabel}
        </button>
        <div className="flex items-center gap-4">
          <button onClick={onMap} className="font-semibold text-muted hover:text-ink">
            {mapLabel}
          </button>
          <button onClick={onFav} aria-pressed={fav} className={`font-semibold ${fav ? "text-gold" : "text-muted hover:text-ink"}`}>
            {fav ? "★ Guardado" : "☆ Guardar"}
          </button>
        </div>
      </div>

      <header className="flex items-start justify-between gap-4 pt-2">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">{sel.n}</h1>
          <p className="text-sm text-muted">
            {sel.prov} · {fmt.format(sel.pop)} habitantes
          </p>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-5xl font-semibold leading-none tabular-nums tracking-tight text-ink">{sel.score === null ? "—" : fmt1.format(sel.score)}</span>
            <span className="text-sm text-muted">índice de crecimiento{rank ? ` · puesto ${fmt.format(rank)} de ${fmt.format(total)}` : ""}</span>
          </div>
          {rec && (
            <p className="mt-2 text-sm">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: rec.color }} />
              <b className="text-ink">{rec.label}.</b>{" "}
              {rec.bad.length > 0 && <span className="text-brick">{cap(rec.bad.join(", "))}. </span>}
              {rec.warn.length > 0 && <span className="text-ink">{cap(rec.warn.join(", "))}. </span>}
              {rec.good.length > 0 && <span className="text-forest">{cap(rec.good.join(", "))}.</span>}
            </p>
          )}
        </div>
        <MiniMap r={sel} />
      </header>

      {(() => {
        const series: Serie[] = [];
        if (sel.ps && data) series.push({ id: "pop", label: "Población", pts: sel.ps.map((v, i) => [data.psY + i, v]), unit: "hab.", up: "good" });
        const vp = data?.vtProv?.[sel.id.slice(0, 2)];
        if (sel.vtS) series.push({ id: "vt", label: "Valor tasado", pts: sel.vtS, unit: "€/m²", up: "good", note: "precio de tasación (Ministerio)" });
        else if (vp && vp.length > 2)
          series.push({ id: "vt", label: "Valor tasado", pts: vp, unit: "€/m²", up: "good", note: `media de la provincia de ${sel.prov}: el Ministerio solo lo da por municipio en los de más de 25.000 hab.` });
        if (sel.ocupS) series.push({ id: "ok", label: "Okupación", pts: sel.ocupS.map((v, i) => [2021 + i, v]), unit: "denuncias", up: "bad", note: `denuncias en toda la provincia de ${sel.prov}` });
        return series.length > 0 ? (
          <section className="mt-6">
            <TrendChart series={series} />
          </section>
        ) : null;
      })()}

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">Datos clave</h2>
        <dl className="mt-1 grid gap-x-8 @xl:grid-cols-2">
          <Fact label="Riesgo de okupación" value={sel.okR === null ? "Sin dato" : `${okLevel(sel.okR)} (${sel.okR}/100)`} dot={okDot(sel.okR)} />
          <Fact label="Zona" value={sel.zona === null ? "Sin valorar" : `${zoneShort(sel.zona)} (${sel.zona}/100)`} dot={zoneDot(sel.zona)} />
          <Fact label="Paro" value={sel.paro === null ? "Sin dato" : `${fmt1.format(sel.paro)}%`} />
          <Fact label="Renta por persona" value={sel.renta === null ? "Sin dato" : `${fmt.format(sel.renta)} €`} />
          <Fact label="Valor tasado" value={sel.vt === null ? "Solo más de 25.000 hab." : `${fmt.format(sel.vt)} €/m²`} />
          <Fact label="Vivienda vacía" value={sel.vac === null ? "Sin dato" : `${fmt1.format(sel.vac)}%`} />
          <Fact label="Universidad" value={sel.uniKm === null ? "Ninguna a menos de 45 km" : `${sel.uniNear ?? "Sede"} · ${fmt1.format(sel.uniKm)} km${sel.uniAt ? ` (${sel.uniAt})` : ""}`} />
          <Fact label="Ciudad grande" value={sel.dc === 0 ? "Lo es" : `${fmt.format(sel.dc)} km (${sel.cn})`} />
          <Fact label="Mar" value={sel.costa === null ? "Sin dato" : `${fmt.format(Math.round(sel.costa))} km`} />
          <Fact label="Vivienda turística" value={sel.tur === null ? "Sin dato" : `${fmt1.format(sel.tur)}% (${fmt.format(sel.turN ?? 0)} viviendas)`} />
          <Fact label="Plazas turísticas" value={sel.turP === null ? "Sin dato" : `${fmt1.format(sel.turP)} por 100 hab.`} />
          <Fact
            label={`Turismo anual${sel.pernY ? ` (${sel.pernY})` : ""}`}
            value={
              sel.pernH === null
                ? "Sin dato (no es punto turístico del INE)"
                : `${fmt1.format(sel.pernH)} noches por habitante${sel.pernT === null ? "" : ` (${sgn(sel.pernT)}%)`}`
            }
          />
          <Fact label="Vivienda prevista" value={sel.pendK === null ? "Sin dato" : `${fmt.format(sel.pendK)} por 1.000 hab.`} />
        </dl>
      </section>

      <section className="mt-8 grid gap-x-10 gap-y-4 @xl:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Puntos fuertes</h2>
          {pros.length > 0 ? <ul>{impact(pros, 1)}</ul> : <p className="py-2 text-sm text-muted">Nada destaca por encima de la media.</p>}
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Puntos débiles</h2>
          {cons.length > 0 ? <ul>{impact(cons, -1)}</ul> : <p className="py-2 text-sm text-muted">Nada queda claramente por debajo.</p>}
        </div>
      </section>
      {(sel.pendK ?? 0) >= 3000 && <p className="mt-2 text-xs text-ink">⚠ El planeamiento prevé muchísimas viviendas para su tamaño: suele ser un plan antiguo o inviable.</p>}

      <section className="mt-8">
        <InformePanel id={sel.id} name={sel.n} />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href={idealistaUrl(sel)} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">
            Casas en venta en idealista ↗
          </a>
          <a href={googleUrl(sel)} target="_blank" rel="noopener noreferrer" className="text-forest underline underline-offset-4">
            Buscar en Google
          </a>
        </div>
      </section>

      {sel.proj && sel.proj.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Proyectos concretos</h2>
          <div className="mt-2 space-y-2">
            {sel.proj.map((p) => (
              <div key={p.n} className="text-sm">
                <div className="font-semibold text-ink">
                  {PROJ_ICON[p.t] ?? "🏗️"} {p.n}
                </div>
                <div className="text-muted">
                  {p.e}{" "}
                  <a href={p.u} target="_blank" rel="noopener noreferrer" className="font-medium text-forest underline">
                    Fuente ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold tracking-tight">La zona</h2>
        <div className="mt-2">
          <ZonePanel sel={sel} zref={data?.zref} />
        </div>
      </section>

      <details className="mt-8 border-t border-line">
        <summary className="cursor-pointer py-3 text-sm font-semibold text-ink">Todos los indicadores del índice</summary>
        <div className="space-y-3.5 pb-2">
          {(["past", "context", "future"] as const).map((g) => (
            <div key={g} className="space-y-3.5">
              <div className="text-xs font-semibold text-muted">{g === "past" ? "Lo ya ocurrido" : g === "context" ? "Contexto y accesibilidad" : "Perspectivas de futuro"}</div>
              {factors
                .filter((f) => f.group === g)
                .map((f) => (
                  <Bar key={f.k} label={f.label} value={f.v} weight={detailWeight(f.w)} hint={f.hint} />
                ))}
            </div>
          ))}
        </div>
      </details>

      {si && (si.s.length > 0 || si.r > 0) && (
        <details className="border-t border-line">
          <summary className="cursor-pointer py-3 text-sm font-semibold text-ink">Sectores del planeamiento ({si.n || si.s.length})</summary>
          {si.s.length > 0 && (
            <ul className="divide-y divide-line text-sm">
              {si.s.map(([nombre, clase, uso, ha, edif], i) => (
                <li key={i} className="py-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-ink">{nombre}</span>
                    <span className="shrink-0 tabular-nums text-muted">{ha === null ? "" : `${fmt.format(ha)} ha`}</span>
                  </div>
                  <div className="text-xs text-muted">{[uso, clase, edif === null ? null : `${fmt.format(edif)} m² edificables`].filter(Boolean).join(" · ")}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="py-2 text-xs text-muted">Planes sobre el papel (SIU): no indican si se urbanizó ni el calendario.</p>
        </details>
      )}
    </article>
  );
}

// Tarjeta que aparece junto a la bolita tocada; la flecha la despliega con más datos sin salir del mapa
function MapCard({
  r,
  pt,
  box,
  data,
  hist,
  fav,
  onFav,
  onOpen,
  onClose,
}: {
  r: Row;
  pt: { x: number; y: number };
  box: { w: number; h: number };
  data: Data | null;
  hist: boolean;
  fav: boolean;
  onFav: () => void;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 260 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rc = recommend(r);
  const gap = 16;
  // a la derecha de la bolita; si no cabe, a la izquierda; siempre dentro del mapa
  let left = pt.x + gap;
  if (left + size.w > box.w - 8) left = pt.x - gap - size.w;
  left = Math.min(Math.max(left, 8), Math.max(8, box.w - size.w - 8));
  const top = Math.min(Math.max(pt.y - 48, 8), Math.max(8, box.h - size.h - 8));
  const factors = more ? buildFactors(r, data, hist) : [];
  const wsum = factors.reduce((a, f) => (f.v === null ? a : a + f.w), 0);
  const calc = factors.map((f) => ({ ...f, delta: f.v === null ? null : (f.w * (f.v - 50)) / wsum }));
  const pros = calc.filter((f) => (f.delta ?? 0) >= 0.4).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 2);
  const cons = calc.filter((f) => (f.delta ?? 0) <= -0.4).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 2);
  return (
    <div
      ref={ref}
      style={{ left, top, maxHeight: box.h - 16 }}
      className="absolute z-10 w-[min(19rem,calc(100%-1rem))] overflow-y-auto rounded-2xl bg-white p-4 shadow-[0_6px_28px_rgba(0,0,0,0.16)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold tracking-tight text-ink">{r.n}</div>
          <div className="text-sm text-muted">
            {r.prov} · {fmt.format(r.pop)} hab.
          </div>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="-mr-1 -mt-1 shrink-0 rounded-full px-2 py-1 text-lg leading-none text-muted hover:bg-paper hover:text-ink">
          ×
        </button>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-4xl font-semibold leading-none tabular-nums tracking-tight text-ink">{r.score === null ? "—" : fmt1.format(r.score)}</div>
          {rc && (
            <div className="mt-1.5 flex items-center gap-1.5 text-sm text-ink">
              <span className="h-2 w-2 rounded-full" style={{ background: rc.color }} />
              {rc.label}
            </div>
          )}
        </div>
        <div className="text-right">
          <Sparkline ps={r.ps} w={110} h={38} />
          <div className="text-xs tabular-nums" style={{ color: r.g5 >= 0 ? "var(--forest)" : "var(--brick)" }}>
            {sgn(r.g5)}% en 5 años
          </div>
        </div>
      </div>
      <dl className="mt-2">
        <Fact label="Riesgo de okupación" value={r.okR === null ? "Sin dato" : okLevel(r.okR)} dot={okDot(r.okR)} />
        <Fact label="Zona" value={r.zona === null ? "Sin valorar" : cap(zoneShort(r.zona).replace("Zona ", ""))} dot={zoneDot(r.zona)} />
        <Fact label="Paro" value={r.paro === null ? "Sin dato" : `${fmt1.format(r.paro)}%`} />
        {more && (
          <>
            <Fact label="Renta por persona" value={r.renta === null ? "Sin dato" : `${fmt.format(r.renta)} €`} />
            <Fact label="Valor tasado" value={r.vt === null ? "Solo más de 25.000 hab." : `${fmt.format(r.vt)} €/m²`} />
            <Fact label="Vivienda vacía" value={r.vac === null ? "Sin dato" : `${fmt1.format(r.vac)}%`} />
            <Fact label="Universidad" value={r.uniKm === null ? "Ninguna cerca" : `${r.uniNear ?? "Sede"} · ${fmt1.format(r.uniKm)} km${r.uniAt ? ` (${r.uniAt})` : ""}`} />
            <Fact label="Ciudad grande" value={r.dc === 0 ? "Lo es" : `${fmt.format(r.dc)} km (${r.cn})`} />
            <Fact label="Mar" value={r.costa === null ? "Sin dato" : `${fmt.format(Math.round(r.costa))} km`} />
            <Fact label="Vivienda turística" value={r.tur === null ? "Sin dato" : `${fmt1.format(r.tur)}%`} />
            {r.pernH !== null && <Fact label="Turismo anual" value={`${fmt1.format(r.pernH)} noches por hab.`} />}
          </>
        )}
      </dl>
      {more && (pros.length > 0 || cons.length > 0) && (
        <div className="mt-3 space-y-0.5 text-sm">
          {pros.map((f) => (
            <div key={f.k} className="text-ink">
              <span className="mr-1.5 font-semibold text-forest">✓</span>
              {f.label}
            </div>
          ))}
          {cons.map((f) => (
            <div key={f.k} className="text-ink">
              <span className="mr-1.5 font-semibold text-brick">✕</span>
              {f.label}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-3">
        <button onClick={onFav} aria-pressed={fav} className={`text-sm font-semibold ${fav ? "text-gold" : "text-muted hover:text-ink"}`}>
          {fav ? "★ Guardado" : "☆ Guardar"}
        </button>
        {more && (
          <button onClick={onOpen} className="text-sm font-semibold text-forest hover:text-forest-dark">
            Ficha completa →
          </button>
        )}
      </div>
      <button
        onClick={() => setMore((x) => !x)}
        aria-expanded={more}
        aria-label={more ? "Mostrar menos" : "Mostrar más datos"}
        className="mt-2 flex w-full justify-center rounded-full py-1 text-muted hover:bg-paper hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition ${more ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}

// ---- Mapa (vista aparte): situar los municipios de la lista actual ----
function MapView({
  rows,
  favs,
  onFav,
  data,
  hist,
  sect,
  ranks,
  focusId,
}: {
  rows: Row[];
  focusId: string | null;
  favs: string[];
  onFav: (id: string) => void;
  data: Data | null;
  hist: boolean;
  sect: Record<string, SectInfo> | null;
  ranks: { g: Map<string, number>; total: number } | null;
}) {
  const [full, setFull] = useState<Row | null>(null);
  const focusRef = useRef(focusId); // solo se usa al abrir el mapa
  const el = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Row | null>(null);
  const pickRef = useRef<Row | null>(null);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const [box, setBox] = useState({ w: 800, h: 600 });
  const place = () => {
    const m = map.current;
    const r = pickRef.current;
    if (!m || !r) return;
    const p = m.project([r.lon, r.lat]);
    setPt({ x: p.x, y: p.y });
    const c = m.getContainer();
    setBox({ w: c.clientWidth, h: c.clientHeight });
  };
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  });
  const push = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource(SRC) as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: rowsRef.current.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: { id: r.id, n: r.n, score: r.score ?? 0 },
      })),
    });
  };
  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({ container: el.current, style: "https://tiles.openfreemap.org/styles/positron", center: [-3.7, 40.2], zoom: 5.2 });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    m.on("load", () => {
      m.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "pts",
        type: "circle",
        source: SRC,
        layout: { "circle-sort-key": ["-", 100, ["get", "score"]] },
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, SIZE_AT(1), 10, SIZE_AT(2)],
          "circle-color": MAP_COLOR as maplibregl.ExpressionSpecification,
          "circle-opacity": 0.92,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#1f4d36",
          "circle-stroke-opacity": 0.55,
        },
      });
      m.on("click", "pts", (e) => {
        const id = e.features?.[0]?.properties?.id;
        const r = rowsRef.current.find((x) => x.id === id);
        if (r) {
          pickRef.current = r;
          setPicked(r);
          setFull(null); // al elegir otro municipio se cierra la ficha completa y queda su tarjeta
          place();
        }
      });
      m.on("mousemove", "pts", (e) => {
        m.getCanvas().style.cursor = "pointer";
        const p = e.features?.[0]?.properties;
        if (p) popup.setLngLat(e.lngLat).setText(`${p.n} · ${p.score}`).addTo(m);
      });
      m.on("mouseleave", "pts", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("move", place);
      m.on("resize", place);
      ready.current = true;
      push();
      const fid = focusRef.current;
      const fr = fid ? rowsRef.current.find((x) => x.id === fid) : null;
      if (fr) {
        pickRef.current = fr;
        setPicked(fr);
        m.jumpTo({ center: [fr.lon, fr.lat], zoom: 7 });
        place();
      }
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);
  useEffect(push, [rows]);
  return (
    <div className="relative h-[calc(100dvh-57px)]">
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {picked && (
        <MapCard
          key={picked.id}
          r={picked}
          pt={pt}
          box={box}
          data={data}
          hist={hist}
          fav={favs.includes(picked.id)}
          onFav={() => onFav(picked.id)}
          onOpen={() => setFull(picked)}
          onClose={() => {
            pickRef.current = null;
            setPicked(null);
            setFull(null); // cerrar la tarjeta cierra también la ficha completa
          }}
        />
      )}
      {full && (
        <aside className="absolute inset-y-0 right-0 z-20 w-full overflow-y-auto bg-white px-5 shadow-[-6px_0_28px_rgba(0,0,0,0.14)] md:w-[560px]">
          <Ficha
            key={full.id}
            sel={full}
            data={data}
            sect={sect}
            rank={ranks?.g.get(full.id)}
            total={ranks?.total ?? 0}
            hist={hist}
            fav={favs.includes(full.id)}
            onFav={() => onFav(full.id)}
            onBack={() => setFull(null)}
            backLabel="Cerrar"
            onMap={() => setFull(null)}
            mapLabel="Volver al mapa"
          />
        </aside>
      )}
      <div className="absolute bottom-8 left-3 bg-white/90 px-3 py-2 backdrop-blur">
        <div className="mb-1 text-xs font-semibold text-ink">Índice de crecimiento</div>
        <div className="h-2 w-40 rounded-full" style={{ background: LEGEND_GRADIENT }} />
        <div className="mt-0.5 flex justify-between text-[11px] text-muted">
          <span>bajo</span>
          <span>alto</span>
        </div>
      </div>
    </div>
  );
}

// Filtra y ordena (función pura: la usan la lista, las secciones de la portada y el mapa)
function applyFilters(rows: Row[], f: Filters, sort: SortKey, favOnly: string[] | null): Row[] {
  const t = noAcc(f.q.trim().toLowerCase());
  const out: Row[] = [];
  for (const r of rows) {
    const v = r.score;
    if (v === null || v < f.minScore || v > f.maxScore) continue;
    if (f.minFut > 0 && (r.fut === null || r.fut < f.minFut)) continue;
    if (!(r.pop >= f.minPop || f.onlyProj || favOnly)) continue;
    if (f.maxPop && r.pop > f.maxPop) continue;
    if (f.ccaa && CCAA_BY_PROV[r.id.slice(0, 2)] !== f.ccaa) continue;
    if (f.prov && r.prov !== f.prov) continue;
    if (t && !noAcc(r.n.toLowerCase()).includes(t)) continue;
    if (f.onlyUni && !(r.uni > 0 || r.uniOsm >= 2)) continue;
    if (f.onlyProj && !(r.proj?.length ?? 0)) continue;
    if (f.zone > 0 && (r.zona === null || r.zona < f.zone)) continue;
    if (f.maxOk !== null && (r.okR === null || r.okR >= f.maxOk)) continue;
    if (f.minRec > 0 && (recommend(r)?.lvl ?? 0) < f.minRec) continue;
    if (f.minG5 !== null && r.g5 < f.minG5) continue;
    if (f.minViv !== null && (r.vivPm === null || r.vivPm < f.minViv)) continue;
    if (f.minPend !== null && (r.pendK === null || r.pendK < f.minPend)) continue;
    if (f.minInv !== null && (r.inv === null || r.inv < f.minInv)) continue;
    if (f.minRenta !== null && (r.renta === null || r.renta < f.minRenta)) continue;
    if (f.maxPob !== null && (r.pob === null || r.pob > f.maxPob)) continue;
    if (f.maxVt !== null && (r.vt === null || r.vt > f.maxVt)) continue;
    if (f.near !== null && r.dc > f.near) continue;
    if (f.maxCosta !== null && (r.costa === null || r.costa > f.maxCosta)) continue;
    if (f.minTur !== null && (r.tur === null || r.tur < f.minTur)) continue;
    if (f.maxUniKm !== null && (r.uniKm === null || r.uniKm > f.maxUniKm)) continue;
    if (favOnly && !favOnly.includes(r.id)) continue;
    out.push(r);
  }
  const key: Record<SortKey, (r: Row) => number> = {
    score: (r) => r.score ?? 0,
    fut: (r) => r.fut ?? -1,
    ok: (r) => -(r.okR ?? 999),
    g5: (r) => r.g5,
  };
  return out.sort((a, b) => key[sort](b) - key[sort](a) || (b.score ?? 0) - (a.score ?? 0));
}

type View = { k: "home" } | { k: "list"; preset: string } | { k: "fav" } | { k: "detail"; id: string } | { k: "map" } | { k: "compare" };


export default function Explorer() {
  const [data, setData] = useState<Data | null>(null);
  const [f, setF] = useState<Filters>({ ...DEFAULTS, ...PRESETS[0].f });
  const set = (p: Partial<Filters>) => setF((cur) => ({ ...cur, ...p }));
  const [sort, setSort] = useState<SortKey>("score");
  const [showFilters, setShowFilters] = useState(false);
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [limit, setLimit] = useState(10);
  const [q, setQ] = useState("");
  const [sect, setSect] = useState<Record<string, SectInfo> | null>(null);
  // Navegación como una app: una pila de vistas, sincronizada con el botón atrás del navegador
  const [stack, setStack] = useState<View[]>([{ k: "home" }]);
  const view = stack[stack.length - 1];
  const go = (v: View) => {
    setStack((s) => [...s, v]);
    try {
      history.pushState({ depth: stack.length }, "");
    } catch {
      // sin historial: la navegación sigue funcionando con los botones de la app
    }
    window.scrollTo({ top: 0 });
  };
  const back = () => {
    if (stack.length > 1) history.back();
  };
  useEffect(() => {
    const onPop = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const home = () => {
    setStack([{ k: "home" }]);
    setQ("");
    choose(PRESETS[0].id);
    window.scrollTo({ top: 0 });
  };

  // Guardados: se conservan en este navegador (localStorage)
  const favRaw = useSyncExternalStore(subscribeFavs, readFavs, () => "[]");
  const favs = useMemo(() => {
    try {
      const v = JSON.parse(favRaw);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }, [favRaw]);
  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id];
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(FAV_KEY));
    } catch {
      // sin almacenamiento no se puede guardar
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = (attempt: number) => {
      fetch("/municipios.json", { signal: AbortSignal.timeout(20000) })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then((d: Data) => !cancelled && setData(d))
        .catch(() => {
          if (!cancelled && attempt < 6) setTimeout(() => load(attempt + 1), 1000);
        });
    };
    load(0);
    return () => {
      cancelled = true;
    };
  }, []);

  const sel = view.k === "detail" ? (data?.rows.find((r) => r.id === view.id) ?? null) : null;
  useEffect(() => {
    if ((!sel && view.k !== "map") || sect) return;
    let cancelled = false;
    fetch("/sectores.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, SectInfo> | null) => !cancelled && d && setSect(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sel, sect, view.k]);

  const places = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.rows ?? []) m.set(r.prov, CCAA_BY_PROV[r.id.slice(0, 2)] ?? "");
    const ccaas = [...new Set(m.values())].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
    const provs = [...m.entries()].map(([name, ccaa]) => ({ name, ccaa })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { ccaas, provs };
  }, [data]);

  const searchHits = useMemo(() => (data && q.trim() ? applyFilters(data.rows, { ...DEFAULTS, minPop: 0, q }, "score", null).slice(0, 40) : []), [data, q]);

  const listPreset = PRESETS.find((p) => p.id === (view.k === "list" ? view.preset : preset)) ?? PRESETS[0];
  const listed = useMemo(() => {
    if (!data) return [];
    if (view.k === "fav") return applyFilters(data.rows, { ...DEFAULTS, minPop: 0 }, "score", favs);
    return applyFilters(data.rows, f, sort, null);
  }, [data, f, sort, view.k, favs]);

  const choose = (id: string) => {
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0];
    setPreset(p.id);
    setF({ ...DEFAULTS, ...p.f });
    setSort(p.sort ?? "score");
    setShowFilters(false);
    setLimit(10);
  };
  const open = (r: Row) => go({ k: "detail", id: r.id });

  const hist = data?.negHist ?? false;
  const wNeg = hist ? 3 : 1.5;
  const ranks = useMemo(() => {
    if (!data) return null;
    const g = data.rows.filter((r) => r.pop >= 1000 && r.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return { g: new Map(g.map((r, i) => [r.id, i + 1])), total: g.length };
  }, [data]);

  const base: Filters = { ...DEFAULTS, ...(listPreset?.f ?? {}) };
  const activeCount = (Object.keys(DEFAULTS) as (keyof Filters)[]).filter((k) => k !== "q" && f[k] !== base[k]).length;
  const reset = (keys: (keyof Filters)[]) => setF((cur) => ({ ...cur, ...Object.fromEntries(keys.map((k) => [k, base[k]])) }));
  const prevView = stack.length > 1 ? stack[stack.length - 2] : null;
  const backLabel =
    prevView?.k === "home" ? (q.trim() ? "Resultados" : listPreset.label) : prevView?.k === "list" ? (PRESETS.find((p) => p.id === prevView.preset)?.label ?? "Lista") : prevView?.k === "fav" ? "Guardados" : prevView?.k === "map" ? "Mapa" : prevView?.k === "compare" ? "Comparar" : "Inicio";
  // El mapa sitúa lo que estabas viendo: la lista abierta o, desde la portada, las recomendadas
  const mapFocus = prevView?.k === "detail" ? prevView.id : null;
  const [mapMenu, setMapMenu] = useState(false); // en pantallas táctiles no hay "pasar el cursor": se abre con un toque
  const mapRows = mapFocus && !listed.some((r) => r.id === mapFocus) ? [...listed, ...(data?.rows.filter((r) => r.id === mapFocus) ?? [])] : listed;

  const popOpts: [string, string][] = [1000, 2000, 5000, 10000, 25000, 50000].map((v) => [String(v), `${fmt.format(v)} hab.`]);
  const opts = (vals: number[], fmtv: (v: number) => string): [string, string][] => [["", "Cualquiera"], ...vals.map((v): [string, string] => [String(v), fmtv(v)])];

  const panelBody = (id: string) => {
    switch (id) {
      case "ambito":
        return (
          <>
            <Sel
              label="Comunidad autónoma"
              value={f.ccaa}
              onChange={(v) => set({ ccaa: v, prov: places.provs.find((p) => p.name === f.prov && (!v || p.ccaa === v)) ? f.prov : "" })}
              options={[["", "Toda España"], ...places.ccaas.map((c): [string, string] => [c, c])]}
            />
            <Sel
              label="Provincia"
              value={f.prov}
              onChange={(v) => set({ prov: v })}
              options={[["", f.ccaa ? `Toda ${f.ccaa}` : "Todas"], ...places.provs.filter((p) => !f.ccaa || p.ccaa === f.ccaa).map((p): [string, string] => [p.name, p.name])]}
            />
          </>
        );
      case "tamano":
        return (
          <>
            <Sel label="Población mínima" value={String(f.minPop)} onChange={(v) => set({ minPop: Number(v) })} options={popOpts} />
            <Sel
              label="Población máxima"
              value={String(f.maxPop)}
              onChange={(v) => set({ maxPop: Number(v) })}
              options={[["0", "Sin límite"], ...[10000, 25000, 50000, 100000].map((v): [string, string] => [String(v), `${fmt.format(v)} hab.`])]}
              note="Útil para descartar grandes ciudades y buscar pueblos medianos."
            />
          </>
        );
      case "crec":
        return (
          <>
            <Sel
              label="Población en los últimos 5 años"
              value={optNum(f.minG5)}
              onChange={(v) => set({ minG5: numOrNull(v) })}
              options={opts([0, 5, 10, 20], (v) => `Crece al menos ${v} %`)}
            />
            <Sel
              label="Obra nueva reciente (viviendas por 1.000 hab. en 5 años)"
              value={optNum(f.minViv)}
              onChange={(v) => set({ minViv: numOrNull(v) })}
              options={opts([10, 20, 40], (v) => `Al menos ${v}`)}
            />
            <div className="sm:col-span-2">
              <div className="flex items-baseline justify-between text-sm font-semibold">
                <span>Puntuación del índice entre</span>
                <span className="tabular-nums">
                  {f.minScore} y {f.maxScore}
                </span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <label className="text-xs text-muted">
                  Mínimo
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={f.minScore}
                    onChange={(e) => {
                      const v = +e.target.value;
                      set({ minScore: v, maxScore: Math.max(v, f.maxScore) });
                    }}
                    className="mt-0.5 h-2 w-full cursor-pointer accent-forest"
                  />
                </label>
                <label className="text-xs text-muted">
                  Máximo
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={f.maxScore}
                    onChange={(e) => {
                      const v = +e.target.value;
                      set({ maxScore: v, minScore: Math.min(v, f.minScore) });
                    }}
                    className="mt-0.5 h-2 w-full cursor-pointer accent-forest"
                  />
                </label>
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-baseline justify-between text-sm font-semibold">
                <span>Perspectivas de futuro mínimas</span>
                <span className="tabular-nums">{f.minFut}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={f.minFut}
                onChange={(e) => set({ minFut: +e.target.value })}
                className="mt-1 h-2 w-full cursor-pointer accent-forest"
              />
              <p className="mt-1 text-xs font-normal text-muted">
                El futuro ya cuenta un 22 % del índice; aquí puedes exigir además un mínimo propio (planeamiento, obra nueva y suelo de actividad).
              </p>
            </div>
          </>
        );
      case "plan":
        return (
          <>
            <Sel
              label="Viviendas previstas aún por construir (por 1.000 hab.)"
              value={optNum(f.minPend)}
              onChange={(v) => set({ minPend: numOrNull(v) })}
              options={opts([100, 300, 600, 1000], (v) => `Al menos ${fmt.format(v)}`)}
              note="Planes sobre el papel del SIU: muchos son antiguos y no se construirán."
            />
            <Sel
              label="Inversión pública municipal (€ por habitante)"
              value={optNum(f.minInv)}
              onChange={(v) => set({ minInv: numOrNull(v) })}
              options={opts([100, 200, 400], (v) => `Al menos ${v} €`)}
              note="Media 2019/2024 del capítulo 6 (Hacienda)."
            />
          </>
        );
      case "zona":
        return (
          <>
            <Sel
              label="Veredicto orientativo"
              value={String(f.minRec)}
              onChange={(v) => set({ minRec: Number(v) })}
              options={[["0", "Cualquiera"], ["1", "Quitar los descartados"], ["2", "A estudiar o mejor"], ["3", "Solo buenas candidatas"]]}
              note="Cruza crecimiento, zona y riesgo de okupación. Una buena candidata exige zona verificada (más de 20.000 hab.)."
            />
            <Sel
              label="Riesgo de okupación (estimado)"
              value={optNum(f.maxOk)}
              onChange={(v) => set({ maxOk: numOrNull(v) })}
              options={opts([40, 60, 75], (v) => (v === 40 ? "Solo bajo" : v === 60 ? "Bajo o medio" : "Quitar solo el alto"))}
            />
            <Sel
              label="Valoración de la zona"
              value={String(f.zone)}
              onChange={(v) => set({ zone: Number(v) })}
              options={[["0", "Cualquiera"], ["40", "Buena o media (valorada)"], ["60", "Solo buena (valorada)"]]}
              note="Solo se valora con seguridad municipal (más de 20.000 hab.): el resto queda fuera."
            />
            <Sel
              label="Renta neta mínima por persona"
              value={optNum(f.minRenta)}
              onChange={(v) => set({ minRenta: numOrNull(v) })}
              options={opts([12000, 14000, 16000, 20000], (v) => `Al menos ${fmt.format(v)} €`)}
            />
            <Sel
              label="Pobreza máxima (% con ingresos bajo el 60 % de la mediana)"
              value={optNum(f.maxPob)}
              onChange={(v) => set({ maxPob: numOrNull(v) })}
              options={opts([10, 15, 20], (v) => `Hasta el ${v} %`)}
            />
          </>
        );
      case "precio":
        return (
          <Sel
            label="Valor tasado máximo de la vivienda (€/m²)"
            value={optNum(f.maxVt)}
            onChange={(v) => set({ maxVt: numOrNull(v) })}
            options={opts([1500, 2000, 3000, 4000], (v) => `Hasta ${fmt.format(v)} €/m²`)}
            note="Solo existe en municipios de más de 25.000 hab.: al activarlo, el resto queda fuera."
          />
        );
      case "cerca":
        return (
          <>
            <Sel
              label="Distancia máxima a una ciudad de más de 100.000 hab."
              value={optNum(f.near)}
              onChange={(v) => set({ near: numOrNull(v) })}
              options={opts([15, 30, 50], (v) => `Menos de ${v} km`)}
              note="Distancia estimada por carretera. Útil para zonas dormitorio."
            />
            <Sel
              label="Distancia máxima a una universidad"
              value={optNum(f.maxUniKm)}
              onChange={(v) => set({ maxUniKm: numOrNull(v) })}
              options={opts([2, 5, 15, 30], (v) => `Menos de ${v} km`)}
            />
            <Sel
              label="Vivienda turística mínima"
              value={optNum(f.minTur)}
              onChange={(v) => set({ minTur: numOrNull(v) })}
              options={opts([2, 5, 10], (v) => `Al menos el ${v} %`)}
              note="Porcentaje de viviendas de uso turístico (INE)."
            />
            <Sel
              label="Distancia máxima al mar"
              value={optNum(f.maxCosta)}
              onChange={(v) => set({ maxCosta: numOrNull(v) })}
              options={opts([2, 10, 30], (v) => `Menos de ${v} km`)}
            />
          </>
        );
      default:
        return (
          <div className="space-y-2 sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-[15px] font-medium">
              <input type="checkbox" className="h-4 w-4 accent-forest" checked={f.onlyUni} onChange={(e) => set({ onlyUni: e.target.checked })} />
              Con universidad
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[15px] font-medium">
              <input type="checkbox" className="h-4 w-4 accent-forest" checked={f.onlyProj} onChange={(e) => set({ onlyProj: e.target.checked })} />
              Con proyectos previstos (ignora el tamaño mínimo)
            </label>
          </div>
        );
    }
  };


  const filterForm = (
    <>
                  {SECTIONS.map((sec) => (
                    <section key={sec.id} className="mb-6">
                      <div className="mb-2 flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold text-ink">{sec.title}</h3>
                        {sectionCount(f, sec.keys) > 0 && (
                          <button className="text-xs text-muted underline" onClick={() => reset(sec.keys)}>
                            Restablecer
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">{panelBody(sec.id)}</div>
                    </section>
                  ))}
                  <p className="text-xs text-muted">Los municipios sin el dato que pide un filtro quedan fuera: preferimos descartar a dar falsos positivos.</p>
    </>
  );
  const loading = <p className="py-16 text-center text-muted">Cargando datos de 8.131 municipios…</p>;
  const rowsOf = (rows: Row[], n: number, ranked = false) => (
    <ul>
      {rows.slice(0, n).map((r, i) => (
        <MuniRow key={r.id} r={r} rank={ranked ? i + 1 : undefined} onOpen={open} fav={favs.includes(r.id)} onFav={toggleFav} />
      ))}
    </ul>
  );
  const favRows = data ? applyFilters(data.rows, { ...DEFAULTS, minPop: 0 }, "score", favs) : [];

  return (
    <div className="min-h-dvh bg-white text-ink">
      <header className="sticky top-0 z-30 border-b border-black/40 bg-charcoal">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button onClick={home} className="shrink-0 text-xl font-bold leading-none tracking-tight text-gold hover:text-white" title="Ir al inicio">
            Inmo Growth
          </button>
          <input
            className="h-9 min-w-0 flex-1 rounded-full border border-transparent bg-white/95 px-4 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none"
            placeholder="Buscar municipio…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (view.k !== "home") setStack([{ k: "home" }]);
            }}
          />
          <button onClick={() => go({ k: "fav" })} aria-label={`Guardados (${favs.length})`} className="shrink-0 whitespace-nowrap text-sm font-semibold text-paper/80 hover:text-white">
            ★<span className="hidden sm:inline"> Guardados</span> {favs.length > 0 ? favs.length : ""}
          </button>
          <button
            onClick={() => (view.k === "map" ? back() : go({ k: "map" }))}
            className={`shrink-0 whitespace-nowrap text-sm font-semibold ${view.k === "map" ? "text-gold" : "text-paper/80 hover:text-white"}`}
          >
            {view.k === "map" ? "Cerrar" : "Mapa"}
          </button>
        </div>
      </header>

      {view.k === "map" ? (
        <div className="relative">
          <MapView rows={mapRows} focusId={mapFocus} favs={favs} onFav={toggleFav} data={data} hist={hist} sect={sect} ranks={ranks} />
          <div
            className="group absolute left-3 top-3 z-10 max-w-[min(28rem,calc(100%-4.5rem))]"
            onMouseLeave={() => setMapMenu(false)}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setMapMenu((x) => !x)}
                aria-expanded={mapMenu}
                className="flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.25)]"
              >
                {listPreset.label}
                <span className="text-white/70">· {fmt.format(listed.length)}</span>
              </button>
              {PRESETS.filter((p) => p.id !== preset).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    choose(p.id);
                    setMapMenu(false);
                  }}
                  className={`${mapMenu ? "inline-flex" : "hidden group-hover:inline-flex"} rounded-full bg-white px-3 py-1.5 text-[13px] font-medium text-ink shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:bg-tint`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : view.k === "compare" ? (
        <div className="mx-auto max-w-5xl px-4">
          <div className="py-3 text-sm">
            <button onClick={back} className="font-semibold text-forest">
              ← {backLabel}
            </button>
          </div>
          <Compare rows={favRows} onClose={back} onOpen={open} onRemove={toggleFav} />
        </div>
      ) : (
        <main className="mx-auto max-w-3xl px-4">
          {!data ? (
            loading
          ) : view.k === "detail" ? (
            sel ? (
              <Ficha
                key={sel.id}
                sel={sel}
                data={data}
                sect={sect}
                rank={ranks?.g.get(sel.id)}
                total={ranks?.total ?? 0}
                hist={hist}
                fav={favs.includes(sel.id)}
                onFav={() => toggleFav(sel.id)}
                onBack={back}
                backLabel={backLabel}
                onMap={() => go({ k: "map" })}
              />
            ) : (
              <p className="py-16 text-center text-muted">Municipio no encontrado.</p>
            )
          ) : view.k === "list" || view.k === "fav" ? (
            <div className="pb-16">
              <div className="py-3 text-sm">
                <button onClick={back} className="font-semibold text-forest">
                  ← {backLabel}
                </button>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">{view.k === "fav" ? "Guardados" : listPreset?.label}</h1>
              <p className="mt-1 text-muted">{view.k === "fav" ? "Los municipios que has marcado con la estrella, en este navegador." : listPreset?.hint}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line pb-3 text-sm">
                <span className="text-muted">
                  <b className="text-ink">{fmt.format(listed.length)}</b> municipios
                </span>
                {view.k === "list" && (
                  <>
                    <button onClick={() => setShowFilters((x) => !x)} aria-expanded={showFilters} className="font-semibold text-forest">
                      {showFilters ? "Ocultar filtros" : `Filtros${activeCount > 0 ? ` (${activeCount})` : ""}`}
                    </button>
                    <label className="flex items-center gap-1.5 text-muted">
                      Orden
                      <select className="bg-transparent font-semibold text-ink" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                        {SORTS.map(([k, t]) => (
                          <option key={k} value={k}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {view.k === "fav" && favs.length >= 2 && (
                  <button onClick={() => go({ k: "compare" })} className="font-semibold text-forest">
                    Comparar
                  </button>
                )}
              </div>
              {showFilters && view.k === "list" && (
                <div className="border-b border-line py-4">
                  {SECTIONS.map((sec) => (
                    <section key={sec.id} className="mb-6">
                      <div className="mb-2 flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold text-ink">{sec.title}</h3>
                        {sectionCount(f, sec.keys) > 0 && (
                          <button className="text-xs text-muted underline" onClick={() => reset(sec.keys)}>
                            Restablecer
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">{panelBody(sec.id)}</div>
                    </section>
                  ))}
                  <p className="text-xs text-muted">Los municipios sin el dato que pide un filtro quedan fuera: preferimos descartar a dar falsos positivos.</p>
                </div>
              )}
              {listed.length === 0 ? (
                <p className="py-10 text-center text-muted">{view.k === "fav" ? "Aún no has guardado ningún municipio." : "Ningún municipio cumple los filtros."}</p>
              ) : (
                <>
                  {rowsOf(listed, limit, true)}
                  {listed.length > limit && (
                    <button onClick={() => setLimit((n) => n + 20)} className="mt-4 w-full rounded-full bg-paper py-3 text-sm font-semibold text-ink hover:bg-tint">
                      Mostrar más ({fmt.format(listed.length - limit)} restantes)
                    </button>
                  )}
                </>
              )}
            </div>
          ) : q.trim() ? (
            <div className="pb-16 pt-6">
              <SectionHead title={`Resultados para «${q.trim()}»`} sub={searchHits.length === 0 ? "Ningún municipio con ese nombre." : undefined} />
              {rowsOf(searchHits, 40)}
            </div>
          ) : (
            <div className="pb-16 pt-8">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Dónde crece España</h1>
              <div className="mt-4 flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => choose(p.id)}
                    aria-pressed={p.id === preset}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${p.id === preset ? "bg-ink text-white" : "bg-paper text-ink hover:bg-tint"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm text-muted">{listPreset.hint}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line pb-3 text-sm">
                <span className="text-muted">
                  <b className="text-ink">{fmt.format(listed.length)}</b> municipios
                </span>
                <button onClick={() => setShowFilters((x) => !x)} aria-expanded={showFilters} className="font-semibold text-forest">
                  {showFilters ? "Ocultar filtros" : `Filtros${activeCount > 0 ? ` (${activeCount})` : ""}`}
                </button>
                <label className="flex items-center gap-1.5 text-muted">
                  Orden
                  <select className="bg-transparent font-semibold text-ink" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                    {SORTS.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {showFilters && <div className="border-b border-line py-4">{filterForm}</div>}
              {listed.length === 0 ? (
                <p className="py-10 text-center text-muted">Ningún municipio cumple los filtros.</p>
              ) : (
                <>
                  {rowsOf(listed, limit, true)}
                  {listed.length > limit && (
                    <button onClick={() => setLimit((n) => n + 20)} className="mt-4 w-full rounded-full bg-paper py-3 text-sm font-semibold text-ink hover:bg-tint">
                      Mostrar más ({fmt.format(listed.length - limit)} restantes)
                    </button>
                  )}
                </>
              )}
              <div className="mt-10">
        <details className="border-t border-line text-sm">
          <summary className="cursor-pointer py-3 text-sm font-semibold text-ink">¿Cómo se calcula el índice?</summary>
          <div className="space-y-2 pb-4 text-muted">
            <p>Puntuación 0-100 como media ponderada de percentiles entre municipios de 1.000 hab. o más. Si falta un indicador se reponderan los demás.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>25 % población</b>: crecimiento total, último año y personas ganadas (INE).
              </li>
              <li>
                <b>5 % inversión pública</b> por habitante: capítulo 6, media 2019/2024 (Hacienda).
              </li>
              <li>
                <b>8 % universidad</b>: mejor universidad a menos de 45 km por carretera estimada, según su tamaño y lo cerca que esté (Wikidata y OpenStreetMap).
              </li>
              <li>
                <b>{wNeg} % {hist ? "negocios nuevos" : "comercios"}</b>: supermercados y gimnasios por habitante
                {hist ? ", nov-2020 frente a hoy" : ", estado actual"} (OpenStreetMap).
              </li>
              <li>
                <b>22 % futuro</b>: 9 % obra nueva de los últimos 5 años (Catastro), 9 % vivienda prevista en el planeamiento y 4 % suelo para actividad económica (SIU).
              </li>
              <li>
                <b>8 % población joven</b>: edad media y % de menores de 18 años (INE, Atlas de renta).
              </li>
              <li>
                <b>10 % empleo</b>: 8 % paro registrado sobre la población de 18 a 64 años y 2 % su variación en un año (SEPE).
              </li>
              <li>
                <b>4 % mercado tensionado</b>: poca vivienda vacía (Censo 2021, INE).
              </li>
              <li>
                <b>10 % cerca de una ciudad grande</b> (más de 100.000 hab.) y <b>5 % cerca del mar</b>: distancia por carretera estimada a la ciudad; el mar, en línea recta. Si está a más de 60 km del
                mar, o a más de 45 km por carretera de una ciudad o universidad, ese indicador no cuenta ni penaliza.
              </li>
            </ul>
            <p>
              Las <b>perspectivas de futuro</b> (planeamiento y obra nueva) ya forman parte del
              índice: pesan un 22 %. En el filtro &quot;Crecimiento&quot; puedes exigir además un mínimo de futuro.
            </p>
            <p className="text-xs text-muted">
              <b>Planeamiento (SIU):</b> son viviendas previstas y aún no construidas en áreas de desarrollo urbanístico, según el planeamiento vigente
              que aportan las comunidades autónomas (cubre 5.898 municipios; fechas de 2020 a 2025). Son planes sobre el papel: muchos son
              antiguos, del boom inmobiliario, y no se llegarán a construir. La escala satura en torno a 2.000 viviendas pendientes por cada 1.000
              habitantes y la ficha avisa cuando el plan supera 3 por habitante. Los 15 proyectos marcados con 🏗️ son una lista curada a mano a
              partir de prensa, con su fuente: no es exhaustiva, por eso no entra en el índice (solo se muestra en la ficha). El Catastro no cubre País Vasco ni Navarra.
            </p>
            <p className="text-xs text-muted">
              <b>Zona</b> (buena ≥60, media 40–60, floja &lt;40): seguridad 35 % (Interior, solo capitales y municipios de más de 20.000 hab.), riesgo de
              okupación 30 %, renta 20 % y pobreza 15 % (INE). Sin seguridad municipal no se valora. El <b>riesgo de okupación</b> es una estimación: no hay
              datos públicos por municipio. Se parte de la provincia (denuncias de allanamiento y usurpación de Interior y juicios por ocupación ilegal
              del CGPJ, frente a la media nacional) y se reparte entre sus municipios según tamaño, vivienda vacía y pobreza, porque la okupación se
              concentra en ciudades grandes. Escala: en la media nacional = 40, el doble = 63.
              El <b>veredicto orientativo</b> cruza crecimiento, zona y okupación con reglas fijas: descarta si la zona es floja, el riesgo de okupación es
              alto o el crecimiento es bajo; solo da &quot;buena candidata&quot; con crecimiento ≥60, zona verificada ≥55 y riesgo de okupación &lt;60.
            </p>
            <p className="text-xs text-muted">
              Los puntos de OpenStreetMap se asignan al municipio más cercano (aproximación) y su mapeo mejora con los años. No es asesoramiento financiero.
            </p>
          </div>
        </details>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
