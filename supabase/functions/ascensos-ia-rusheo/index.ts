// =====================================================================
//  PROYECTN · Función de Supabase "ascensos-ia-rusheo" (solo Ascensos Rusheo)
//  Independiente de ascensos-ia (Ascensos LATAM/AZA).
//  Usa sus propias claves API separadas:
//    ANTHROPIC_API_KEY_RUSHEO  → Claude
//    GEMINI_API_KEY_RUSHEO     → Gemini  (GEMINI_MODELO_RUSHEO opcional)
//    IA_PRIVADA_URL_RUSHEO     → Motor privado (compatible OpenAI)
//    IA_PRIVADA_MODELO_RUSHEO
//    IA_PRIVADA_KEY_RUSHEO     (opcional)
//    IA_PRIVADA_NOMBRE_RUSHEO  (opcional)
//
//  Portal permitido: ascensosrusheo
//  Las claves NUNCA llegan al navegador.
// =====================================================================
import Anthropic from "npm:@anthropic-ai/sdk";

const MAX_IMAGENES = 8;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const env = (k: string) => (Deno.env.get(k) || "").trim();
const VERSION = "2026-10-22a";
const MODELO_GEMINI = () => env("GEMINI_MODELO_RUSHEO") || "gemini-3.8-flash";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });

class ErrorIA extends Error {
  constructor(mensaje: string, public estado = 502) { super(mensaje); }
}

// Prompt modo "solo top": no pide kills (ahorra tokens de entrada y salida)
const SISTEMA_TOP = `Lees capturas de Free Fire (salas de ascensos). Devuelve la posición final (top) de cada equipo en cada partida.
SLOTS: alineación (número de escuadra, nombre/tag del equipo, jugadores).
RESULTADOS: capturas en orden; muestran el puesto final por escuadra.
- Cruza el número de escuadra con los tags de jugadores para identificar equipos.
- Si recibes "Slot N: NOMBRE - TAG", usa esos nombres exactos.
- No inventes; lo dudoso va en "avisos" (español, una línea por problema).
Responde SOLO con JSON válido.`;

// Prompt modo "top + kills": extrae posición y kills
const SISTEMA_KILL = `Lees capturas de Free Fire (salas de ascensos). Devuelve la posición y kills de cada equipo en cada partida.
SLOTS: alineación (número de escuadra, nombre/tag del equipo, jugadores).
RESULTADOS: capturas en orden; muestran el puesto final y kills por escuadra.
- Cruza el número de escuadra con los tags de jugadores para identificar equipos.
- Si recibes "Slot N: NOMBRE - TAG", usa esos nombres exactos.
- No inventes; lo dudoso va en "avisos" (español, una línea por problema).
Responde SOLO con JSON válido.`;

const getSistema = (modo?: string) => modo === 'top' ? SISTEMA_TOP : SISTEMA_KILL;

const ESQUEMA = {
  type: "object",
  properties: {
    equipos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          tag: { type: "string" },
          jugadores: { type: "array", items: { type: "string" } },
          partidas: {
            type: "array",
            items: {
              type: "object",
              properties: { partida: { type: "integer" }, top: { type: "integer" }, kills: { type: "integer" } },
              required: ["partida", "top", "kills"],
              additionalProperties: false,
            },
          },
        },
        required: ["nombre", "tag", "jugadores", "partidas"],
        additionalProperties: false,
      },
    },
    partidas_detectadas: { type: "integer" },
    avisos: { type: "array", items: { type: "string" } },
  },
  required: ["equipos", "partidas_detectadas", "avisos"],
  additionalProperties: false,
};

const ESQUEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    equipos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          nombre: { type: "STRING" },
          tag: { type: "STRING" },
          jugadores: { type: "ARRAY", items: { type: "STRING" } },
          partidas: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { partida: { type: "INTEGER" }, top: { type: "INTEGER" }, kills: { type: "INTEGER" } },
              required: ["partida", "top", "kills"],
            },
          },
        },
        required: ["nombre", "tag", "jugadores", "partidas"],
      },
    },
    partidas_detectadas: { type: "INTEGER" },
    avisos: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["equipos", "partidas_detectadas", "avisos"],
};

type Imagen = { media_type: string; data: string };
type Pedido = { slots: Imagen[]; resultados: Imagen[]; conocidos: string[]; modo: string };
type Lectura = { datos: unknown; modelo: string };

