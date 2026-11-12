"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  alq: number | null; // alquiler: mediana €/m² al mes (Ministerio de Vivienda)
  alqR: number | null; // renta mensual mediana (€)
  alqY: number | null; // año del dato
  alqE: number | null; // €/m² al mes estimado hoy (el dato oficial llevado al año actual)
  alqRE: number | null; // renta mensual estimada hoy
  alqK: number | null; // ritmo anual aplicado en la estimación (%)
  alqG: number | null; // % en 5 años
  alqS: [number, number][] | null; // [año, €/m² al mes]
  rb: number | null; // rentabilidad bruta orientativa (%): alquiler anual / valor tasado municipal
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
  vtE?: number | null; // precio para filtrar: el municipal o, si no existe, la media de su provincia (se calcula al cargar)
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
const REC_COLOR = ["var(--brick)", "var(--gold)", "#5fb38f", "var(--forest)"] as const;
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

// Botón de información: el texto explicativo solo aparece al pasar el cursor o al tocarlo
function Info({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; w: number; top?: number; bottom?: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const show = () => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const w = Math.min(280, window.innerWidth - 24);
    const x = Math.min(Math.max(12, b.left + b.width / 2 - w / 2), window.innerWidth - w - 12);
    setPos(b.bottom + 180 > window.innerHeight ? { x, w, bottom: window.innerHeight - b.top + 6 } : { x, w, top: b.bottom + 6 });
  };
  useEffect(() => {
    if (!pos) return;
    const off = (e: Event) => {
      if (e.type === "pointerdown" && btn.current?.contains(e.target as Node)) return;
      setPos(null);
    };
    document.addEventListener("pointerdown", off);
    window.addEventListener("scroll", off, true);
    return () => {
      document.removeEventListener("pointerdown", off);
      window.removeEventListener("scroll", off, true);
    };
  }, [pos]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label="Más información"
        aria-expanded={pos !== null}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && setPos(null)}
        onClick={(e) => {
          e.stopPropagation();
          show(); // se cierra al tocar fuera, al desplazar o al retirar el cursor
        }}
        className="inline-grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-edge align-middle text-[11px] font-semibold leading-none text-muted hover:border-ink hover:text-ink"
      >
        i
      </button>
      {pos &&
        createPortal(
          <div
            role="tooltip"
            style={{ left: pos.x, width: pos.w, top: pos.top, bottom: pos.bottom }}
            className="pointer-events-none fixed z-[100] rounded-2xl bg-ink px-3.5 py-2.5 text-[13px] font-normal leading-relaxed text-white shadow-[0_8px_28px_rgba(0,0,0,0.3)]"
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

function ZoneRow({ label, state, main, sub }: { label: string; state: "ok" | "warn" | "bad" | "nd"; main: string; sub: string }) {
  const dot = { ok: "bg-forest", warn: "bg-gold", bad: "bg-brick", nd: "bg-edge" }[state];
  return (
    <li className="flex items-center gap-2.5 py-3">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="min-w-0 flex-1 text-[15px] text-ink">{label}</span>
      <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ink">{main}</span>
      <Info>{sub}</Info>
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
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight">La zona</h2>
        <Info>
          {nd ? "Sin seguridad municipal (solo capitales y más de 20.000 hab.) no se valora. " : `${v.label}. `}
          Seguridad 35 %, riesgo de okupación 30 %, renta 20 %, pobreza 15 %. Datos del municipio entero, no de calles concretas.
        </Info>
        <span className="ml-auto flex items-center gap-1.5 text-[15px] font-semibold tabular-nums text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: zoneDot(sel.zona) }} />
          {sel.zona === null ? "Sin valorar" : `${cap(zoneShort(sel.zona).replace("Zona ", ""))} · ${sel.zona}`}
        </span>
      </div>
      <ul className="mt-1">
        <ZoneRow
          label="Seguridad"
          state={zst(sel.sSeg)}
          main={sel.crim === null ? "—" : `${fmt1.format(sel.crim)} delitos/1.000 hab.`}
          sub={
            sel.crim === null
              ? "Interior solo publica criminalidad de las capitales y de los municipios de más de 20.000 habitantes."
              : `Hechos delictivos por 1.000 hab. en 2025${sel.crimT === null ? "" : ` (${sgn(sel.crimT)}% frente a 2024)`}. Mediana de los municipios grandes: ${fmt1.format(zref?.crim ?? 0)}. Violentos: ${fmt1.format(sel.crimV ?? 0)}; robos con fuerza en domicilios: ${fmt1.format(sel.crimD ?? 0)}.`
          }
        />
        <ZoneRow
          label="Okupación"
          state={sel.okR === null ? "nd" : sel.okR < 40 ? "ok" : sel.okR < 60 ? "warn" : "bad"}
          main={sel.okR === null ? "—" : `${okLevel(sel.okR)} · ${sel.okR}`}
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
          main={sel.renta === null ? "—" : `${fmt.format(sel.renta)} €`}
          sub={`Renta neta por persona al año${sel.rentaH === null ? "" : ` (${fmt.format(sel.rentaH)} € por hogar)`}. Mediana de los municipios: ${fmt.format(zref?.renta ?? 0)} € (INE, Atlas de renta).`}
        />
        <ZoneRow
          label="Pobreza"
          state={nd ? "nd" : zst(sel.sPob)}
          main={sel.pob === null ? "—" : `${fmt1.format(sel.pob)}%`}
          sub={`Población con ingresos por debajo del 60 % de la mediana. Mediana de los municipios: ${fmt1.format(zref?.pob ?? 0)}% (INE).`}
        />
      </ul>
      {alerts.length > 0 && (
        <div className="mt-1 flex items-center gap-2 text-sm text-brick">
          <span>⚠ {alerts.length === 1 ? "1 señal de alerta" : `${alerts.length} señales de alerta`}</span>
          <Info>{cap(alerts.join("; "))}.</Info>
        </div>
      )}
    </section>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// Dato en formato "cifra grande": etiqueta pequeña encima, valor debajo y la explicación tras el botón de información
function Stat({ label, value, dot, info }: { label: string; value: string; dot?: string; info?: ReactNode }) {
  return (
    <div className="py-3">
      <dt className="flex items-center gap-1.5 text-[13px] text-muted">
        {label}
        {info && <Info>{info}</Info>}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-[17px] font-semibold tabular-nums text-ink">
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
      const send = (clave: string | null) =>
        fetch("/api/informe", { method: "POST", headers: { "Content-Type": "application/json", ...(clave ? { "x-informe-clave": clave } : {}) }, body: JSON.stringify({ id }) });
      let clave: string | null = null;
      try {
        clave = localStorage.getItem("inmo-clave");
      } catch {
        // sin almacenamiento: se pedirá cada vez
      }
      let res = await send(clave);
      let j = await res.json();
      if (res.status === 401 && j.clave) {
        // versión publicada con clave de acceso: se pide una vez y se recuerda en este navegador
        const typed = window.prompt("Clave de acceso para los informes con IA");
        if (typed) {
          res = await send(typed);
          j = await res.json();
          if (res.ok) {
            try {
              localStorage.setItem("inmo-clave", typed);
            } catch {
              // no se puede recordar
            }
          } else if (res.status === 401) j = { error: "Clave incorrecta." };
        }
      }
      setSt({ id, loading: false, data: res.ok ? j : null, error: res.ok ? null : (j.error ?? "No se pudo generar el informe.") });
    } catch {
      setSt({ id, loading: false, data: null, error: "No se pudo contactar con el servidor." });
    }
  };
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Precios y noticias</h2>
          <Info>Resumen con IA de precios de compra y alquiler, okupación y proyectos de {name}, con sus fuentes. Busca en la web: tarda entre 30 segundos y 2 minutos.</Info>
        </div>
        {!cur.data && (
          <button onClick={run} disabled={cur.loading} className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white hover:bg-charcoal disabled:opacity-60">
            {cur.loading ? "Buscando…" : "Generar"}
          </button>
        )}
      </div>
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
    { label: "Alquiler mensual (estimado)", get: (r) => r.alqRE, show: (v) => `≈ ${fmt.format(v)} €`, best: null },
    { label: "Rentabilidad bruta", get: (r) => r.rb, show: (v) => `${fmt1.format(v)}%`, best: "max" },
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
  minUni: number | null; // acceso universitario mínimo (0-100: tamaño de la universidad x cercanía); deja fuera las sedes pequeñas
  onlyUni: boolean;
  onlyProj: boolean;
  minScore: number;
  maxScore: number;
  minFut: number; // perspectivas de futuro mínimas (0 = sin mínimo)
};
const DEFAULTS: Filters = {
  q: "", ccaa: "", prov: "", minPop: 5000, maxPop: 0, minG5: null, minViv: null, minPend: null, minInv: null, minRec: 0, maxOk: null, zone: 0,
  minRenta: null, maxPob: null, maxVt: null, near: null, maxCosta: null, minTur: null, maxUniKm: null, minUni: null, onlyUni: false, onlyProj: false, minScore: 0, maxScore: 100, minFut: 0,
};
// Estrategias: puntos de partida de un clic. Cada una parte de los filtros por defecto y aplica los suyos.
type SortKey = "score" | "fut" | "ok" | "g5" | "est";
const PRESETS: { id: string; label: string; hint: string; f: Partial<Filters>; sort?: SortKey }[] = [
  { id: "buenas", label: "Buenas candidatas", hint: "Crecimiento alto, zona verificada y poco riesgo de okupación", f: { minRec: 3 } },
  { id: "recomendadas", label: "Las que más crecen", hint: "A estudiar o mejor: crecimiento suficiente y sin señales de alerta", f: { minRec: 2 } },
  { id: "seguras", label: "Zona tranquila", hint: "Zona buena y riesgo de okupación bajo, sin los descartados, ordenadas por menor riesgo", f: { zone: 60, maxOk: 40, minRec: 1 }, sort: "ok" },
  { id: "estudiantes", label: "Alquiler a estudiantes", hint: "Universidad grande y cercana, sin sedes pequeñas. Incluye todas las ciudades universitarias; el punto de color avisa del veredicto. Orden: 60 % universidad, 25 % crecimiento, 15 % poca okupación", f: { minUni: 25 }, sort: "est" },
  { id: "cinturon", label: "Cerca de gran ciudad", hint: "A menos de 30 km de una ciudad grande y hasta 50.000 habitantes", f: { near: 30, maxPop: 50000, minRec: 1 } },
  { id: "turismo", label: "Destino turístico", hint: "Más del 5 % de las viviendas son turísticas, sin los descartados: demanda de alquiler vacacional (y más regulación)", f: { minTur: 5, minRec: 1 } },
  { id: "costa", label: "Costa", hint: "A menos de 10 km del mar, sin los descartados", f: { maxCosta: 10, minRec: 1 } },
  { id: "auge", label: "Pueblos en auge", hint: "De 2.000 a 25.000 habitantes que más crecen", f: { minPop: 2000, maxPop: 25000, minG5: 8, minRec: 1 }, sort: "g5" },
  { id: "todas", label: "Todo", hint: "Todos los municipios de 5.000 habitantes o más, incluidos los descartados", f: {} },
];
const SORTS: [SortKey, string][] = [
  ["score", "Índice"],
  ["g5", "Más crecimiento"],
  ["ok", "Menos okupación"],
];

// Opción de filtro: una pastilla que se marca o desmarca
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={on} className={`rounded-full px-3.5 py-2 text-sm font-medium ${on ? "bg-ink text-white" : "bg-paper text-ink hover:bg-tint"}`}>
      {children}
    </button>
  );
}
function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <div className="mb-2 text-[13px] text-muted">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

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
        <div className="flex gap-1 whitespace-nowrap text-[13px]">
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
      <div className="mt-3 flex items-center gap-1.5 text-sm text-muted">
        <span className="font-semibold tabular-nums" style={{ color: col }}>
          {ch >= 0 ? "+" : ""}
          {fmt1.format(ch)}%
        </span>
        desde {pts[0][0]}
        {se.note ? <Info>{cap(se.note)}.</Info> : null}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-2 h-36 w-full" role="img" aria-label={`${se.label} de ${pts[0][0]} a ${pts[pts.length - 1][0]}`}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} stroke="var(--line)" strokeWidth="2" />
        <polyline points={line} fill="none" stroke={col} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-xs tabular-nums text-muted">
        <span>
          {pts[0][0]} · {(pts[0][1] < 100 ? fmt1 : fmt).format(pts[0][1])} {se.unit}
        </span>
        <span>
          {pts[pts.length - 1][0]} · {(pts[pts.length - 1][1] < 100 ? fmt1 : fmt).format(pts[pts.length - 1][1])} {se.unit}
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
    new maplibregl.Marker({ color: "#0a8f5b", scale: 0.6 }).setLngLat([r.lon, r.lat]).addTo(m);
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
    <li className="flex items-center gap-2">
      <button onClick={() => onOpen(r)} className="flex min-w-0 flex-1 items-center gap-3 py-3.5 text-left">
        {rank !== undefined && <span className="w-5 shrink-0 text-xs tabular-nums text-muted">{rank}</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-ink">{r.n}</span>
          <span className="flex items-center gap-1.5 truncate text-[13px] text-muted" title={rc?.label}>
            {rc && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: rc.color }} />}
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
  mapLabel = "Mapa",
}: {
  sel: Row;
  data: Data | null;
  sect: Record<string, SectInfo> | null;
  rank?: number;
  total: number;
  hist: boolean;
  fav: boolean;
  onFav: () => void;
  onBack?: () => void;
  backLabel?: string;
  onMap?: () => void;
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
      <li key={f.k} className="flex items-center gap-2.5 py-2.5 text-[15px]">
        <span className={`shrink-0 font-semibold ${sign > 0 ? "text-forest" : "text-brick"}`}>{sign > 0 ? "✓" : "✕"}</span>
        <span className="min-w-0 flex-1 text-ink">{f.label}</span>
        <Info>
          {f.hint}.
          {PCT_FACTORS.has(f.k) && (sign > 0 ? ` Mejor que el ${Math.round(f.v ?? 0)} % de los municipios.` : ` Peor que el ${Math.round(100 - (f.v ?? 0))} % de los municipios.`)}
        </Info>
      </li>
    ));
  const vp = data?.vtProv?.[sel.id.slice(0, 2)];
  const vpLast = vp && vp.length > 0 ? vp[vp.length - 1][1] : null;

  return (
    <article className="@container pb-16">
      <div className="flex items-center justify-between gap-2 whitespace-nowrap py-3 text-sm">
        {onBack ? (
          <button onClick={onBack} className="min-w-0 truncate font-semibold text-forest hover:text-forest-dark">
            ← {backLabel}
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-4">
          {onMap && (
            <button onClick={onMap} className="font-semibold text-muted hover:text-ink">
              {mapLabel}
            </button>
          )}
          <button onClick={onFav} aria-pressed={fav} className={`font-semibold ${fav ? "text-gold" : "text-muted hover:text-ink"}`}>
            {fav ? "★ Guardado" : "☆ Guardar"}
          </button>
        </div>
      </div>

      <header className="flex items-start justify-between gap-4 pt-1">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-ink">{sel.n}</h1>
          <p className="text-sm text-muted">
            {sel.prov} · {fmt.format(sel.pop)} hab.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <span className="text-6xl font-semibold leading-none tabular-nums tracking-tight text-ink">{sel.score === null ? "—" : fmt1.format(sel.score)}</span>
            <Info>Índice de crecimiento, de 0 a 100{rank ? `. Puesto ${fmt.format(rank)} de ${fmt.format(total)} municipios` : ""}.</Info>
          </div>
          {rec && (
            <div className="mt-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: rec.color }} />
              {rec.label}
              {rec.bad.length + rec.warn.length + rec.good.length > 0 && <Info>{cap([...rec.bad, ...rec.warn, ...rec.good].join(", "))}.</Info>}
            </div>
          )}
        </div>
        <MiniMap r={sel} />
      </header>

      {(() => {
        const series: Serie[] = [];
        if (sel.ps && data) series.push({ id: "pop", label: "Población", pts: sel.ps.map((v, i) => [data.psY + i, v]), unit: "hab.", up: "good" });
        if (sel.vtS) series.push({ id: "vt", label: "Precio", pts: sel.vtS, unit: "€/m²", up: "good", note: "precio de tasación (Ministerio)" });
        else if (vp && vp.length > 2)
          series.push({ id: "vt", label: "Precio", pts: vp, unit: "€/m²", up: "good", note: `media de la provincia de ${sel.prov}: el Ministerio solo lo da por municipio en los de más de 25.000 hab` });
        if (sel.alqS) series.push({ id: "alq", label: "Alquiler", pts: sel.alqS, unit: "€/m² al mes", up: "good", note: "mediana de los contratos declarados; último dato oficial, 2024 (Ministerio de Vivienda)" });
        if (sel.ocupS) series.push({ id: "ok", label: "Okupación", pts: sel.ocupS.map((v, i) => [2021 + i, v]), unit: "denuncias", up: "bad", note: `denuncias en toda la provincia de ${sel.prov}` });
        return series.length > 0 ? (
          <section className="mt-7">
            <TrendChart series={series} />
          </section>
        ) : null;
      })()}

      <section className="mt-8">
        <dl className="grid grid-cols-2 gap-x-6 @xl:grid-cols-3">
          <Stat
            label="Okupación"
            value={sel.okR === null ? "—" : okLevel(sel.okR)}
            dot={okDot(sel.okR)}
            info={sel.okR === null ? "Sin datos suficientes." : `Riesgo estimado: ${sel.okR}/100. No hay datos públicos por municipio: se reparte el dato de la provincia según tamaño, vivienda vacía y pobreza.`}
          />
          <Stat
            label="Zona"
            value={sel.zona === null ? "—" : cap(zoneShort(sel.zona).replace("Zona ", ""))}
            dot={zoneDot(sel.zona)}
            info={sel.zona === null ? "Sin seguridad municipal (solo capitales y más de 20.000 hab.) no se valora." : `${sel.zona}/100: seguridad, okupación, renta y pobreza.`}
          />
          <Stat label="Paro" value={sel.paro === null ? "—" : `${fmt1.format(sel.paro)}%`} info="Paro registrado sobre la población de 18 a 64 años (SEPE)." />
          <Stat
            label="Valor tasado"
            value={sel.vt !== null ? `${fmt.format(sel.vt)} €/m²` : vpLast !== null ? `${fmt.format(vpLast)} €/m²` : "—"}
            info={sel.vt !== null ? "Precio de tasación de la vivienda (Ministerio)." : `Media de la provincia de ${sel.prov}: el Ministerio solo lo publica por municipio en los de más de 25.000 hab.`}
          />
          <Stat
            label="Alquiler"
            value={sel.alqRE !== null ? `≈ ${fmt.format(sel.alqRE)} €/mes` : sel.alqE !== null ? `≈ ${fmt1.format(sel.alqE)} €/m²` : "—"}
            info={
              sel.alq === null
                ? "Sin dato de alquiler (Ministerio de Vivienda)."
                : `Estimación para hoy (${fmt1.format(sel.alqE ?? 0)} €/m² al mes). El último dato oficial es de ${sel.alqY}: ${sel.alqR === null ? "" : `${fmt.format(sel.alqR)} €/mes, `}${fmt1.format(sel.alq)} €/m²; se actualiza con su subida anual reciente (${fmt1.format(sel.alqK ?? 0)} %). Son contratos en vigor, no anuncios: un piso que sale hoy al mercado suele pedir más. Para precios de anuncios, usa «Precios y noticias».`
            }
          />
          {sel.rb !== null && (
            <Stat label="Rentabilidad bruta" value={`${fmt1.format(sel.rb)}%`} info="Orientativa: alquiler estimado de un año dividido entre el valor tasado, antes de gastos e impuestos." />
          )}
          <Stat label="Vivienda vacía" value={sel.vac === null ? "—" : `${fmt1.format(sel.vac)}%`} info="Censo de 2021 (INE)." />
          <Stat
            label="Universidad"
            value={sel.uniKm === null ? "—" : `${fmt1.format(sel.uniKm)} km`}
            info={sel.uniKm === null ? "Ninguna a menos de 45 km por carretera." : `${sel.uniNear ?? "Sede universitaria"}${sel.uniAt ? `, en ${sel.uniAt}` : ""}. Distancia estimada por carretera.`}
          />
          <Stat label="Ciudad grande" value={sel.dc === 0 ? "Lo es" : `${fmt.format(sel.dc)} km`} info={sel.dc === 0 ? "Tiene más de 100.000 habitantes." : `${sel.cn}, la ciudad de más de 100.000 hab. más cercana por carretera (estimado).`} />
          <Stat label="Mar" value={sel.costa === null ? "—" : `${fmt.format(Math.round(sel.costa))} km`} info="Distancia en línea recta." />
          <Stat
            label="Vivienda turística"
            value={sel.tur === null ? "—" : `${fmt1.format(sel.tur)}%`}
            info={`${sel.tur === null ? "Sin dato" : `${fmt.format(sel.turN ?? 0)} viviendas de uso turístico`}${sel.turP === null ? "" : `; ${fmt1.format(sel.turP)} plazas por 100 hab`} (INE).`}
          />
          {sel.pernH !== null && (
            <Stat
              label="Turismo anual"
              value={`${fmt1.format(sel.pernH)} noches/hab.`}
              info={`Pernoctaciones al año por habitante${sel.pernY ? ` (${sel.pernY})` : ""}${sel.pernT === null ? "" : `; ${sgn(sel.pernT)}% en un año`}. Solo en puntos turísticos del INE.`}
            />
          )}
          <Stat
            label="Vivienda prevista"
            value={sel.pendK === null ? "—" : `${fmt.format(sel.pendK)} por mil hab.`}
            info={`Viviendas previstas en el planeamiento y aún sin construir, por 1.000 habitantes (SIU).${(sel.pendK ?? 0) >= 3000 ? " Son muchísimas para su tamaño: suele ser un plan antiguo o inviable." : ""}`}
          />
        </dl>
      </section>

      {(pros.length > 0 || cons.length > 0) && (
        <section className="mt-6 grid gap-x-10 gap-y-4 @xl:grid-cols-2">
          {pros.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold tracking-tight">A favor</h2>
              <ul>{impact(pros, 1)}</ul>
            </div>
          )}
          {cons.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold tracking-tight">En contra</h2>
              <ul>{impact(cons, -1)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <ZonePanel sel={sel} zref={data?.zref} />
      </section>

      <section className="mt-8">
        <InformePanel id={sel.id} name={sel.n} />
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href={idealistaUrl(sel)} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest">
            Casas en idealista ↗
          </a>
          <a href={googleUrl(sel)} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest">
            Google ↗
          </a>
        </div>
      </section>

      {sel.proj && sel.proj.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Proyectos</h2>
          <ul>
            {sel.proj.map((p) => (
              <li key={p.n} className="flex items-center gap-2.5 py-2.5 text-[15px]">
                <span className="shrink-0">{PROJ_ICON[p.t] ?? "🏗️"}</span>
                <a href={p.u} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-ink hover:text-forest">
                  {p.n} ↗
                </a>
                <Info>{p.e}</Info>
              </li>
            ))}
          </ul>
        </section>
      )}

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

// Hoja que sube desde abajo y se superpone al mapa, como en las apps de bolsa: se baja arrastrando o con la flecha
function Sheet({ expanded, onExpand, onDown, children }: { expanded: boolean; onExpand: () => void; onDown: () => void; children: ReactNode }) {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number; ok: boolean } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  return (
    <div
      onTouchStart={(e) => {
        const inHandle = (e.target as HTMLElement).closest("[data-handle]") !== null;
        drag.current = { y: e.touches[0].clientY, ok: !expanded || inHandle || (scroller.current?.scrollTop ?? 0) <= 0 };
      }}
      onTouchMove={(e) => {
        const d = drag.current;
        if (!d?.ok) return;
        const v = e.touches[0].clientY - d.y;
        setDy(expanded ? Math.max(0, v) : Math.max(-60, v));
      }}
      onTouchEnd={() => {
        if (dy > 70) onDown();
        else if (dy < -40) onExpand();
        drag.current = null;
        setDy(0);
      }}
      style={{ transform: `translateY(${dy}px)`, transition: dy ? "none" : "transform 0.25s ease" }}
      className={`sheet-in absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-2xl flex-col rounded-t-3xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.18)] ${expanded ? "h-[calc(100%-69px)]" : "touch-none"}`}
    >
      <div data-handle className="relative flex h-11 shrink-0 items-start justify-center pt-2.5">
        <button onClick={expanded ? onDown : onExpand} aria-label={expanded ? "Reducir" : "Ver ficha completa"} className="h-1.5 w-10 rounded-full bg-edge" />
        <button onClick={onDown} aria-label={expanded ? "Bajar la ficha" : "Cerrar"} className="absolute right-3 top-2 grid h-8 w-8 place-items-center rounded-full bg-paper text-ink hover:bg-tint">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      <div ref={scroller} className={`min-h-0 flex-1 px-5 ${expanded ? "overflow-y-auto overscroll-contain" : ""}`}>
        {children}
      </div>
    </div>
  );
}

// Hoja modal (filtros, selector de lista): se cierra tocando fuera o deslizándola hacia abajo
function ModalSheet({ label, onClose, panelClass, children }: { label: string; onClose: () => void; panelClass: string; children: ReactNode }) {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number; ok: boolean } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-label={label}>
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div
        ref={panel}
        onTouchStart={(e) => {
          // solo se arrastra si el contenido bajo el dedo está arriba del todo (si no, el gesto es desplazar la lista)
          let ok = true;
          for (let n = e.target as HTMLElement | null; n; n = n === panel.current ? null : n.parentElement) if (n.scrollTop > 0) ok = false;
          drag.current = { y: e.touches[0].clientY, ok };
        }}
        onTouchMove={(e) => {
          const d = drag.current;
          if (d?.ok) setDy(Math.max(0, e.touches[0].clientY - d.y));
        }}
        onTouchEnd={() => {
          if (dy > 70) onClose();
          drag.current = null;
          setDy(0);
        }}
        style={{ transform: `translateY(${dy}px)`, transition: dy ? "none" : "transform 0.25s ease" }}
        className={`sheet-in relative w-full max-w-md overscroll-contain rounded-t-3xl bg-white md:rounded-3xl ${panelClass}`}
      >
        {children}
      </div>
    </div>
  );
}

// Resumen del municipio en la hoja recogida
function SheetPeek({ r, fav, onFav, onExpand }: { r: Row; fav: boolean; onFav: () => void; onExpand: () => void }) {
  const rc = recommend(r);
  return (
    <div className="pb-5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xl font-semibold tracking-tight text-ink">{r.n}</div>
          <div className="text-sm text-muted">{r.prov}</div>
          <div className="mt-3 text-5xl font-semibold leading-none tabular-nums tracking-tight text-ink">{r.score === null ? "—" : fmt1.format(r.score)}</div>
        </div>
        <div className="shrink-0 text-right">
          <Sparkline ps={r.ps} w={120} h={44} />
          <div className="text-xs tabular-nums" style={{ color: r.g5 >= 0 ? "var(--forest)" : "var(--brick)" }}>
            {sgn(r.g5)}% en 5 años
          </div>
        </div>
      </div>
      {rc && (
        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: rc.color }} />
          {rc.label}
        </div>
      )}
      <dl className="mt-2 grid grid-cols-3 gap-x-4">
        <Stat label="Okupación" value={r.okR === null ? "—" : okLevel(r.okR)} dot={okDot(r.okR)} />
        <Stat label="Zona" value={r.zona === null ? "—" : cap(zoneShort(r.zona).replace("Zona ", ""))} dot={zoneDot(r.zona)} />
        <Stat label="Paro" value={r.paro === null ? "—" : `${fmt1.format(r.paro)}%`} />
      </dl>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={onExpand} className="flex-1 rounded-full bg-ink py-3 text-sm font-semibold text-white hover:bg-charcoal">
          Ver ficha
        </button>
        <button onClick={onFav} aria-pressed={fav} aria-label={fav ? "Quitar de guardados" : "Guardar"} className={`grid h-11 w-11 place-items-center rounded-full bg-paper text-xl leading-none ${fav ? "text-gold" : "text-muted"}`}>
          {fav ? "★" : "☆"}
        </button>
      </div>
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
  const [expanded, setExpanded] = useState(false); // ficha completa desplegada sobre el mapa
  const focusRef = useRef(focusId); // solo se usa al abrir el mapa
  const el = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Row | null>(null);
  const pickRef = useRef<Row | null>(null);
  const [box, setBox] = useState({ w: 800, h: 600 });
  const place = () => {
    const m = map.current;
    const r = pickRef.current;
    if (!m || !r) return;
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
      // el estilo base trae el mar gris oscuro: se aclara para que el mapa se integre con la interfaz blanca
      for (const l of m.getStyle().layers ?? []) {
        if (l.type === "fill" && /water/.test(l.id)) m.setPaintProperty(l.id, "fill-color", "#e4eaee");
        if (l.type === "background") m.setPaintProperty(l.id, "background-color", "#f7f7f6");
      }
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
          setExpanded(m.getContainer().clientWidth >= 768); // en pantallas anchas se abre ya la ficha completa; en móvil, el resumen
          place();
          // en pantallas estrechas la hoja tapa la parte baja: se sube la bolita para que siga a la vista
          if (m.getContainer().clientWidth < 768) m.easeTo({ center: [r.lon, r.lat], offset: [0, -120] });
        }
      });
      // un clic en cualquier parte del mapa que no sea una bolita cierra la ficha
      m.on("click", (e) => {
        if (m.queryRenderedFeatures(e.point, { layers: ["pts"] }).length > 0) return;
        pickRef.current = null;
        setPicked(null);
        setExpanded(false);
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
        setExpanded(m.getContainer().clientWidth >= 768);
        m.easeTo({ center: [fr.lon, fr.lat], zoom: 7, duration: 0, offset: m.getContainer().clientWidth < 768 ? [0, -120] : [0, 0] });
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
  const narrow = box.w < 768; // en móvil la hoja empieza recogida (resumen); en pantallas anchas, con la ficha completa
  const close = () => {
    pickRef.current = null;
    setPicked(null);
    setExpanded(false);
  };
  return (
    <div className="relative h-dvh">
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {picked && (
        <Sheet key={picked.id} expanded={expanded} onExpand={() => setExpanded(true)} onDown={() => (expanded && narrow ? setExpanded(false) : close())}>
          {expanded ? (
            <Ficha
              sel={picked}
              data={data}
              sect={sect}
              rank={ranks?.g.get(picked.id)}
              total={ranks?.total ?? 0}
              hist={hist}
              fav={favs.includes(picked.id)}
              onFav={() => onFav(picked.id)}
            />
          ) : (
            <SheetPeek r={picked} fav={favs.includes(picked.id)} onFav={() => onFav(picked.id)} onExpand={() => setExpanded(true)} />
          )}
        </Sheet>
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
    if (f.maxVt !== null) {
      const pr = r.vtE ?? r.vt;
      if (pr === null || pr > f.maxVt) continue;
    }
    if (f.near !== null && r.dc > f.near) continue;
    if (f.maxCosta !== null && (r.costa === null || r.costa > f.maxCosta)) continue;
    if (f.minTur !== null && (r.tur === null || r.tur < f.minTur)) continue;
    if (f.maxUniKm !== null && (r.uniKm === null || r.uniKm > f.maxUniKm)) continue;
    if (f.minUni !== null && (r.sUni === null || r.sUni < f.minUni)) continue;
    if (favOnly && !favOnly.includes(r.id)) continue;
    out.push(r);
  }
  const key: Record<SortKey, (r: Row) => number> = {
    score: (r) => r.score ?? 0,
    fut: (r) => r.fut ?? -1,
    ok: (r) => -(r.okR ?? 999),
    g5: (r) => r.g5,
    // alquiler a estudiantes: manda la universidad (tamaño y cercanía); después el crecimiento y el poco riesgo de okupación
    est: (r) => 0.6 * (r.sUni ?? 0) + 0.25 * (r.score ?? 0) + 0.15 * (100 - (r.okR ?? 50)),
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
  const [priceTxt, setPriceTxt] = useState(""); // precio máximo escrito a mano en los filtros
  const [pickList, setPickList] = useState(false); // selector de lista (hoja con las opciones)
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
        .then((d: Data) => {
          if (cancelled) return;
          for (const r of d.rows) {
            const vp = d.vtProv?.[r.id.slice(0, 2)];
            r.vtE = r.vt ?? (vp && vp.length > 0 ? vp[vp.length - 1][1] : null);
          }
          setData(d);
        })
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
    setPriceTxt("");
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
  const prevView = stack.length > 1 ? stack[stack.length - 2] : null;
  const backLabel =
    prevView?.k === "home" ? (q.trim() ? "Resultados" : listPreset.label) : prevView?.k === "list" ? (PRESETS.find((p) => p.id === prevView.preset)?.label ?? "Lista") : prevView?.k === "fav" ? "Guardados" : prevView?.k === "map" ? "Mapa" : prevView?.k === "compare" ? "Comparar" : "Inicio";
  // El mapa sitúa lo que estabas viendo: la lista abierta o, desde la portada, las recomendadas
  const mapFocus = prevView?.k === "detail" ? prevView.id : null;
  const [mapMenu, setMapMenu] = useState(false); // en pantallas táctiles no hay "pasar el cursor": se abre con un toque
  const mapRows = mapFocus && !listed.some((r) => r.id === mapFocus) ? [...listed, ...(data?.rows.filter((r) => r.id === mapFocus) ?? [])] : listed;

  // Filtros: pocas preguntas, las que decide un inversor (dónde, cuánto, tamaño, riesgo y cercanía), todas con pastillas
  const sizeIs = (lo: number, hi: number) => f.minPop === lo && f.maxPop === hi;
  // las pastillas se desmarcan al volver a tocarlas (sin opción "Cualquiera")
  const size = (lo: number, hi: number) => set(sizeIs(lo, hi) ? { minPop: base.minPop, maxPop: base.maxPop } : { minPop: lo, maxPop: hi });
  const filterDialog = showFilters && (
    <ModalSheet label="Filtros" onClose={() => setShowFilters(false)} panelClass="flex max-h-[88dvh] flex-col">
        <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-edge md:hidden" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-4">
          <h2 className="text-xl font-semibold tracking-tight">Filtros</h2>
          {(activeCount > 0 || sort !== (listPreset.sort ?? "score")) && (
            <button
              onClick={() => {
                setF({ ...base });
                setPriceTxt("");
                setSort(listPreset.sort ?? "score");
              }}
              className="text-sm font-semibold text-forest"
            >
              Borrar
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
          <FilterRow label="Dónde">
            <select
              className="h-10 w-full rounded-full bg-paper px-4 text-sm font-medium text-ink"
              value={f.prov ? `p:${f.prov}` : f.ccaa ? `c:${f.ccaa}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                set({ ccaa: v.startsWith("c:") ? v.slice(2) : "", prov: v.startsWith("p:") ? v.slice(2) : "" });
              }}
            >
              <option value="">Toda España</option>
              <optgroup label="Comunidades">
                {places.ccaas.map((c) => (
                  <option key={c} value={`c:${c}`}>
                    {c}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Provincias">
                {places.provs.map((x) => (
                  <option key={x.name} value={`p:${x.name}`}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </FilterRow>
          <FilterRow label="Precio máximo por m²">
            {[1500, 2500, 4000].map((v) => (
              <Chip
                key={v}
                on={f.maxVt === v && priceTxt === ""}
                onClick={() => {
                  setPriceTxt("");
                  set({ maxVt: f.maxVt === v && priceTxt === "" ? null : v });
                }}
              >
                {fmt.format(v)} €
              </Chip>
            ))}
            <label className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium ${priceTxt ? "bg-ink text-white" : "bg-paper text-ink"}`}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={100}
                placeholder="Otro"
                aria-label="Precio máximo por metro cuadrado, en euros"
                value={priceTxt}
                onChange={(e) => {
                  const t = e.target.value;
                  setPriceTxt(t);
                  set({ maxVt: t && Number(t) > 0 ? Number(t) : null });
                }}
                className={`w-14 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${priceTxt ? "placeholder:text-white/60" : "placeholder:text-muted"}`}
              />
              €
            </label>
          </FilterRow>
          <FilterRow label="Tamaño">
            <Chip on={sizeIs(2000, 10000)} onClick={() => size(2000, 10000)}>
              Pueblo
            </Chip>
            <Chip on={sizeIs(10000, 50000)} onClick={() => size(10000, 50000)}>
              Ciudad pequeña
            </Chip>
            <Chip on={sizeIs(50000, 0)} onClick={() => size(50000, 0)}>
              Ciudad
            </Chip>
          </FilterRow>
          <FilterRow label="Riesgo de okupación">
            <Chip on={f.maxOk === 40} onClick={() => set({ maxOk: f.maxOk === 40 ? null : 40 })}>
              Solo bajo
            </Chip>
            <Chip on={f.maxOk === 60} onClick={() => set({ maxOk: f.maxOk === 60 ? null : 60 })}>
              Bajo o medio
            </Chip>
          </FilterRow>
          <FilterRow label="Cerca de">
            <Chip on={f.maxCosta !== null} onClick={() => set({ maxCosta: f.maxCosta === null ? 10 : null })}>
              Mar
            </Chip>
            <Chip on={f.minUni !== null} onClick={() => set({ minUni: f.minUni === null ? 25 : null })}>
              Universidad
            </Chip>
            <Chip on={f.near !== null} onClick={() => set({ near: f.near === null ? 30 : null })}>
              Ciudad grande
            </Chip>
          </FilterRow>
          <FilterRow label="Ordenar por">
            {(listPreset.sort === "est" ? [["est", "Universidad"] as [SortKey, string], ...SORTS] : SORTS).map(([k, t]) => (
              <Chip key={k} on={sort === k} onClick={() => setSort(k)}>
                {t}
              </Chip>
            ))}
          </FilterRow>
        </div>
        <div className="shrink-0 px-5 pb-5 pt-3">
          <button onClick={() => setShowFilters(false)} className="w-full rounded-full bg-ink py-3 text-[15px] font-semibold text-white hover:bg-charcoal">
            {listed.length === 0 ? "Ningún municipio" : `Ver ${fmt.format(listed.length)} ${listed.length === 1 ? "municipio" : "municipios"}`}
          </button>
        </div>
    </ModalSheet>
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
      <header className={`fixed inset-x-0 top-0 z-30 border-b ${view.k === "map" ? "border-transparent bg-white/70 backdrop-blur-md" : "border-line bg-white"}`}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <button onClick={home} className="shrink-0 text-xl font-bold leading-none tracking-tight text-ink hover:text-forest" title="Ir al inicio">
            Inmo Growth
          </button>
          <input
            className="h-9 min-w-0 flex-1 rounded-full border border-transparent bg-paper px-4 text-sm text-ink placeholder:text-muted focus:border-ink focus:outline-none"
            placeholder="Buscar municipio…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (view.k !== "home") setStack([{ k: "home" }]);
            }}
          />
          <button onClick={() => go({ k: "fav" })} aria-label={`Guardados (${favs.length})`} className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink hover:text-forest">
            ★<span className="hidden sm:inline"> Guardados</span> {favs.length > 0 ? favs.length : ""}
          </button>
          <button
            onClick={() => (view.k === "map" ? back() : go({ k: "map" }))}
            className={`shrink-0 whitespace-nowrap text-sm font-semibold ${view.k === "map" ? "text-forest" : "text-ink hover:text-forest"}`}
          >
            {view.k === "map" ? "Cerrar" : "Mapa"}
          </button>
        </div>
      </header>
      {/* la cabecera va fija (en Safari la posición "sticky" no se mantenía): este hueco reserva su altura */}
      <div className="h-[57px]" aria-hidden="true" />

      {view.k === "map" ? (
        <div className="relative -mt-[57px]">
          <MapView rows={mapRows} focusId={mapFocus} favs={favs} onFav={toggleFav} data={data} hist={hist} sect={sect} ranks={ranks} />
          <div
            className="group absolute left-3 top-[69px] z-10 max-w-[min(28rem,calc(100%-4.5rem))]"
            onMouseLeave={() => setMapMenu(false)}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => {
                  setStack([{ k: "home" }]); // vuelve a la lista conservando la selección actual
                  window.scrollTo({ top: 0 });
                }}
                className="flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-2.5 pr-3 text-[13px] font-medium text-ink shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:bg-paper"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Lista
              </button>
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
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 pb-1 text-sm">
                <span className="flex items-center gap-1.5 text-muted">
                  <b className="text-ink">{fmt.format(listed.length)}</b> municipios
                  <Info>{view.k === "fav" ? "Los municipios que has marcado con la estrella, en este navegador." : listPreset?.hint}</Info>
                </span>
                {view.k === "list" && (
                  <>
                    <button onClick={() => setShowFilters((x) => !x)} aria-expanded={showFilters} className="font-semibold text-forest">
                      {showFilters ? "Ocultar filtros" : `Filtros${activeCount > 0 ? ` (${activeCount})` : ""}`}
                    </button>
                  </>
                )}
                {view.k === "fav" && favs.length >= 2 && (
                  <button onClick={() => go({ k: "compare" })} className="font-semibold text-forest">
                    Comparar
                  </button>
                )}
              </div>
              {view.k === "list" && filterDialog}
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
            <div className="pb-16 pt-7">
              <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Dónde invertir en vivienda</h1>
              <p className="mt-1.5 text-[15px] text-muted">Los municipios de España con más crecimiento</p>
              <div className="mt-6 flex items-center gap-2">
                <button
                  onClick={() => setPickList(true)}
                  aria-haspopup="dialog"
                  className="flex min-w-0 items-center gap-2 rounded-full bg-ink py-2 pl-4 pr-3 text-[15px] font-semibold text-white hover:bg-charcoal"
                >
                  <span className="truncate">{listPreset.label}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowFilters((x) => !x)}
                  aria-haspopup="dialog"
                  className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-semibold ${activeCount > 0 ? "bg-tint text-forest-dark" : "bg-paper text-ink hover:bg-tint"}`}
                >
                  Filtros{activeCount > 0 ? ` · ${activeCount}` : ""}
                </button>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 text-sm tabular-nums text-muted">
                  {fmt.format(listed.length)}
                  <Info>
                    {fmt.format(listed.length)} municipios. {listPreset.hint}
                  </Info>
                </span>
              </div>
              {pickList && (
                <ModalSheet label="Elegir lista" onClose={() => setPickList(false)} panelClass="max-h-[85dvh] overflow-y-auto px-2 pb-6 pt-3 md:pb-3">
                    <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-edge md:hidden" />
                    {PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          choose(p.id);
                          setPickList(false);
                        }}
                        aria-pressed={p.id === preset}
                        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-paper"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-semibold text-ink">{p.label}</span>
                          <span className="block text-[13px] leading-snug text-muted">{p.hint}</span>
                        </span>
                        {p.id === preset && <span className="shrink-0 text-lg font-semibold text-forest">✓</span>}
                      </button>
                    ))}
                </ModalSheet>
              )}
              {filterDialog}
              <div className="mt-3" />
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
