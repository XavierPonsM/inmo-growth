// Informe de la zona bajo demanda: Claude busca en la web noticias recientes del municipio (okupación, seguridad, proyectos)
// y las resume con sus fuentes. Complementa lo que los datos públicos no cubren a escala municipal.
// Necesita ANTHROPIC_API_KEY en .env.local. Cada informe se guarda 30 días en .cache/informes para no repetir el gasto.
import Anthropic from "@anthropic-ai/sdk";
import { promises as fs } from "node:fs";
import path from "node:path";

export const maxDuration = 300;

type Muni = {
  id: string; n: string; prov: string; pop: number; score: number | null; zona: number | null; okR: number | null;
  vt: number | null; renta: number | null; uniNear: string | null; uniKm: number | null; dc: number; cn: string; vac: number | null; ocup: number | null; crim: number | null; g5: number; pendK: number | null; paro: number | null;
};
const VERSION = 3; // cambia al cambiar el formato del informe: invalida la caché anterior
type Informe = { v?: number; id: string; fecha: string; texto: string; fuentes: { url: string; titulo: string }[]; modelo: string; uso?: { entrada: number; salida: number; busquedas: number } };

const MODEL = process.env.INFORME_MODEL ?? "claude-haiku-5-5";
// En un alojamiento sin disco propio (Vercel y similares) solo se puede escribir en la carpeta temporal
const CACHE_DIR = process.env.VERCEL ? path.join("/tmp", "informes") : path.join(process.cwd(), ".cache", "informes");

// ---- Protección del gasto al publicar la app (los informes ya guardados en caché no cuentan ni se bloquean) ----
// INFORME_OFF=1            desactiva la generación.
// INFORME_CLAVE=...        exige esa clave (la app la pide una vez y la recuerda en el navegador).
// INFORME_MAX_DIA=3        informes nuevos por visitante y día.  INFORME_MAX_TOTAL=40  informes nuevos al día entre todos.
// Los contadores viven en memoria: en un alojamiento sin servidor se reinician a menudo, así que son un freno, no una garantía.
// La garantía es el límite de gasto mensual de la consola de Anthropic.
const MAX_DIA = Number(process.env.INFORME_MAX_DIA ?? 3);
const MAX_TOTAL = Number(process.env.INFORME_MAX_TOTAL ?? 40);
const usos = { dia: "", total: 0, porIp: new Map<string, number>() };
function gastar(ip: string): string | null {
  const hoy = new Date().toISOString().slice(0, 10);
  if (usos.dia !== hoy) {
    usos.dia = hoy;
    usos.total = 0;
    usos.porIp.clear();
  }
  if (usos.total >= MAX_TOTAL) return "Se ha alcanzado el máximo de informes de hoy. Vuelve mañana.";
  const n = usos.porIp.get(ip) ?? 0;
  if (n >= MAX_DIA) return `Has generado ${MAX_DIA} informes hoy, que es el máximo. Vuelve mañana.`;
  usos.total++;
  usos.porIp.set(ip, n + 1);
  return null;
}
const TTL_MS = 30 * 24 * 3600 * 1000;
let munis: Map<string, Muni> | null = null;

async function loadMunis(origin: string) {
  if (!munis) {
    // en un despliegue sin servidor la carpeta public puede no estar en el disco de la función: entonces se pide por HTTP
    const raw = await fs
      .readFile(path.join(process.cwd(), "public", "municipios.json"), "utf-8")
      .then((t) => JSON.parse(t))
      .catch(async () => (await fetch(`${origin}/municipios.json`)).json());
    munis = new Map((raw.rows as Muni[]).map((r) => [r.id, r]));
  }
  return munis;
}