function piezas(p: Pedido): Array<{ texto: string } | { imagen: Imagen }> {
  const l: Array<{ texto: string } | { imagen: Imagen }> = [];
  if (p.slots.length) {
    l.push({ texto: `SLOTS (alineación de la sala): ${p.slots.length} captura(s).` });
    p.slots.forEach((imagen) => l.push({ imagen }));
  }
  l.push({ texto: `RESULTADOS: ${p.resultados.length} captura(s), en el orden en que se jugaron las partidas.` });
  p.resultados.forEach((imagen, i) => { l.push({ texto: `Captura de resultados ${i + 1}:` }); l.push({ imagen }); });
  l.push({
    texto: (p.conocidos.length ? `Equipos de la sala (${p.conocidos.length}):\n${p.conocidos.join("\n")}\n\n` : "") +
      "Devuelve los equipos con su top y kills en cada partida.",
  });
  return l;
}

function leerJson(texto: string) {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const i = limpio.indexOf("{"), j = limpio.lastIndexOf("}");
  try {
    return JSON.parse(i >= 0 && j > i ? limpio.slice(i, j + 1) : limpio);
  } catch {
    throw new ErrorIA("La IA no devolvió un JSON válido. Intenta de nuevo o usa otro motor.");
  }
}

function normalizar(d: any) {
  const ent = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const equipos = (Array.isArray(d?.equipos) ? d.equipos : []).map((e: any) => ({
    nombre: String(e?.nombre ?? "").trim(),
    tag: String(e?.tag ?? "").trim(),
    jugadores: (Array.isArray(e?.jugadores) ? e.jugadores : []).map((x: unknown) => String(x)),
    partidas: (Array.isArray(e?.partidas) ? e.partidas : [])
      .map((p: any) => ({ partida: ent(p?.partida), top: ent(p?.top), kills: ent(p?.kills) }))
      .filter((p: { partida: number }) => p.partida >= 1),
  })).filter((e: { nombre: string }) => e.nombre);
  const maxPartida = Math.max(0, ...equipos.flatMap((e: any) => e.partidas.map((p: any) => p.partida)));
  return {
    equipos,
    partidas_detectadas: Math.max(ent(d?.partidas_detectadas), maxPartida),
    avisos: (Array.isArray(d?.avisos) ? d.avisos : []).map((x: unknown) => String(x)).filter(Boolean),
  };
}

