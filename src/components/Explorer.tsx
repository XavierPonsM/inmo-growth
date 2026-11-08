"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  dc: number; // km hasta la ciudad grande (más de 100.000 hab.) más cercana
  cn: string; // nombre de esa ciudad
};

type ZRef = { crim: number | null; ocup: number | null; renta: number | null; pob: number | null };

// Veredicto de zona (criterio orientativo)
function zoneVerdict(z: number | null): { label: string; emoji: string; cls: string } {
  if (z === null) return { label: "Sin datos suficientes", emoji: "⚪", cls: "bg-paper text-muted border-edge" };
  if (z >= 60) return { label: "Zona buena", emoji: "🟢", cls: "bg-tint text-forest border-forest/40" };
  if (z >= 40) return { label: "Zona media", emoji: "🟡", cls: "bg-gold-soft text-ink border-gold/60" };
  return { label: "Zona por debajo de la media", emoji: "🔴", cls: "bg-brick-soft text-brick border-brick/40" };
}

const PROJ_ICON: Record<string, string> = { industria: "🏭", datos: "🖥️", ferrocarril: "🚄", sanidad: "🏥", vivienda: "🏘️" };
const PROJ_LABEL: Record<string, string> = { industria: "Industria", datos: "Centro de datos", ferrocarril: "Ferrocarril", sanidad: "Sanidad", vivienda: "Vivienda" };
type Data = { years: [number, number]; negHist: boolean; proyYears: [number, number] | null; zref: ZRef; rows: Row[] };
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
const badgeText = (v: number) => (v >= 68 ? "#fff" : "#1c1a17"); // texto blanco solo sobre los verdes oscuros (mejor contraste)
// Radio de la burbuja según la puntuación: 2 px (puntuación ~0) hasta 14 px (80 o más) a zoom 5; el doble a zoom 10 (k = 1 ó 2)
const SIZE_AT = (k: number) =>
  ["*", k, ["+", 2, ["*", 12, ["^", ["/", ["min", ["get", "score"], 80], 80], 2]]]] as unknown as maplibregl.ExpressionSpecification;
// Expresión de color de MapLibre y degradado de la leyenda, derivados de la misma escala
const MAP_COLOR = ["interpolate", ["linear"], ["get", "score"], ...STOPS.flatMap(([v, , hex]) => [v, hex])];
const LEGEND_GRADIENT = `linear-gradient(90deg, ${STOPS.map(([v, , hex]) => `${hex} ${v}%`).join(", ")})`;

