// =====================================================================
//  PROYECTN · Función de Supabase "ascensos-ia-pumasgaming"
//  Independiente de las demás funciones IA del proyecto.
//  Claves API (configurar como Supabase Secrets, NUNCA en el código):
//    ANTHROPIC_API_KEY_PUMASGAMING  → Claude
//    GEMINI_API_KEY_PUMASGAMING     → Gemini  (GEMINI_MODELO_PUMASGAMING opcional)
//    IA_PRIVADA_URL_PUMASGAMING     → Motor privado (compatible OpenAI)
//    IA_PRIVADA_MODELO_PUMASGAMING
//    IA_PRIVADA_KEY_PUMASGAMING     (opcional)
//    IA_PRIVADA_NOMBRE_PUMASGAMING  (opcional)
//
//  Portal permitido: ascensospumasgaming
//  Las claves NUNCA llegan al navegador.
// =====================================================================
import Anthropic from "npm:@anthropic-ai/sdk";

const MAX_IMAGENES = 8;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const env = (k: string) => (Deno.env.get(k) || "").trim();
const VERSION = "2026-10-23a";
const MODELO_GEMINI = () => env("GEMINI_MODELO_PUMASGAMING") || "gemini-2.5-flash";

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

const SISTEMA = `<rol>
Eres un extractor de datos de salas personalizadas de Free Fire. Lees capturas
de pantalla y devuelves SOLO un objeto JSON válido, sin texto adicional,
sin markdown y sin comentarios.
</rol>

<entradas>
Recibirás en el mensaje del usuario:
- EQUIPOS: lista de nombres oficiales, en orden de slot (1.º nombre = slot 1).
- PUNTOS_POR_KILL: número (ej. 1). Si es 0, las kills se muestran pero no suman.
- LOBBY_n: capturas de la sala con los jugadores de cada slot.
- PARTIDA_n: capturas de resultados. Cada imagen es una partida
  (PARTIDA_1 = P1/K1, PARTIDA_2 = P2/K2, etc.).
</entradas>

<paso_1_base_temporal>
- Extrae de LOBBY: nombre de sala, ID, mapa, modo y jugadores (ej. "47/48").
- Por cada slot, lista sus jugadores y asígnale el nombre oficial según EQUIPOS.
- tag = tag de clan más repetido; "MIX" si hay tags mezclados; "—" si no hay.
- Marca cupos vacíos y nombres dudosos en "observaciones".
</paso_1_base_temporal>

<paso_2_resultados>
- En cada PARTIDA, identifica la posición de cada equipo comparando sus
  jugadores con la base del paso 1.
- Lee las kills ("Eliminaciones") de cada jugador visible.
- Jugadores que no estaban en el lobby: regístralos como suplentes del equipo
  con el que aparecen; sus kills cuentan para ese equipo.
- Si un equipo no aparece en la imagen: posición null y kills null.
- Si el equipo aparece pero algún jugador está cortado o no se lee:
  suma solo las kills visibles, marca "kills_completas": false y anótalo
  en "avisos".
</paso_2_resultados>

<paso_3_puntos>
- Puntos por posición: 1=12, 2=9, 3=8, 4=7, 5=6, 6=5, 7=4, 8=3, 9=2, 10=1,
  11=0, 12=0.
- Por cada partida n:
  Pn = puntos de su posición (null si no aparece; celda vacía, NO 0).
  Kn = kills totales del equipo (null si no aparece).
- jug = cantidad de partidas en las que el equipo aparece.
- total_top = suma de P no nulos.
- total_kills = suma de K no nulos.
- total = total_top + (total_kills × PUNTOS_POR_KILL).
- Ordena por total descendente. Desempate: 1) más booyahs (posición 1);
  2) más total_kills; 3) mejor posición individual.
  Explica cada empate en "desempates".
</paso_3_puntos>

<reglas>
- Nunca inventes datos. Si algo no se lee, usa null y anótalo en "avisos".
- Crea tantas claves P1, P2... y K1, K2... como partidas recibas.
- Responde únicamente con el JSON del formato de salida.
</reglas>

<formato_salida>
{
  "sala": {"nombre": "", "id": "", "mapa": "", "modo": "", "jugadores": ""},
  "equipos": [
    {"slot": 1, "equipo": "", "tag": "", "jugadores": [], "suplentes": [], "observaciones": ""}
  ],
  "partidas": [
    {
      "partida": 1,
      "resultados": [
        {"posicion": 1, "slot": 12, "jugadores": [{"nombre": "", "kills": 0}], "kills_equipo": 0, "kills_completas": true}
      ]
    }
  ],
  "tabla": [
    {
      "rank": 1, "equipo": "", "tag": "", "jug": 4,
      "top": {"P1": 12, "P2": null},
      "kills": {"K1": 16, "K2": null},
      "booyahs": 0, "total_top": 0, "total_kills": 0, "total": 0
    }
  ],
  "desempates": [],
  "avisos": []
}
</formato_salida>`;

