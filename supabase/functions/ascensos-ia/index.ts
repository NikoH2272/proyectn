// =====================================================================
//  PUMAS GAMING · Función de Supabase "ascensos-ia" (solo Ascensos AZA)
//  Lee capturas de Free Fire y devuelve los resultados listos para la
//  herramienta de ascensos:
//    1) capturas de SLOTS (alineación de la sala) → equipos y jugadores
//    2) capturas de RESULTADOS (una por partida, en orden) → top y kills
//
//  MOTORES (cada uno se activa solo si tiene sus secretos en Supabase):
//    gemini  → GEMINI_API_KEY            (opcional GEMINI_MODELO)
//    privado → IA_PRIVADA_URL            (API compatible con OpenAI: .../v1)
//              IA_PRIVADA_MODELO          (nombre del modelo con visión)
//              IA_PRIVADA_KEY             (opcional, si tu servidor pide clave)
//              IA_PRIVADA_NOMBRE          (opcional, cómo se ve en la herramienta)
//    claude  → ANTHROPIC_API_KEY         (opcional)
//    Cuáles se usan lo decide el superadmin en Admin → Motores de IA (sql/18).
//
//  Las claves NUNCA llegan al navegador. Antes de leer se pide permiso a
//  la base (sql/18: ia_autorizar → sesión, acceso al portal, límite diario).
// =====================================================================
import Anthropic from "npm:@anthropic-ai/sdk";

const MAX_IMAGENES = 16;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const env = (k: string) => (Deno.env.get(k) || "").trim();
const VERSION = "2026-10-10d";   // para comprobar desde el sitio qué versión está publicada
const MODELO_GEMINI = () => env("GEMINI_MODELO") || "gemini-3.8-flash";

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

// ---------------------------------------------------------------- Qué se pide
const SISTEMA = `Lees capturas de pantalla de salas personalizadas de Free Fire para un torneo de ascensos y devuelves los resultados exactos.

Recibes dos grupos de imágenes:
1. SLOTS: la alineación de la sala. Cada slot (número de escuadra) muestra el nombre o tag del equipo y sus jugadores.
2. RESULTADOS: una captura (o varias seguidas) por partida, en el orden en que se jugaron. Muestran el puesto final (top) de cada escuadra y sus kills (bajas/eliminaciones).

Cómo trabajar:
- Usa los SLOTS para saber qué jugadores forman cada equipo. En los resultados a veces solo aparecen nombres de jugadores o el número de slot: úsalos para identificar al equipo.
- Si te dan una lista de equipos conocidos, escribe el nombre del equipo exactamente como aparece en esa lista cuando sea el mismo equipo (ignora mayúsculas, emojis y símbolos al comparar).
- La lista de equipos viene como "Slot N: NOMBRE - TAG". El número de slot es el número de escuadra en la sala: úsalo para identificar a cada equipo en los slots y en los resultados.
- Los jugadores suelen llevar el TAG de su equipo en el nombre (ej. "DCN•Juan" es de DCN). Si dos equipos comparten tag (ej. TS OFICIAL BLUE y TS OFICIAL GREEN), sepáralos por el slot y por las capturas de slots, nunca solo por el tag.
- Cuando hay lista, devuelve los equipos con el nombre de la lista. Si ves uno que no está, inclúyelo y avísalo en "avisos".
- Para cada equipo devuelve una entrada por cada partida en la que aparece: número de partida (empieza en 1), top (1 = booyah) y kills totales del equipo en esa partida (suma de sus jugadores si se muestran por jugador).
- Si un equipo no aparece en una partida, no inventes la entrada: déjala fuera.
- Copia los nombres tal como se leen. Si un dato no se lee con seguridad, da tu mejor lectura y explícalo en "avisos" (en español, una línea por problema).
- "partidas_detectadas" es el número de partidas distintas que encontraste en las capturas de resultados.

Responde SOLO con JSON con esta forma:
{"equipos":[{"nombre":"","tag":"","jugadores":[""],"partidas":[{"partida":1,"top":1,"kills":0}]}],"partidas_detectadas":1,"avisos":[""]}`;

// JSON Schema (Claude y motores privados que lo acepten)
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

// Mismo esquema en el formato de Gemini (tipos en mayúscula, sin additionalProperties)
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
type Pedido = { slots: Imagen[]; resultados: Imagen[]; conocidos: string[] };
type Lectura = { datos: unknown; modelo: string };

// Las piezas del mensaje en orden (texto / imagen), igual para todos los motores
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