// ---------------------------------------------------------------- Motores (claves específicas de Rusheo)
const MOTORES: Record<string, { nombre: string; listo: () => boolean; leer: (p: Pedido) => Promise<Lectura> }> = {
  gemini: {
    nombre: "Gemini",
    listo: () => !!env("GEMINI_API_KEY_RUSHEO"),
    leer: async (p) => {
      const parts = piezas(p).map((x) => "texto" in x ? { text: x.texto } : { inline_data: { mime_type: x.imagen.media_type, data: x.imagen.data } });
      const pedir = (modelo: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY_RUSHEO") },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: getSistema(p.modo) }] },
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: ESQUEMA_GEMINI },
        }),
      });
      let modelo = MODELO_GEMINI();
      const saturado = (st: number, m: string) => st === 503 || st === 500 || /high demand|overloaded|unavailable|try again later/i.test(m);
      const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
      let r = await pedir(modelo);
      let j = await r.json().catch(() => ({}));
      for (const ms of [2500, 6000]) {
        if (r.ok || !saturado(r.status, j?.error?.message || "")) break;
        await esperar(ms);
        r = await pedir(modelo);
        j = await r.json().catch(() => ({}));
      }
      const respaldo = env("GEMINI_MODELO_RESPALDO_RUSHEO");
      if (!r.ok && respaldo && respaldo !== modelo && saturado(r.status, j?.error?.message || "")) {
        modelo = respaldo;
        r = await pedir(modelo);
        j = await r.json().catch(() => ({}));
      }
      const sugerido = !r.ok && /no longer available|not found|deprecated|is not supported/i.test(j?.error?.message || "")
        ? (/models\/(gemini-[\w.-]+)/.exec(String(j.error.message).split(/use|usar/i).slice(1).join(" ")) || [])[1] : null;
      if (sugerido && sugerido !== modelo) {
        modelo = sugerido;
        r = await pedir(modelo);
        j = await r.json().catch(() => ({}));
      }
      if (!r.ok) {
        const msg = j?.error?.message || `HTTP ${r.status}`;
        if (saturado(r.status, msg)) throw new ErrorIA(`Gemini (${modelo}) está saturado en este momento. Intenta en unos minutos.`, 503);
        throw new ErrorIA(r.status === 429 ? "Gemini está ocupado o llegaste a tu cuota. Intenta en un minuto." :
          r.status === 400 && /API key/i.test(msg) ? "La clave GEMINI_API_KEY_RUSHEO no es válida" :
          `Error de Gemini (${modelo}): ${msg}`, r.status === 429 ? 429 : 502);
      }
      const cand = j?.candidates?.[0];
      if (!cand || cand.finishReason === "SAFETY" || j?.promptFeedback?.blockReason) {
        throw new ErrorIA("Gemini no pudo procesar estas capturas. Revisa que sean de resultados del juego.", 422);
      }
      if (cand.finishReason === "MAX_TOKENS") throw new ErrorIA("Demasiadas capturas para una sola lectura. Prueba con menos.", 422);
      const texto = (cand.content?.parts || []).map((x: { text?: string }) => x.text || "").join("");
      return { datos: leerJson(texto), modelo };
    },
  },

  privado: {
    nombre: env("IA_PRIVADA_NOMBRE_RUSHEO") || "Motor privado",
    listo: () => !!env("IA_PRIVADA_URL_RUSHEO") && !!env("IA_PRIVADA_MODELO_RUSHEO"),
    leer: async (p) => {
      const base = env("IA_PRIVADA_URL_RUSHEO").replace(/\/+$/, "");
      const url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";
      const content = piezas(p).map((x) => "texto" in x ? { type: "text", text: x.texto }
        : { type: "image_url", image_url: { url: `data:${x.imagen.media_type};base64,${x.imagen.data}` } });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (env("IA_PRIVADA_KEY_RUSHEO")) headers.Authorization = `Bearer ${env("IA_PRIVADA_KEY_RUSHEO")}`;
      const pedir = (formato: unknown) => fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: env("IA_PRIVADA_MODELO_RUSHEO"),
          temperature: 0,
          messages: [{ role: "system", content: getSistema(p.modo) }, { role: "user", content }],
          ...(formato ? { response_format: formato } : {}),
        }),
      });
      let r = await pedir({ type: "json_schema", json_schema: { name: "resultados", strict: true, schema: ESQUEMA } });
      if (r.status === 400 || r.status === 422) r = await pedir({ type: "json_object" });
      if (r.status === 400 || r.status === 422) r = await pedir(null);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = j?.error?.message || j?.detail || `HTTP ${r.status}`;
        throw new ErrorIA(r.status === 401 || r.status === 403 ? "El motor privado rechazó la clave (IA_PRIVADA_KEY_RUSHEO)" : "Error del motor privado: " + msg, r.status === 429 ? 429 : 502);
      }
      const texto = j?.choices?.[0]?.message?.content;
      if (!texto) throw new ErrorIA("El motor privado no devolvió resultados");
      return { datos: leerJson(Array.isArray(texto) ? texto.map((x: { text?: string }) => x.text || "").join("") : String(texto)), modelo: j.model || env("IA_PRIVADA_MODELO_RUSHEO") };
    },
  },

  claude: {
    nombre: "Claude",
    listo: () => !!env("ANTHROPIC_API_KEY_RUSHEO"),
    leer: async (p) => {
      const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY_RUSHEO") });
      const contenido: Anthropic.MessageParam["content"] = piezas(p).map((x) => "texto" in x
        ? { type: "text" as const, text: x.texto }
        : { type: "image" as const, source: { type: "base64" as const, media_type: x.imagen.media_type as "image/png", data: x.imagen.data } });
      try {
        const respuesta = await client.messages.create({
          model: "claude-haiku-5-5",
          max_tokens: 4096,
          system: getSistema(p.modo),
          messages: [{ role: "user", content: contenido }],
        });
        if (respuesta.stop_reason === "max_tokens") throw new ErrorIA("Demasiadas capturas para una sola lectura. Prueba con menos.", 422);
        const texto = respuesta.content.find((b) => b.type === "text");
        if (!texto || texto.type !== "text") throw new ErrorIA("Claude no devolvió resultados");
        return { datos: leerJson(texto.text), modelo: respuesta.model };
      } catch (err) {
        if (err instanceof ErrorIA) throw err;
        if (err instanceof Anthropic.RateLimitError) throw new ErrorIA("Claude está ocupado. Intenta en un minuto.", 429);
        if (err instanceof Anthropic.AuthenticationError) throw new ErrorIA("La clave ANTHROPIC_API_KEY_RUSHEO no es válida", 500);
        if (err instanceof Anthropic.APIError) throw new ErrorIA("Error de Claude: " + err.message);
        throw err;
      }
    },
  },
};

