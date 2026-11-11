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
const VERSION = 2; // cambia al cambiar el formato del informe: invalida la caché anterior
type Informe = { v?: number; id: string; fecha: string; texto: string; fuentes: { url: string; titulo: string }[]; modelo: string; uso?: { entrada: number; salida: number; busquedas: number } };

const MODEL = process.env.INFORME_MODEL ?? "claude-haiku-5-5";
const CACHE_DIR = path.join(process.cwd(), ".cache", "informes");
const TTL_MS = 30 * 24 * 3600 * 1000;
let munis: Map<string, Muni> | null = null;

async function loadMunis() {
  if (!munis) {
    const raw = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "municipios.json"), "utf-8"));
    munis = new Map((raw.rows as Muni[]).map((r) => [r.id, r]));
  }
  return munis;
}

const SYSTEM = `Ayudas a un inversor inmobiliario particular a valorar un municipio de España para comprar una vivienda y alquilarla.
No vive allí y quiere poder decidir sin desplazarse, así que este informe sustituye a la visita: debe salir de él sabiendo cuánto cuesta
comprar, por cuánto se alquila, quién alquila, qué zonas del municipio conviene buscar o evitar y qué está cambiando.

La aplicación ya le muestra estadísticas oficiales (padrón, Catastro, SEPE, Interior), y se te pasan las principales. Tú aportas lo que
no está ahí: precios actuales de venta y de alquiler según los portales e informes inmobiliarios, y lo que cuenta la prensa local y el
ayuntamiento sobre barrios y urbanizaciones concretos, okupación, seguridad, proyectos, transporte y servicios.

Busca en la web y resume solo lo que encuentres en fuentes concretas, de los dos últimos años salvo que no haya nada más reciente.
El inversor va a mover dinero con esto: da cifras con su fuente y su fecha, nombra barrios y urbanizaciones cuando la fuente lo haga, y
cuando no encuentres algo dilo en una línea ("no he encontrado datos de alquiler de este municipio") en lugar de rellenar con
generalidades o con cifras de la provincia sin avisar. Redacta cada dato una sola vez y con tus palabras, en español: no pegues detrás la frase literal de la fuente. Si das la rentabilidad bruta, calcúlala tú con el alquiler y el precio que hayas
encontrado (alquiler anual entre precio de compra) y di que es una estimación. Tienes un número limitado de búsquedas: empieza por los
precios de venta y alquiler y reparte el resto entre los demás temas.

Formato: texto plano en español, sin tablas ni negritas, unas 350 palabras como máximo. Usa exactamente estos encabezados, cada uno en
su línea y precedido de "## ", con una a cuatro líneas debajo que empiecen por "- ":
## Precios de compra
## Alquiler y rentabilidad
## Quién alquila y qué se busca
## Zonas: dónde sí y dónde no
## Okupación y seguridad
## Proyectos, empleo y transporte
## En resumen
## Fuentes
"En resumen" son dos líneas: qué pesa más a favor y en contra, y qué le quedaría por comprobar a distancia (y cómo: a quién llamar o
qué pedir). No des una recomendación de compra. Bajo "Fuentes", una línea por cada página de la que hayas sacado algo, con la forma
"- título | URL", copiando la URL tal cual apareció en los resultados de búsqueda.`;

export async function POST(req: Request) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const m = id ? (await loadMunis()).get(id) : undefined;
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
          max_tokens: 20000,
          output_config: { effort: "medium" },
          system: SYSTEM,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10, user_location: { type: "approximate", country: "ES" } }],
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
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "La clave de la API no es válida." }, { status: 401 });
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "Límite de peticiones alcanzado; espera un minuto." }, { status: 429 });
    if (e instanceof Anthropic.APIError && /credit balance/i.test(e.message)) {
      return Response.json({ error: "La cuenta de la API de Anthropic no tiene saldo: añade crédito en Plans & Billing de la consola." }, { status: 402 });
    }
    if (e instanceof Anthropic.APIError) return Response.json({ error: `Error de la API (${e.status ?? "red"}): ${e.message.slice(0, 300)}` }, { status: 502 });
    throw e;
  }
}