// Acepta JSON aunque venga dentro de ```json ... ``` (motores privados)
function leerJson(texto: string) {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const i = limpio.indexOf("{"), j = limpio.lastIndexOf("}");
  try {
    return JSON.parse(i >= 0 && j > i ? limpio.slice(i, j + 1) : limpio);
  } catch {
    throw new ErrorIA("La IA no devolvió un JSON válido. Intenta de nuevo o usa otro motor.");
  }
}

// Deja los datos siempre con la misma forma, venga del motor que venga
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

// ---------------------------------------------------------------- Motores
const MOTORES: Record<string, { nombre: string; listo: () => boolean; leer: (p: Pedido) => Promise<Lectura> }> = {
  gemini: {
    nombre: "Gemini",
    listo: () => !!env("GEMINI_API_KEY"),
    leer: async (p) => {
      const parts = piezas(p).map((x) => "texto" in x ? { text: x.texto } : { inline_data: { mime_type: x.imagen.media_type, data: x.imagen.data } });
      const pedir = (modelo: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SISTEMA }] },
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: ESQUEMA_GEMINI },
        }),
      });
      let modelo = MODELO_GEMINI();
      // Saturado (503 / "high demand"): reintenta 2 veces y luego prueba el modelo de respaldo (secreto GEMINI_MODELO_RESPALDO)
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
      const respaldo = env("GEMINI_MODELO_RESPALDO");
      if (!r.ok && respaldo && respaldo !== modelo && saturado(r.status, j?.error?.message || "")) {
        modelo = respaldo;
        r = await pedir(modelo);
        j = await r.json().catch(() => ({}));
      }
      // Si Google retiró el modelo y sugiere otro ("...use models/gemini-X..."), se reintenta solo con ese
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
          r.status === 400 && /API key/i.test(msg) ? "La clave GEMINI_API_KEY no es válida" :
          `Error de Gemini (${modelo}): ${msg} · Cambia el modelo con el secreto GEMINI_MODELO.`, r.status === 429 ? 429 : 502);
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
    nombre: env("IA_PRIVADA_NOMBRE") || "Motor privado",
    listo: () => !!env("IA_PRIVADA_URL") && !!env("IA_PRIVADA_MODELO"),
    leer: async (p) => {
      const base = env("IA_PRIVADA_URL").replace(/\/+$/, "");
      const url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";
      const content = piezas(p).map((x) => "texto" in x ? { type: "text", text: x.texto }
        : { type: "image_url", image_url: { url: `data:${x.imagen.media_type};base64,${x.imagen.data}` } });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (env("IA_PRIVADA_KEY")) headers.Authorization = `Bearer ${env("IA_PRIVADA_KEY")}`;
      const pedir = (formato: unknown) => fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: env("IA_PRIVADA_MODELO"),
          temperature: 0,
          messages: [{ role: "system", content: SISTEMA }, { role: "user", content }],
          ...(formato ? { response_format: formato } : {}),
        }),
      });
      // Primero con el esquema exacto; si el servidor no lo soporta, JSON simple; si tampoco, sin formato
      let r = await pedir({ type: "json_schema", json_schema: { name: "resultados", strict: true, schema: ESQUEMA } });
      if (r.status === 400 || r.status === 422) r = await pedir({ type: "json_object" });
      if (r.status === 400 || r.status === 422) r = await pedir(null);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = j?.error?.message || j?.detail || `HTTP ${r.status}`;
        throw new ErrorIA(r.status === 401 || r.status === 403 ? "El motor privado rechazó la clave (IA_PRIVADA_KEY)" : "Error del motor privado: " + msg, r.status === 429 ? 429 : 502);
      }
      const texto = j?.choices?.[0]?.message?.content;
      if (!texto) throw new ErrorIA("El motor privado no devolvió resultados");
      return { datos: leerJson(Array.isArray(texto) ? texto.map((x: { text?: string }) => x.text || "").join("") : String(texto)), modelo: j.model || env("IA_PRIVADA_MODELO") };
    },
  },

  claude: {
    nombre: "Claude",
    listo: () => !!env("ANTHROPIC_API_KEY"),
    leer: async (p) => {
      const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
      const contenido: Anthropic.Beta.BetaContentBlockParam[] = piezas(p).map((x) => "texto" in x
        ? { type: "text" as const, text: x.texto }
        : { type: "image" as const, source: { type: "base64" as const, media_type: x.imagen.media_type as "image/png", data: x.imagen.data } });
      try {
        const respuesta = await client.beta.messages.create({
          model: "claude-opus-5-5",
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          system: SISTEMA,
          output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
          messages: [{ role: "user", content: contenido }],
        });
        if (respuesta.stop_reason === "refusal") throw new ErrorIA("Claude no pudo procesar estas capturas. Revisa que sean de resultados del juego.", 422);
        if (respuesta.stop_reason === "max_tokens") throw new ErrorIA("Demasiadas capturas para una sola lectura. Prueba con menos.", 422);
        const texto = respuesta.content.find((b) => b.type === "text");
        if (!texto || texto.type !== "text") throw new ErrorIA("Claude no devolvió resultados");
        return { datos: JSON.parse(texto.text), modelo: respuesta.model };
      } catch (err) {
        if (err instanceof ErrorIA) throw err;
        if (err instanceof Anthropic.RateLimitError) throw new ErrorIA("Claude está ocupado. Intenta en un minuto.", 429);
        if (err instanceof Anthropic.AuthenticationError) throw new ErrorIA("La clave ANTHROPIC_API_KEY no es válida", 500);
        if (err instanceof Anthropic.APIError) throw new ErrorIA("Error de Claude: " + err.message);
        throw err;
      }
    },
  },
};