type Imagen = { media_type: string; data: string };
type Pedido = { slots: Imagen[]; resultados: Imagen[]; conocidos: string[]; modo: string; puntos_kill: number };
type Lectura = { datos: unknown; modelo: string };

function piezas(p: Pedido): Array<{ texto: string } | { imagen: Imagen }> {
  const l: Array<{ texto: string } | { imagen: Imagen }> = [];
  if (p.conocidos.length) {
    l.push({ texto: `EQUIPOS:\n${p.conocidos.join("\n")}\nPUNTOS_POR_KILL: ${p.puntos_kill}` });
  }
  p.slots.forEach((imagen, i) => {
    l.push({ texto: `LOBBY_${i + 1}` });
    l.push({ imagen });
  });
  p.resultados.forEach((imagen, i) => {
    l.push({ texto: `PARTIDA_${i + 1}` });
    l.push({ imagen });
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

const PTS_A_TOP: Record<number, number> = { 12: 1, 9: 2, 8: 3, 7: 4, 6: 5, 5: 6, 4: 7, 3: 8, 2: 9, 1: 10, 0: 12 };

type SlotInfo = { nombre: string; tag: string };
type PosEntry = { pos: number; kills: number };

function buildSlotInfo(equipos: any[]): Record<number, SlotInfo> {
  const m: Record<number, SlotInfo> = {};
  for (const e of (equipos ?? [])) {
    const slot = parseInt(String(e?.slot ?? 0), 10);
    if (slot >= 1) m[slot] = { nombre: String(e?.equipo ?? e?.nombre ?? "").trim(), tag: String(e?.tag ?? "").trim() };
  }
  return m;
}

function slotDe(nombre: string, slotInfo: Record<number, SlotInfo>): number {
  for (const [s, info] of Object.entries(slotInfo)) {
    if (info.nombre.toLowerCase() === nombre.toLowerCase()) return parseInt(s, 10);
  }
  return 0;
}

function normalizar(d: any) {
  const avs = (arr: unknown) => (Array.isArray(arr) ? arr : []).map((x: unknown) => String(x)).filter(Boolean);

  // ── Formato v2: tabla con "top" (P1/P2) y "kills" (K1/K2) ──────────────
  if (Array.isArray(d?.tabla) && d.tabla.length > 0 && d.tabla[0]?.top !== undefined) {
    const slotInfo = buildSlotInfo(d.equipos);
    const posMap: Record<number, Record<number, PosEntry>> = {};
    let maxP = 0;
    for (const p of (d.partidas ?? [])) {
      const n = parseInt(String(p?.partida ?? 0), 10);
      if (!isNaN(n) && n >= 1) {
        maxP = Math.max(maxP, n);
        posMap[n] = {};
        for (const r of (p?.resultados ?? [])) {
          const slot = parseInt(String(r?.slot ?? 0), 10);
          const pos = parseInt(String(r?.posicion ?? 0), 10);
          const kills = Math.max(0, parseInt(String(r?.kills_equipo ?? 0), 10) || 0);
          if (slot >= 1 && pos >= 1) posMap[n][slot] = { pos, kills };
        }
      }
    }
    for (const t of d.tabla) {
      for (const key of Object.keys(t?.top ?? {})) { const n = parseInt(key.replace(/^P/i, ""), 10); if (!isNaN(n) && n >= 1) maxP = Math.max(maxP, n); }
      for (const key of Object.keys(t?.kills ?? {})) { const n = parseInt(key.replace(/^K/i, ""), 10); if (!isNaN(n) && n >= 1) maxP = Math.max(maxP, n); }
    }
    const equipos = d.tabla.map((t: any) => {
      const nombre = String(t?.equipo ?? "").trim();
      if (!nombre) return null;
      const slot = slotDe(nombre, slotInfo);
      const topObj: Record<string, number | null> = t?.top ?? {};
      const killsObj: Record<string, number | null> = t?.kills ?? {};
      const partidas: Array<{ partida: number; top: number; kills: number }> = [];
      for (let n = 1; n <= maxP; n++) {
        const pKey = `P${n}`, kKey = `K${n}`;
        const puntoN = topObj[pKey];
        if (puntoN === null || puntoN === undefined) continue;
        const enMap = slot >= 1 ? posMap[n]?.[slot] : undefined;
        const top = enMap?.pos ?? (PTS_A_TOP[puntoN] ?? 12);
        const kills = enMap?.kills ?? (killsObj[kKey] != null ? Math.max(0, Number(killsObj[kKey]) || 0) : 0);
        partidas.push({ partida: n, top, kills });
      }
      return { nombre, tag: String(t?.tag ?? slotInfo[slot]?.tag ?? "").trim(), jugadores: [], partidas };
    }).filter(Boolean);
    return { equipos, partidas_detectadas: maxP, avisos: avs(d.avisos) };
  }

  // ── Formato v1: tabla con "puntos" (P1/P2) ──────────────────────────────
  if (Array.isArray(d?.tabla) && (d.tabla.length === 0 || d.tabla[0]?.equipo !== undefined)) {
    const slotInfo = buildSlotInfo(d.equipos);
    const posMap: Record<number, Record<number, PosEntry>> = {};
    let maxP = 0;
    for (const p of (d.partidas ?? [])) {
      const n = parseInt(String(p?.partida ?? "").replace(/^P/i, ""), 10);
      if (!isNaN(n) && n >= 1) {
        maxP = Math.max(maxP, n);
        posMap[n] = {};
        for (const pos of (p?.posiciones ?? [])) {
          const slot = parseInt(String(pos?.slot ?? 0), 10);
          const posicion = parseInt(String(pos?.posicion ?? 0), 10);
          const kills = Math.max(0, parseInt(String(pos?.kills ?? 0), 10) || 0);
          if (slot >= 1 && posicion >= 1) posMap[n][slot] = { pos: posicion, kills };
        }
      }
    }
    for (const t of (d.tabla ?? [])) {
      for (const key of Object.keys(t?.puntos ?? {})) { const n = parseInt(key.replace(/^P/i, ""), 10); if (!isNaN(n) && n >= 1) maxP = Math.max(maxP, n); }
    }
    const equipos = (d.tabla ?? []).map((t: any) => {
      const nombre = String(t?.equipo ?? "").trim();
      if (!nombre) return null;
      const slot = slotDe(nombre, slotInfo);
      const puntosObj: Record<string, number | null> = t?.puntos ?? {};
      const killsTabla: Record<string, number | null> = t?.kills ?? {};
      const partidas: Array<{ partida: number; top: number; kills: number }> = [];
      for (let n = 1; n <= maxP; n++) {
        const pKey = `P${n}`;
        const puntoN = puntosObj[pKey];
        if (puntoN === null || puntoN === undefined) continue;
        const enMap = slot >= 1 ? posMap[n]?.[slot] : undefined;
        const top = enMap?.pos ?? (PTS_A_TOP[puntoN] ?? 12);
        const kills = enMap?.kills ?? (killsTabla[pKey] != null ? Math.max(0, Number(killsTabla[pKey]) || 0) : 0);
        partidas.push({ partida: n, top, kills });
      }
      return { nombre, tag: String(t?.tag ?? slotInfo[slot]?.tag ?? "").trim(), jugadores: [], partidas };
    }).filter(Boolean);
    return { equipos, partidas_detectadas: maxP, avisos: avs(d.avisos) };
  }

  // ── Formato legacy ─────────────────────────────────────────────────────
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
    avisos: avs(d.avisos),
  };
}

// ---------------------------------------------------------------- Motores (claves específicas de Pumas Gaming)
const MOTORES: Record<string, { nombre: string; listo: () => boolean; leer: (p: Pedido) => Promise<Lectura> }> = {
  gemini: {
    nombre: "Gemini",
    listo: () => !!env("GEMINI_API_KEY_PUMASGAMING"),
    leer: async (p) => {
      const parts = piezas(p).map((x) => "texto" in x ? { text: x.texto } : { inline_data: { mime_type: x.imagen.media_type, data: x.imagen.data } });
      const pedir = (modelo: string) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 40_000);
        return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY_PUMASGAMING") },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SISTEMA }] },
            contents: [{ role: "user", parts }],
            generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 24000 },
          }),
        }).finally(() => clearTimeout(tid));
      };
      let modelo = MODELO_GEMINI();
      const saturado = (st: number, m: string) => st === 503 || st === 500 || /high demand|overloaded|unavailable|try again later/i.test(m);
      const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
      const pedirSeguro = async (m: string) => {
        try { return await pedir(m); }
        catch (e: unknown) {
          if ((e as Error)?.name === "AbortError") throw new ErrorIA(`Gemini (${m}) no respondió a tiempo. Intenta de nuevo o cambia el modelo con el secreto GEMINI_MODELO_PUMASGAMING.`, 503);
          throw e;
        }
      };
      let r = await pedirSeguro(modelo);
      let j = await r.json().catch(() => ({}));
      for (const ms of [2500, 6000]) {
        if (r.ok || !saturado(r.status, j?.error?.message || "")) break;
        await esperar(ms);
        r = await pedirSeguro(modelo);
        j = await r.json().catch(() => ({}));
      }
      const respaldo = env("GEMINI_MODELO_RESPALDO_PUMASGAMING");
      if (!r.ok && respaldo && respaldo !== modelo && saturado(r.status, j?.error?.message || "")) {
        modelo = respaldo;
        r = await pedirSeguro(modelo);
        j = await r.json().catch(() => ({}));
      }
      const sugerido = !r.ok && /no longer available|not found|deprecated|is not supported/i.test(j?.error?.message || "")
        ? (/models\/(gemini-[\w.-]+)/.exec(String(j.error.message).split(/use|usar/i).slice(1).join(" ")) || [])[1] : null;
      if (sugerido && sugerido !== modelo) {
        modelo = sugerido;
        r = await pedirSeguro(modelo);
        j = await r.json().catch(() => ({}));
      }
      if (!r.ok) {
        const msg = j?.error?.message || `HTTP ${r.status}`;
        if (saturado(r.status, msg)) throw new ErrorIA(`Gemini (${modelo}) está saturado en este momento. Intenta en unos minutos o cambia el modelo con el secreto GEMINI_MODELO_PUMASGAMING.`, 503);
        throw new ErrorIA(r.status === 429 ? "Gemini está ocupado o llegaste a tu cuota. Intenta en un minuto." :
          r.status === 400 && /API key/i.test(msg) ? "La clave GEMINI_API_KEY_PUMASGAMING no es válida" :
          `Error de Gemini (${modelo}): ${msg} · Cambia el modelo con el secreto GEMINI_MODELO_PUMASGAMING.`, r.status === 429 ? 429 : 502);
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
    nombre: env("IA_PRIVADA_NOMBRE_PUMASGAMING") || "Motor privado",
    listo: () => !!env("IA_PRIVADA_URL_PUMASGAMING") && !!env("IA_PRIVADA_MODELO_PUMASGAMING"),
    leer: async (p) => {
      const base = env("IA_PRIVADA_URL_PUMASGAMING").replace(/\/+$/, "");
      const url = /\/chat\/completions$/.test(base) ? base : base + "/chat/completions";
      const content = piezas(p).map((x) => "texto" in x ? { type: "text", text: x.texto }
        : { type: "image_url", image_url: { url: `data:${x.imagen.media_type};base64,${x.imagen.data}` } });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (env("IA_PRIVADA_KEY_PUMASGAMING")) headers.Authorization = `Bearer ${env("IA_PRIVADA_KEY_PUMASGAMING")}`;
      const pedir = (formato: unknown) => fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: env("IA_PRIVADA_MODELO_PUMASGAMING"),
          temperature: 0,
          messages: [{ role: "system", content: SISTEMA }, { role: "user", content }],
          ...(formato ? { response_format: formato } : {}),
        }),
      });
      let r = await pedir({ type: "json_object" });
      if (r.status === 400 || r.status === 422) r = await pedir(null);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = j?.error?.message || j?.detail || `HTTP ${r.status}`;
        throw new ErrorIA(r.status === 401 || r.status === 403 ? "El motor privado rechazó la clave (IA_PRIVADA_KEY_PUMASGAMING)" : "Error del motor privado: " + msg, r.status === 429 ? 429 : 502);
      }
      const texto = j?.choices?.[0]?.message?.content;
      if (!texto) throw new ErrorIA("El motor privado no devolvió resultados");
      return { datos: leerJson(Array.isArray(texto) ? texto.map((x: { text?: string }) => x.text || "").join("") : String(texto)), modelo: j.model || env("IA_PRIVADA_MODELO_PUMASGAMING") };
    },
  },

  claude: {
    nombre: "Claude",
    listo: () => !!env("ANTHROPIC_API_KEY_PUMASGAMING"),
    leer: async (p) => {
      const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY_PUMASGAMING") });
      const contenido: Anthropic.MessageParam["content"] = piezas(p).map((x) => "texto" in x
        ? { type: "text" as const, text: x.texto }
        : { type: "image" as const, source: { type: "base64" as const, media_type: x.imagen.media_type as "image/png", data: x.imagen.data } });
      try {
        const stream = client.messages.stream({
          model: "claude-haiku-5-5",
          max_tokens: 32000,
          system: SISTEMA,
          messages: [{ role: "user", content: contenido }],
        });
        const respuesta = await stream.finalMessage();
        if (respuesta.stop_reason === "max_tokens") throw new ErrorIA("Demasiadas capturas para una sola lectura. Prueba con menos.", 422);
        const texto = respuesta.content.find((b) => b.type === "text");
        if (!texto || texto.type !== "text") throw new ErrorIA("Claude no devolvió resultados");
        return { datos: leerJson(texto.text), modelo: respuesta.model };
      } catch (err) {
        if (err instanceof ErrorIA) throw err;
        if (err instanceof Anthropic.RateLimitError) throw new ErrorIA("Claude está ocupado. Intenta en un minuto.", 429);
        if (err instanceof Anthropic.AuthenticationError) throw new ErrorIA("La clave ANTHROPIC_API_KEY_PUMASGAMING no es válida", 500);
        if (err instanceof Anthropic.APIError) throw new ErrorIA("Error de Claude: " + err.message);
        throw err;
      }
    },
  },
};

async function configMotores(): Promise<{ activos: string[] | null; defecto: string | null }> {
  try {
    const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/sitio_config?clave=eq.ia_motores_pumasgaming&select=valor`, {
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
  const defecto = usables.find((m) => m.id === cfg.defecto)?.id ?? usables.find((m) => m.id === env("IA_MOTOR_DEFECTO_PUMASGAMING"))?.id ?? usables[0]?.id ?? null;
  return { motores, usables, defecto };
}

// ---------------------------------------------------------------- Servidor
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ error: "Usa POST" }, 405);

  let cuerpo: { accion?: string; motor?: string; token?: string; portal?: string; slots?: Imagen[]; resultados?: Imagen[]; equipos?: string[]; modo?: string; puntos_kill?: number };
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
  if (portal !== "ascensospumasgaming") return responder({ error: "La lectura con IA es solo para Ascensos Pumas Gaming" }, 403);
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
    const pedido: Pedido = { slots, resultados, conocidos: (cuerpo.equipos ?? []).filter(Boolean).slice(0, 80), modo: cuerpo.modo || "top", puntos_kill: Math.max(0, parseInt(String(cuerpo.puntos_kill ?? 1), 10) || 1) };
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