async function configMotores(): Promise<{ activos: string[] | null; defecto: string | null }> {
  try {
    const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/sitio_config?clave=eq.ia_motores_rusheo&select=valor`, {
      headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${env("SUPABASE_ANON_KEY")}` },
    });
    const f = r.ok ? await r.json() : [];
    const v = f?.[0]?.valor;
    return { activos: Array.isArray(v?.activos) ? v.activos : null, defecto: v?.defecto ?? null };
  } catch {
    return { activos: null, defecto: null };
  }
}

async function estadoMotores() {
  const cfg = await configMotores();
  const motores = Object.entries(MOTORES).map(([id, m]) => ({
    id, nombre: m.nombre, configurado: m.listo(), activo: m.listo() && (cfg.activos ? cfg.activos.includes(id) : true),
  }));
  const usables = motores.filter((m) => m.activo);
  const defecto = usables.find((m) => m.id === cfg.defecto)?.id ?? usables.find((m) => m.id === env("IA_MOTOR_DEFECTO_RUSHEO"))?.id ?? usables[0]?.id ?? null;
  return { motores, usables, defecto };
}

// ---------------------------------------------------------------- Servidor
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  let cuerpo: { accion?: string; motor?: string; token?: string; portal?: string; slots?: Imagen[]; resultados?: Imagen[]; equipos?: string[]; modo?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "Datos inválidos" }, 400);
  }

  if (cuerpo.accion === "motores") {
    const { motores, usables, defecto } = await estadoMotores();
    return responder({ motores: usables.map(({ id, nombre }) => ({ id, nombre })), todos: motores, defecto, version: VERSION, modelo_gemini: MODELO_GEMINI() });
  }

  const { token, portal } = cuerpo;
  const slots = cuerpo.slots ?? [];
  const resultados = cuerpo.resultados ?? [];
  const todas = [...slots, ...resultados];
  if (!token || !portal) return responder({ error: "Falta la sesión o el portal" }, 401);
  if (portal !== "ascensosrusheo") return responder({ error: "La lectura con IA es solo para Ascensos Rusheo" }, 403);
  if (!resultados.length) return responder({ error: "Sube al menos una captura de resultados" }, 400);
  if (slots.length > 3) return responder({ error: "Máximo 3 capturas de slots" }, 400);
  if (resultados.length > 5) return responder({ error: "Máximo 5 capturas de resultados" }, 400);
  if (todas.length > MAX_IMAGENES) return responder({ error: `Máximo ${MAX_IMAGENES} capturas por lectura` }, 400);
  for (const im of todas) {
    if (!im || !TIPOS.includes(im.media_type) || typeof im.data !== "string" || im.data.length > 7_000_000) {
      return responder({ error: "Hay una captura que no es JPG/PNG/WEBP o pesa demasiado" }, 400);
    }
  }

  const { usables, defecto } = await estadoMotores();
  if (!usables.length) return responder({ error: "No hay ningún motor de IA activo. El superadmin lo activa en Admin → Motores de IA." }, 500);
  const id = cuerpo.motor || defecto!;
  if (!usables.some((m) => m.id === id)) return responder({ error: `El motor "${id}" no está activo` }, 400);
  const motor = MOTORES[id];

  const url = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  const permiso = await fetch(`${url}/rest/v1/rpc/ia_autorizar`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token, p_portal: portal, p_imagenes: todas.length }),
  });
  if (!permiso.ok) {
    const e = await permiso.json().catch(() => ({}));
    return responder({ error: e.message || "No tienes permiso para usar la IA en este portal" }, 403);
  }
  const autorizado = await permiso.json();

  try {
    const pedido: Pedido = { slots, resultados, conocidos: (cuerpo.equipos ?? []).filter(Boolean).slice(0, 80), modo: cuerpo.modo || 'top_kill' };
    const orden = [id, ...usables.map((m) => m.id).filter((x) => x !== id)];
    let ultimo: unknown = null;
    for (const mid of orden) {
      try {
        const { datos, modelo } = await MOTORES[mid].leer(pedido);
        return responder({
          ok: true, datos: normalizar(datos), motor: mid, motor_nombre: MOTORES[mid].nombre, modelo, quedan: autorizado.quedan,
          aviso: mid !== id ? `${motor.nombre} estaba saturado: leyó ${MOTORES[mid].nombre}.` : undefined,
        });
      } catch (err) {
        ultimo = err;
        if (!(err instanceof ErrorIA) || ![429, 503].includes(err.estado)) break;
      }
    }
    throw ultimo;
  } catch (err) {
    if (err instanceof ErrorIA) return responder({ error: err.message }, err.estado);
    return responder({ error: "Error inesperado: " + (err as Error).message }, 500);
  }
});