// Qué motores activó el superadmin (sql/18: sitio_config 'ia_motores'). Sin config → todos los configurados.
async function configMotores(): Promise<{ activos: string[] | null; defecto: string | null }> {
  try {
    const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/sitio_config?clave=eq.ia_motores&select=valor`, {
      headers: { apikey: env("SUPABASE_ANON_KEY"), Authorization: `Bearer ${env("SUPABASE_ANON_KEY")}` },
    });
    const f = r.ok ? await r.json() : [];
    const v = f?.[0]?.valor;
    return { activos: Array.isArray(v?.activos) ? v.activos : null, defecto: v?.defecto ?? null };
  } catch {
    return { activos: null, defecto: null };
  }
}
// Todos los motores con su estado: configurado (tiene secretos) y activo (lo eligió el superadmin)
async function estadoMotores() {
  const cfg = await configMotores();
  const motores = Object.entries(MOTORES).map(([id, m]) => ({
    id, nombre: m.nombre, configurado: m.listo(), activo: m.listo() && (cfg.activos ? cfg.activos.includes(id) : true),
  }));
  const usables = motores.filter((m) => m.activo);
  const defecto = usables.find((m) => m.id === cfg.defecto)?.id ?? usables.find((m) => m.id === env("IA_MOTOR_DEFECTO"))?.id ?? usables[0]?.id ?? null;
  return { motores, usables, defecto };
}

// ---------------------------------------------------------------- Servidor
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  let cuerpo: { accion?: string; motor?: string; token?: string; portal?: string; slots?: Imagen[]; resultados?: Imagen[]; equipos?: string[] };
  try {
    cuerpo = await req.json();
  } catch {
    return responder({ error: "Datos inválidos" }, 400);
  }

  // La herramienta pregunta qué motores están configurados (no gasta nada)
  if (cuerpo.accion === "motores") {
    const { motores, usables, defecto } = await estadoMotores();
    return responder({ motores: usables.map(({ id, nombre }) => ({ id, nombre })), todos: motores, defecto, version: VERSION, modelo_gemini: MODELO_GEMINI() });
  }

  const { token, portal } = cuerpo;
  const slots = cuerpo.slots ?? [];
  const resultados = cuerpo.resultados ?? [];
  const todas = [...slots, ...resultados];
  if (!token || !portal) return responder({ error: "Falta la sesión o el portal" }, 401);
  if (portal !== "ascensosaza") return responder({ error: "La lectura con IA es solo para Ascensos AZA" }, 403);
  if (!resultados.length) return responder({ error: "Sube al menos una captura de resultados" }, 400);
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

  // Permiso: sesión válida, acceso al portal y límite diario (sql/18)
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
    const pedido: Pedido = { slots, resultados, conocidos: (cuerpo.equipos ?? []).filter(Boolean).slice(0, 80) };
    // Si el motor elegido está saturado u ocupado, se prueba con los otros motores activos
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
        if (!(err instanceof ErrorIA) || ![429, 503].includes(err.estado)) break;   // solo se cambia de motor si estaba saturado
      }
    }
    throw ultimo;
  } catch (err) {
    if (err instanceof ErrorIA) return responder({ error: err.message }, err.estado);
    return responder({ error: "Error inesperado: " + (err as Error).message }, 500);
  }
});