function Badge({ v, big }: { v: number; big?: boolean }) {
  return (
    <span
      className={`inline-block rounded-md text-center font-semibold tabular-nums ${big ? "px-3 py-1 text-2xl" : "min-w-[2.75rem] px-1.5 py-0.5 text-sm"}`}
      style={{ background: scoreColor(v), color: badgeText(v) }}
    >
      {v}
    </span>
  );
}

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
type Factor = { k: string; label: string; w: number; v: number | null; hint: string; group: "past" | "future" };
function buildFactors(s: Row, d: Data | null, hist: boolean): Factor[] {
  const hasU = s.uni > 0 || s.uniOsm >= 2;
  const yrs = (d?.years[1] ?? 0) - (d?.years[0] ?? 0);
  return [
    { k: "pop", label: "Población", w: 0.39, v: s.sPop, group: "past", hint: `${sgn(s.g5)}% en ${yrs} años (${sgn(s.abs)} personas); último año ${sgn(s.g1)}%` },
    {
      k: "inv",
      label: "Inversión pública",
      w: 0.14,
      v: s.sInv,
      group: "past",
      hint:
        s.inv24 === null
          ? s.inv === null
            ? "Sin datos de Hacienda"
            : `Sin dato 2024; media ${fmt.format(s.inv)} €/hab.`
          : `${fmt.format(s.inv24)} €/hab. en 2024 (${fmt.format(Math.round((s.invT ?? 0) / 1000))} mil € en total)`,
    },
    { k: "uni", label: "Universidad", w: 0.13, v: s.sUni, group: "past", hint: hasU ? `${s.uniN ?? "Campus detectado"}${s.uni > 3 ? ` y ${s.uni - 3} más` : ""}` : "No se ha detectado universidad" },
    {
      k: "neg",
      label: hist ? "Negocios nuevos" : "Comercios",
      w: hist ? 0.08 : 0.04,
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
      w: 0.12,
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
      w: 0.05,
      v: s.sAe,
      group: "future",
      hint: s.aeP === null ? "Sin datos del SIU" : `${fmt.format(Math.round(s.aeP * s.pop))} m² edificables pendientes de industria, comercio y oficinas (${fmt.format(s.aeP)} m²/hab.)`,
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
  if (sel.sOcup !== null && sel.sOcup < 25) alerts.push("su provincia está entre las de más denuncias por allanamiento/usurpación");
  if (sel.sPob !== null && sel.sPob < 25) alerts.push("porcentaje de población con ingresos bajos entre los más altos");
  if (sel.sRenta !== null && sel.sRenta < 25) alerts.push("renta por persona entre las más bajas");
  return (
    <section className="rounded-lg border border-line bg-white p-3">
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
          label="Okupación (dato de la provincia)"
          state={nd ? "nd" : zst(sel.sOcup)}
          main={sel.ocup === null ? "Sin dato" : `${fmt1.format(sel.ocup)} denuncias de allanamiento/usurpación por 10.000 hab. en su provincia`}
          sub={
            sel.ocup === null
              ? "Interior solo publica este dato por provincia."
              : `Media nacional: ${fmt1.format(zref?.ocup ?? 0)}${sel.ocupT === null ? "" : `; ${sgn(sel.ocupT)}% desde 2021`}. Interior no lo publica por municipio, así que no puede medirse en ${sel.n}.`
          }
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
      {nd && (
        <p className="mt-2 rounded bg-white/70 p-2 text-xs font-medium text-ink">
          Sin dato de seguridad municipal no doy veredicto: Interior solo publica criminalidad en las capitales y en los municipios de más de 20.000
          habitantes, y prefiero no valorar antes que dar por buena una zona sin evidencia suficiente. La renta, la pobreza y la okupación provincial se
          muestran solo como contexto.
        </p>
      )}
      {alerts.length > 0 && (
        <p className="mt-2 rounded bg-white/70 p-2 text-xs font-medium text-ink">
          ⚠ Señales de alerta: {alerts.join("; ")}.
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        Puntuación orientativa (seguridad 30 %, renta 30 %, pobreza 30 %, okupación provincial 10 %). Solo se valora si hay seguridad municipal; si falta otro dato, se reparten los demás. Son
        estadísticas oficiales del municipio entero: no describen calles ni urbanizaciones concretas, y la criminalidad incluye hechos contra
        visitantes, por lo que infla los destinos turísticos. Si te preocupan las casas ocupadas, pregunta también en el ayuntamiento y a la policía
        local. No entra en el índice de crecimiento.
      </p>
    </section>
  );
}

function ScoreCard({ title, v, rank, total }: { title: string; v: number | null; rank?: number; total: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-3">
      <div className="text-xs font-medium text-muted">{title}</div>
      <div className="mt-1.5 flex items-center gap-3">
        {v === null ? <span className="text-muted">sin datos</span> : <Badge v={v} big />}
        {rank && (
          <div className="text-xs leading-tight text-muted">
            Puesto <b className="text-sm text-ink">{fmt.format(rank)}</b>
            <br />
            de {fmt.format(total)}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({
  sel,
  data,
  sect,
  rankG,
  rankF,
  total,
  hist,
  onBack,
  onMap,
}: {
  sel: Row;
  data: Data | null;
  sect: Record<string, SectInfo> | null;
  rankG?: number;
  rankF?: number;
  total: number;
  hist: boolean;
  onBack: () => void;
  onMap: () => void;
}) {
  const factors = buildFactors(sel, data, hist);
  const wsum = factors.reduce((a, f) => (f.v === null ? a : a + f.w), 0);
  // delta = puntos que aporta frente a un municipio "medio" (percentil 50) en ese indicador
  const calc = factors.map((f) => ({ ...f, delta: f.v === null ? null : (f.w * (f.v - 50)) / wsum }));
  const pros = calc.filter((f) => f.delta !== null && f.delta >= 0.4).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0)).slice(0, 5);
  const cons = calc.filter((f) => f.delta !== null && f.delta <= -0.4).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0)).slice(0, 5);
  const maxAbs = Math.max(1, ...[...pros, ...cons].map((f) => Math.abs(f.delta ?? 0)));
  const missing = factors.filter((f) => f.v === null && !["vt", "proj"].includes(f.k)).map((f) => f.label);
  const diff = sel.score === null ? 0 : sel.score - 50;
  const si = sect?.[sel.id];
  const detailWeight = (w: number) => `${fmt1.format(w * 100).replace(",0", "")}%`;

  const renderList = (items: typeof calc, sign: 1 | -1) => (
    <ul className="space-y-3">
      {items.map((f) => (
        <li key={f.k}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-ink">{f.label}</span>
            <span className={`shrink-0 font-bold tabular-nums ${sign > 0 ? "text-forest" : "text-brick"}`}>
              {sign > 0 ? "+" : "−"}
              {fmt1.format(Math.abs(f.delta ?? 0))} pts
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className={`h-full rounded-full ${sign > 0 ? "bg-forest" : "bg-brick"}`} style={{ width: `${Math.max(6, (Math.abs(f.delta ?? 0) / maxAbs) * 100)}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted">{f.hint}</div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="bg-white md:min-h-0 md:flex-1 md:overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-paper px-3 py-2">
        <button onClick={onBack} className="rounded-md px-2 py-1.5 text-sm font-semibold text-forest hover:bg-tint">
          ← Volver a la lista
        </button>
        <button onClick={onMap} className="rounded-md px-2 py-1.5 text-sm font-semibold text-muted hover:bg-line">
          Ver en el mapa
        </button>
      </div>

      <div className="space-y-5 p-4">
        <div>
          <h2 className="text-[24px] font-semibold leading-tight tracking-tight">{sel.n}</h2>
          <p className="text-sm text-muted">
            {sel.prov} · {fmt.format(sel.pop)} habitantes
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ScoreCard title="Índice de crecimiento" v={sel.score} rank={rankG} total={total} />
          <ScoreCard title="Perspectivas de futuro (35 % del índice)" v={sel.fut} rank={rankF} total={total} />
        </div>

        <ZonePanel sel={sel} zref={data?.zref} />

        <div className="rounded-lg border border-line bg-white p-3">
          <div className="text-sm font-semibold text-ink">Casas en venta en {sel.n}</div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a
              href={idealistaUrl(sel)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white shadow hover:bg-forest-dark"
            >
              Ver en idealista ↗
            </a>
            <a href={googleUrl(sel)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-forest underline">
              Si no abre la zona, buscar en Google
            </a>
          </div>
          <p className="mt-2 text-xs text-muted">
            El enlace se construye con el nombre del municipio y su provincia; no he podido comprobarlo en idealista (bloquea las consultas automáticas) y en
            algunos municipios puede no coincidir con su dirección.
          </p>
        </div>

        <section>
          <h3 className="text-base font-semibold">¿Por qué tiene esta puntuación?</h3>
          {sel.score !== null && (
            <p className="mt-1 text-sm text-muted">
              La puntuación mezcla {factors.filter((f) => f.v !== null).length} indicadores comparando el municipio con los demás (percentil de 0 a 100; 50 es un
              municipio medio). <b>{sel.n}</b> saca <b>{sel.score}</b>: {fmt1.format(Math.abs(diff))} puntos {diff >= 0 ? "por encima" : "por debajo"} de un municipio
              medio. Las barras muestran cuántos puntos suma o resta cada indicador respecto a ese municipio medio.
            </p>
          )}

          <div className="mt-4">
            <div className="mb-2 text-xs font-semibold text-forest">Lo que empuja su crecimiento</div>
            {pros.length > 0 ? renderList(pros, 1) : <p className="text-sm text-muted">Ningún indicador destaca por encima de la media.</p>}
          </div>

          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold text-brick">Lo que lo frena o no aporta</div>
            {cons.length > 0 ? renderList(cons, -1) : <p className="text-sm text-muted">Ningún indicador queda claramente por debajo de la media.</p>}
          </div>

          {(missing.length > 0 || (sel.pendK ?? 0) >= 3000) && (
            <div className="mt-4 space-y-1.5 rounded-lg border border-line bg-gold-soft p-3 text-xs text-ink">
              {(sel.pendK ?? 0) >= 3000 && (
                <p>
                  ⚠ El planeamiento prevé muchísimas más viviendas que el tamaño actual del municipio ({fmt.format(sel.pendK ?? 0)} por 1.000 hab.): suele
                  ser un plan antiguo o inviable, así que conviene no fiarse de ese indicador.
                </p>
              )}
              {missing.length > 0 && <p>Sin datos de: {missing.join(", ")}. Su peso se reparte entre los demás indicadores.</p>}
            </div>
          )}
        </section>

        {sel.proj && sel.proj.length > 0 && (
          <div className="space-y-2 rounded-lg border border-line bg-gold-soft p-3">
            <div className="text-xs font-semibold text-ink">Proyectos concretos (lista curada, no entra en el índice)</div>
            {sel.proj.map((p) => (
              <div key={p.n} className="text-sm">
                <div className="font-semibold text-ink">
                  {PROJ_ICON[p.t] ?? "🏗️"} {p.n}
                </div>
                <div className="text-muted">
                  <span className="font-medium">{PROJ_LABEL[p.t] ?? p.t}.</span> {p.e}{" "}
                  <a href={p.u} target="_blank" rel="noopener noreferrer" className="font-medium text-forest underline">
                    Fuente ↗
                  </a>
                </div>
              </div>
            ))}
            <div className="text-xs text-muted">Lista curada a partir de prensa: no es exhaustiva y el estado puede haber cambiado.</div>
          </div>
        )}

        {!sect ? (
          <div className="text-xs text-muted">Cargando sectores del planeamiento…</div>
        ) : si && (si.s.length > 0 || si.r > 0) ? (
          <div className="rounded-lg border border-edge bg-white p-3">
            <div className="text-xs font-semibold text-muted">Sectores del planeamiento (SIU)</div>
            {si.s.length > 0 && (
              <ul className="mt-2 divide-y divide-line text-sm">
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
            <div className="mt-2 text-xs text-muted">
              {si.n > si.s.length ? `Mostrando los ${si.s.length} mayores de ${fmt.format(si.n)} sectores con nombre. ` : si.n > 0 ? `${si.n} sectores con nombre. ` : ""}
              {si.r > 0 ? `Además, ${fmt.format(si.r)} fragmentos sin nombre (${fmt.format(si.rha)} ha). ` : ""}
              Son planes sobre el papel: el SIU no indica si el sector se ha urbanizado ni su calendario, ni cuántas viviendas prevé cada uno.
            </div>
          </div>
        ) : null}

        <details className="rounded-lg border border-edge">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-ink">Detalle de los {factors.length} indicadores</summary>
          <div className="space-y-3.5 border-t border-line p-3">
            <div className="text-xs font-semibold text-muted">Lo ya ocurrido</div>
            {factors
              .filter((f) => f.group === "past")
              .map((f) => (
                <Bar key={f.k} label={f.label} value={f.v} weight={detailWeight(f.w)} hint={f.hint} />
              ))}
            <div className="border-t border-line pt-3 text-xs font-semibold text-forest">Perspectivas de futuro</div>
            {factors
              .filter((f) => f.group === "future")
              .map((f) => (
                <Bar key={f.k} label={f.label} value={f.v} weight={detailWeight(f.w)} hint={f.hint} />
              ))}
            <p className="text-xs text-muted">Los pesos son nominales; si falta un indicador, el resto se reparte su peso. Cada barra es el percentil frente a los demás municipios.</p>
          </div>
        </details>
      </div>
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
  zone: number; // 0 = cualquiera; 40 = buena o media (valorada); 60 = solo buena (valorada)
  minRenta: number | null;
  maxPob: number | null;
  maxVt: number | null; // valor tasado máximo €/m²
  near: number | null; // km máximos a una ciudad de más de 100.000 hab.
  onlyUni: boolean;
  onlyProj: boolean;
  minScore: number;
  maxScore: number;
  minFut: number; // perspectivas de futuro mínimas (0 = sin mínimo)
};
const DEFAULTS: Filters = {
  q: "", ccaa: "", prov: "", minPop: 5000, maxPop: 0, minG5: null, minViv: null, minPend: null, minInv: null, zone: 0,
  minRenta: null, maxPob: null, maxVt: null, near: null, onlyUni: false, onlyProj: false, minScore: 0, maxScore: 100, minFut: 0,
};
// Secciones de filtros (chips de la barra superior): id, título y los campos que controlan (para contar y restablecer)
const SECTIONS: { id: string; label: string; title: string; keys: (keyof Filters)[] }[] = [
  { id: "ambito", label: "Ámbito", title: "Dónde buscar", keys: ["ccaa", "prov"] },
  { id: "tamano", label: "Tamaño", title: "Tamaño del municipio", keys: ["minPop", "maxPop"] },
  { id: "crec", label: "Crecimiento", title: "Crecimiento ya observado", keys: ["minG5", "minViv", "minScore", "maxScore", "minFut"] },
  { id: "plan", label: "Planeamiento", title: "Planeamiento y gasto público", keys: ["minPend", "minInv"] },
  { id: "zona", label: "Zona", title: "Calidad de la zona", keys: ["zone", "minRenta", "maxPob"] },
  { id: "precio", label: "Precio", title: "Precio de la vivienda", keys: ["maxVt"] },
  { id: "cerca", label: "Cercanía", title: "Cercanía a una ciudad grande", keys: ["near"] },
  { id: "extras", label: "Extras", title: "Extras", keys: ["onlyUni", "onlyProj"] },
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

function Chip({ label, count, open, onClick }: { label: string; count: number; open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium transition ${
        count > 0
          ? "border-gold bg-gold text-ink"
          : open
            ? "border-gold bg-white/10 text-white"
            : "border-white/25 bg-transparent text-paper/80 hover:border-white/50 hover:text-white"
      }`}
    >
      {label}
      {count > 0 && <span className="rounded-full bg-black/15 px-1.5 text-xs">{count}</span>}
    </button>
  );
}

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

export default function Explorer() {
  const [data, setData] = useState<Data | null>(null);
  const [f, setF] = useState<Filters>(DEFAULTS);
  const set = (p: Partial<Filters>) => setF((cur) => ({ ...cur, ...p }));
  const [open, setOpen] = useState<string | null>(null); // panel de filtros abierto
  const barRef = useRef<HTMLElement>(null);
  const [sel, setSel] = useState<Row | null>(null);
  const [sect, setSect] = useState<Record<string, SectInfo> | null>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    // Con reintentos y tiempo máximo: el servidor de desarrollo a veces tarda en servir el JSON tras regenerarlo.
    let cancelled = false;
    const load = (attempt: number) => {
      fetch("/municipios.json", { signal: AbortSignal.timeout(15000) })
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

  // El fichero de sectores (1,3 MB) solo se pide la primera vez que se abre una ficha
  useEffect(() => {
    if (!sel || sect) return;
    let cancelled = false;
    fetch("/sectores.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Record<string, SectInfo> | null) => !cancelled && d && setSect(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sel, sect]);

  // Comunidades y provincias disponibles (la lista de provincias se acota a la comunidad elegida)
  const places = useMemo(() => {
    const m = new Map<string, string>(); // provincia -> comunidad
    for (const r of data?.rows ?? []) m.set(r.prov, CCAA_BY_PROV[r.id.slice(0, 2)] ?? "");
    const ccaas = [...new Set(m.values())].filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
    const provs = [...m.entries()].map(([name, ccaa]) => ({ name, ccaa })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { ccaas, provs };
  }, [data]);

  // Al filtrar, un municipio SIN el dato que exige el filtro queda fuera: es preferible descartar a dar falsos positivos
  const filtered = useMemo(() => {
    if (!data) return [];
    const t = f.q.trim().toLowerCase();
    const out: (Row & { v: number })[] = [];
    for (const r of data.rows) {
      const v = r.score; // v = puntuación del índice de crecimiento (incluye las perspectivas de futuro)
      if (v === null || v < f.minScore || v > f.maxScore) continue;
      if (f.minFut > 0 && (r.fut === null || r.fut < f.minFut)) continue; // mínimo de perspectivas de futuro
      if (!(r.pop >= f.minPop || f.onlyProj)) continue; // con "proyectos previstos" se ignora el mínimo: hay proyectos en municipios pequeños
      if (f.maxPop && r.pop > f.maxPop) continue;
      if (f.ccaa && CCAA_BY_PROV[r.id.slice(0, 2)] !== f.ccaa) continue;
      if (f.prov && r.prov !== f.prov) continue;
      if (t && !r.n.toLowerCase().includes(t)) continue;
      if (f.onlyUni && !(r.uni > 0 || r.uniOsm >= 2)) continue;
      if (f.onlyProj && !(r.proj?.length ?? 0)) continue;
      if (f.zone > 0 && (r.zona === null || r.zona < f.zone)) continue;
      if (f.minG5 !== null && r.g5 < f.minG5) continue;
      if (f.minViv !== null && (r.vivPm === null || r.vivPm < f.minViv)) continue;
      if (f.minPend !== null && (r.pendK === null || r.pendK < f.minPend)) continue;
      if (f.minInv !== null && (r.inv === null || r.inv < f.minInv)) continue;
      if (f.minRenta !== null && (r.renta === null || r.renta < f.minRenta)) continue;
      if (f.maxPob !== null && (r.pob === null || r.pob > f.maxPob)) continue;
      if (f.maxVt !== null && (r.vt === null || r.vt > f.maxVt)) continue;
      if (f.near !== null && r.dc > f.near) continue;
      out.push({ ...r, v });
    }
    return out.sort((a, b) => b.v - a.v);
  }, [data, f]);

  // Cierra el panel de filtros al pulsar fuera de la barra o con Escape
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // Mapa
  useEffect(() => {
    if (!mapEl.current || map.current) return;
    const m = new maplibregl.Map({
      container: mapEl.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [-3.7, 40.2],
      zoom: 5.2,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
    m.on("load", () => {
      m.addSource(SRC, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "pts",
        type: "circle",
        source: SRC,
        layout: { "circle-sort-key": ["-", 100, ["get", "score"]] }, // mayor clave = encima: las burbujas pequeñas no quedan tapadas por las grandes
        paint: {
          // Tamaño proporcional a la puntuación (la del índice activo): crece con el cuadrado de score/80, así las diferencias se ven a simple vista
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
        if (id) setSel(rowsRef.current.find((r) => r.id === id) ?? null);
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
      ready.current = true;
      pushData();
    });
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = filtered;

  function pushData() {
    const m = map.current;
    if (!m || !ready.current) return;
    const src = m.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "FeatureCollection",
      features: rowsRef.current.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: { id: r.id, n: r.n, score: (r as Row & { v: number }).v, pop: r.pop },
      })),
    });
  }
  useEffect(pushData, [filtered]);

  function focus(r: Row) {
    setSel(r);
    map.current?.flyTo({ center: [r.lon, r.lat], zoom: 9, essential: true });
  }

  const hist = data?.negHist ?? false;
  const wNeg = hist ? 8 : 4;
  const hasUni = (r: Row) => r.uni > 0 || r.uniOsm >= 2;
  // Posición de cada municipio en los dos rankings (entre los de 1.000 hab. o más)
  const ranks = useMemo(() => {
    if (!data) return null;
    const el = data.rows.filter((r) => r.pop >= 1000);
    const g = el.filter((r) => r.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const f = el.filter((r) => r.fut !== null).sort((a, b) => (b.fut ?? 0) - (a.fut ?? 0));
    return { g: new Map(g.map((r, i) => [r.id, i + 1])), f: new Map(f.map((r, i) => [r.id, i + 1])), total: g.length };
  }, [data]);


  const activeCount = SECTIONS.reduce((n, sec) => n + sectionCount(f, sec.keys), 0);
  const reset = (keys: (keyof Filters)[]) => setF((cur) => ({ ...cur, ...Object.fromEntries(keys.map((k) => [k, DEFAULTS[k]])) }));
  const secOpen = SECTIONS.find((x) => x.id === open);
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
                El futuro ya cuenta un 26 % del índice; aquí puedes exigir además un mínimo propio (planeamiento, obra nueva y suelo de actividad).
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
          <Sel
            label="Distancia máxima a una ciudad de más de 100.000 hab."
            value={optNum(f.near)}
            onChange={(v) => set({ near: numOrNull(v) })}
            options={opts([15, 30, 50], (v) => `Menos de ${v} km`)}
            note="Distancia en línea recta al centro del municipio. Útil para zonas dormitorio."
          />
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

  const countBlock = (
          <div className="flex items-baseline gap-3 text-sm text-paper/70">
            <span>
              <b className="font-semibold text-white">{fmt.format(filtered.length)}</b> municipios
            </span>
            {activeCount > 0 && (
              <button className="font-semibold text-gold underline" onClick={() => setF({ ...DEFAULTS, q: f.q })}>
                Limpiar filtros ({activeCount})
              </button>
            )}
          </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <header ref={barRef} className="relative z-30 border-b border-black/40 bg-charcoal">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:px-5 lg:flex-nowrap">
          <h1 className="order-1 text-xl font-bold leading-none tracking-tight text-gold">Inmo Growth</h1>
          <input
            className="order-3 h-9 w-full rounded-md border border-transparent bg-white px-3 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none md:order-2 md:w-auto md:max-w-sm md:flex-1 lg:w-56 lg:flex-none"
            placeholder="Buscar municipio…"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
          />
          <div className="order-2 ml-auto shrink-0 md:order-3 lg:order-4 lg:ml-0">{countBlock}</div>
          <div className="order-4 flex w-full gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-3 lg:w-auto lg:min-w-0 lg:flex-1">
            {SECTIONS.map((sec) => (
              <Chip key={sec.id} label={sec.label} count={sectionCount(f, sec.keys)} open={open === sec.id} onClick={() => setOpen(open === sec.id ? null : sec.id)} />
            ))}
          </div>
        </div>

        {secOpen && (
          <div className="absolute inset-x-0 top-full z-40 max-h-[70vh] overflow-y-auto border-b border-edge bg-white p-4 shadow-lg md:inset-x-auto md:left-5 md:w-[580px] md:rounded-b-lg md:border md:border-t-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">{secOpen.title}</h2>
              <div className="flex gap-4 text-sm font-semibold">
                {sectionCount(f, secOpen.keys) > 0 && (
                  <button className="text-forest underline" onClick={() => reset(secOpen.keys)}>
                    Restablecer
                  </button>
                )}
                <button className="text-muted hover:text-ink" onClick={() => setOpen(null)}>
                  Cerrar
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{panelBody(secOpen.id)}</div>
            <p className="mt-3 text-xs text-muted">Los municipios sin el dato que pide un filtro quedan fuera: preferimos descartar a dar falsos positivos.</p>
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="order-2 flex h-[62%] w-full flex-col overflow-y-auto border-t border-edge bg-paper md:order-1 md:h-auto md:w-[420px] md:min-w-[420px] md:overflow-visible md:border-r md:border-t-0">
          {sel && (
            <Detail
              sel={sel}
              data={data}
              sect={sect}
              rankG={ranks?.g.get(sel.id)}
              rankF={ranks?.f.get(sel.id)}
              total={ranks?.total ?? 0}
              hist={hist}
              onBack={() => setSel(null)}
              onMap={() => map.current?.flyTo({ center: [sel.lon, sel.lat], zoom: 9, essential: true })}
            />
          )}

          {!sel && (
            <>
              <div className="flex items-baseline justify-between border-b border-line px-4 py-2 text-xs text-muted">
                <span>
                  Ordenados por <b className="text-ink">índice de crecimiento</b>
                </span>
                <span>Se muestran los 300 primeros</span>
              </div>
              {!data && <div className="p-6 text-center text-base text-muted">Cargando datos de 8.131 municipios…</div>}
              {data && filtered.length === 0 && <div className="p-6 text-center text-base text-muted">Ningún municipio cumple los filtros.</div>}
              <ol className="divide-y divide-line bg-white/60 md:flex-1 md:overflow-y-auto">
                {filtered.slice(0, 300).map((r, i) => (
                  <li key={r.id}>
                    <button onClick={() => focus(r)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-tint">
                      <span className="w-6 text-right text-xs tabular-nums text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-semibold leading-snug">{r.n}</span>
                          {r.zona !== null && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: zoneDot(r.zona) }}
                              title={`${zoneShort(r.zona)} (seguridad, renta y pobreza)`}
                            />
                          )}
                        </span>
                        <span className="block truncate text-[13px] text-muted">
                          {r.prov} · {fmt.format(r.pop)} hab. · {sgn(r.g5)}%{hasUni(r) ? " · Universidad" : ""}
                          {r.proj ? " · Proyecto" : ""}
                        </span>
                      </span>
                      <Badge v={r.v} />
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}

        <details className="border-t border-line bg-paper text-sm">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">¿Cómo se calcula el índice?</summary>
          <div className="space-y-2 px-4 pb-4 text-muted">
            <p>Puntuación 0-100 como media ponderada de percentiles entre municipios de 1.000 hab. o más. Si falta un indicador se reponderan los demás.</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>39 % población</b>: crecimiento total, último año y personas ganadas (INE).
              </li>
              <li>
                <b>14 % inversión pública</b> por habitante: capítulo 6, media 2019/2024 (Hacienda).
              </li>
              <li>
                <b>13 % universidad</b>: tamaño del campus (Wikidata y OpenStreetMap).
              </li>
              <li>
                <b>{wNeg} % {hist ? "negocios nuevos" : "comercios"}</b>: supermercados y gimnasios por habitante
                {hist ? ", nov-2020 frente a hoy" : ", estado actual"} (OpenStreetMap).
              </li>
              <li>
                <b>26 % futuro</b>: 12 % vivienda prevista en el planeamiento y 5 % suelo para actividad económica (SIU del Ministerio de Vivienda) y 9 % obra nueva de los últimos 5 años (Catastro).
              </li>
            </ul>
            <p>
              Las <b>perspectivas de futuro</b> (planeamiento y obra nueva) ya forman parte del
              índice: pesan un 26 %. En el filtro &quot;Crecimiento&quot; puedes exigir además un mínimo de futuro.
            </p>
            <p className="text-xs text-muted">
              <b>Planeamiento (SIU):</b> son viviendas previstas y aún no construidas en áreas de desarrollo urbanístico, según el planeamiento vigente
              que aportan las comunidades autónomas (cubre 5.898 municipios; fechas de 2020 a 2025). Son planes sobre el papel: muchos son
              antiguos, del boom inmobiliario, y no se llegarán a construir. La escala satura en torno a 2.000 viviendas pendientes por cada 1.000
              habitantes y la ficha avisa cuando el plan supera 3 por habitante. Los 15 proyectos marcados con 🏗️ son una lista curada a mano a
              partir de prensa, con su fuente: no es exhaustiva, por eso no entra en el índice (solo se muestra en la ficha). El Catastro no cubre País Vasco ni Navarra.
            </p>
            <p className="text-xs text-muted">
              <b>Calidad de la zona</b> (buena ≥60, media 40–60, por debajo de la media &lt;40): seguridad (Interior, solo capitales y municipios de más de 20.000
              hab.), renta y pobreza (INE) y okupación (Interior, solo provincial). Solo se valora si hay seguridad municipal; el resto aparece como
              &quot;Zona sin valorar&quot; (preferimos no valorar a dar por buena una zona sin evidencia). Se muestra aparte y no entra en el índice de crecimiento; el
              filtro &quot;Solo zonas valoradas buenas o medias&quot; deja fuera lo que está por debajo de 40 y lo no valorado. Los umbrales son orientativos.
            </p>
            <p className="text-xs text-muted">
              Los puntos de OpenStreetMap se asignan al municipio más cercano (aproximación) y su mapeo mejora con los años. No es asesoramiento financiero.
            </p>
          </div>
        </details>
        </aside>

      <main className="relative order-1 h-[38%] flex-none md:order-2 md:h-auto md:flex-1">
        <div ref={mapEl} style={{ position: "absolute", inset: 0 }} />
        <div className="absolute left-3 top-3 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-line md:bottom-6 md:left-4 md:top-auto md:px-4 md:py-3">
          <div className="mb-1.5 text-sm font-semibold text-ink">Índice de crecimiento</div>
          <div className="h-3 w-36 rounded-full md:w-52" style={{ background: LEGEND_GRADIENT }} />
          <div className="mt-1 flex justify-between text-xs font-medium text-muted">
            <span>0 · bajo</span>
            <span>100 · alto</span>
          </div>
          <div className="mt-1 hidden text-xs text-muted md:block">Tamaño y color del punto = puntuación</div>
        </div>
      </main>
      </div>
    </div>
  );
}