const SYSTEM = `Ayudas a un inversor particular que no vive en el municipio a decidir si compra allí una vivienda para alquilarla.
La aplicación ya le muestra las estadísticas oficiales; tú le das, muy resumido, lo que solo está en portales inmobiliarios y prensa local.

Busca en la web y escribe un resumen MUY breve (80 palabras como máximo en total), en español, texto plano, con exactamente estos
encabezados en líneas que empiecen por "## ", y debajo líneas que empiecen por "- ":
## Comprar
- una línea: precio medio de venta (€/m² o precio típico), con fuente y mes.
## Alquilar
- una línea: alquiler típico (€/mes o €/m²) y rentabilidad bruta estimada por ti (alquiler anual entre precio); di que es estimada.
## A tener en cuenta
- dos o tres líneas cortas: zonas a buscar o evitar, okupación o seguridad, proyectos que cambien la demanda. Solo lo que encuentres.
## Fuentes
- una línea por página usada, con la forma "- título | URL", copiando la URL tal cual apareció en los resultados.

Si no encuentras un dato, escribe "Sin datos fiables" en esa línea. Redacta cada línea con tus palabras y una sola vez: no copies\nfrases, tablas ni fragmentos de las páginas (nada con "|" salvo en Fuentes). No des recomendación de compra.
Tienes pocas búsquedas: empieza por los precios de venta y alquiler.`;

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const m = id ? (await loadMunis(new URL(req.url).origin)).get(id) : undefined;
  if (!m) return Response.json({ error: "Municipio desconocido" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "Falta ANTHROPIC_API_KEY en .env.local (reinicia el servidor después de añadirla)." }, { status: 503 });
  }

  const file = path.join(CACHE_DIR, `${m.id}.json`);
  try {
    const cached = JSON.parse(await fs.readFile(file, "utf-8")) as Informe;
    if (cached.v === VERSION && Date.now() - new Date(cached.fecha).getTime() < TTL_MS) return Response.json({ ...cached, cache: true });
  } catch {
    // sin caché: se genera
  }

  if (process.env.INFORME_OFF === "1") return Response.json({ error: "Los informes con IA están desactivados en esta versión." }, { status: 403 });
  const clave = process.env.INFORME_CLAVE;
  if (clave && req.headers.get("x-informe-clave") !== clave) {
    return Response.json({ error: "Este informe necesita una clave de acceso.", clave: true }, { status: 401 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const tope = process.env.NODE_ENV === "production" ? gastar(ip) : null; // en tu ordenador, sin límite
  if (tope) return Response.json({ error: tope }, { status: 429 });


  const datos = [
    `Municipio: ${m.n} (${m.prov}), ${m.pop} habitantes.`,
    `Estadísticas que el inversor ya ve: población ${m.g5 >= 0 ? "+" : ""}${m.g5}% en 5 años`,
    m.paro !== null ? `paro registrado ${m.paro}% de la población de 18 a 64 años` : null,
    m.vac !== null ? `${m.vac}% de vivienda vacía (Censo 2021)` : null,
    m.ocup !== null ? `${m.ocup} denuncias de allanamiento/usurpación por 10.000 hab. en su provincia` : null,
    m.crim !== null ? `${m.crim} hechos delictivos por 1.000 hab.` : "sin dato municipal de criminalidad",
    m.pendK !== null ? `${m.pendK} viviendas previstas en el planeamiento por 1.000 hab.` : null,
    m.vt !== null ? `valor tasado medio ${m.vt} €/m² (Ministerio)` : null,
    m.renta !== null ? `renta neta ${m.renta} € por persona` : null,
    m.uniNear ? `universidad más cercana: ${m.uniNear} a ${m.uniKm} km` : null,
    m.dc > 0 ? `a ${m.dc} km de ${m.cn}` : null,
  ]
    .filter(Boolean)
    .join("; ");

  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `${datos}.\n\nPrepara el informe de este municipio.` }];
  try {
    let msg: Anthropic.Message;
    // Una búsqueda larga puede pausar el turno (pause_turn): se reenvía tal cual para que el servidor continúe.
    for (let i = 0; ; i++) {
      // Haiku 5.5 por coste (unas 40 veces más barato por token que Opus 5.5). Usa la búsqueda web básica, que es la que admite.
      msg = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 12000,
          output_config: { effort: "medium" },
          system: SYSTEM,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "ES" } }],
          messages,
        })
        .finalMessage();
      if (msg.stop_reason !== "pause_turn" || i >= 3) break;
      messages.push({ role: "assistant", content: msg.content as Anthropic.ContentBlockParam[] });
    }
    if (msg.stop_reason === "refusal") return Response.json({ error: "El modelo no ha querido generar este informe." }, { status: 502 });

    let texto = "";
    const fuentes = new Map<string, string>();
    const vistos = new Set<string>(); // URLs que de verdad devolvió el buscador
    for (const block of msg.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result") vistos.add(r.url);
      }
      if (block.type !== "text") continue;
      texto += block.text;
      for (const c of block.citations ?? []) {
        if (c.type === "web_search_result_location" && c.url) fuentes.set(c.url, c.title ?? c.url);
      }
    }
    // el informe empieza en el primer encabezado: se descarta cualquier frase previa a las búsquedas
    const start = texto.indexOf("## ");
    texto = (start >= 0 ? texto.slice(start) : texto).trim();
    // la sección "Fuentes" se separa del texto; solo se aceptan URLs que aparecieron en los resultados (si se pueden comprobar)
    const cut = texto.indexOf("## Fuentes");
    if (cut >= 0) {
      for (const line of texto.slice(cut).split("\n").slice(1)) {
        const mm = line.match(/^-\s*(.*?)\s*\|\s*(https?:\/\/\S+)/);
        if (mm && (vistos.size === 0 || vistos.has(mm[2]))) fuentes.set(mm[2], mm[1] || mm[2]);
      }
      texto = texto.slice(0, cut).trim();
    }
    // Limpieza: a veces el modelo pega trozos de tablas de los portales ("| 2.902 €/m² | 0,0 % |"); se corta la línea en el primer "|"
    texto = texto
      .split("\n")
      .map((l) => (l.startsWith("- ") && l.includes(" | ") ? l.slice(0, l.indexOf(" | ")).trimEnd() + "." : l))
      .join("\n");
    if (!texto) return Response.json({ error: "El informe ha llegado vacío; inténtalo de nuevo." }, { status: 502 });

    const informe: Informe = {
      v: VERSION,
      id: m.id,
      fecha: new Date().toISOString(),
      texto,
      fuentes: [...fuentes].slice(0, 14).map(([url, titulo]) => ({ url, titulo })),
      modelo: msg.model,
      uso: { entrada: msg.usage.input_tokens, salida: msg.usage.output_tokens, busquedas: msg.usage.server_tool_use?.web_search_requests ?? 0 },
    };
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(file, JSON.stringify(informe));
    } catch {
      // disco de solo lectura (despliegue sin sistema de archivos): se sirve sin guardar
    }
    return Response.json(informe);
  } catch (e) {
    console.error("[informe]", m.id, e instanceof Error ? `${e.name}: ${e.message}` : e);
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "La clave de la API no es válida." }, { status: 502 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Límite de peticiones alcanzado; espera un minuto." }, { status: 429 });
    if (e instanceof Anthropic.APIError && /credit balance/i.test(e.message)) {
      return Response.json({ error: "La cuenta de la API de Anthropic no tiene saldo: añade crédito en Plans & Billing de la consola." }, { status: 402 });
    }
    if (e instanceof Anthropic.APIError) return Response.json({ error: `Error de la API (${e.status ?? "red"}): ${e.message.slice(0, 300)}` }, { status: 502 });
    throw e;
  }
}
