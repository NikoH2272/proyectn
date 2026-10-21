# Ascensos AZA · Resultados con IA

La pestaña **Con IA** de la herramienta de **Ascensos AZA** (solo AZA: ni Pruebas ni QFD la tienen) lee las capturas de Free Fire y llena la tabla sola:

1. Eliges el **evento** y el **motor de IA**.
2. **Capturas de slots** (alineación de la sala) → qué jugadores son de cada equipo.
3. **Capturas de resultados**, una por partida y **en orden** → top y kills de cada equipo.
4. Revisas lo que leyó (avisos incluidos) → **Pasar a la tabla** → completas los tags → **Generar imagen y guardar**.

## Motores

| Motor | Qué es | Secretos en Supabase |
|---|---|---|
| **Gemini** | IA de Google | `GEMINI_API_KEY` · opcional `GEMINI_MODELO` (por defecto `gemini-3.8-flash`) · opcional `GEMINI_MODELO_RESPALDO` (se usa si el principal está saturado) |
| **Privado** | Tu propio motor, con API compatible con OpenAI (`/v1/chat/completions`): Ollama, vLLM, LM Studio, LocalAI, OpenRouter... El modelo tiene que leer imágenes (visión). | `IA_PRIVADA_URL` (ej. `https://mi-servidor.com/v1`) · `IA_PRIVADA_MODELO` · opcional `IA_PRIVADA_KEY` · opcional `IA_PRIVADA_NOMBRE` |
| Claude | IA de Anthropic (opcional) | `ANTHROPIC_API_KEY` |

El **superadmin** decide cuáles se usan en **Admin → Motores de IA** (`/admin/ia.html`): un interruptor por motor y cuál va **por defecto**. Si deja varios activos, en la herramienta aparece un selector para elegir; si deja uno, se usa ese; si apaga todos, la IA queda desactivada.

```
herramienta ──capturas + motor──▶ función "ascensos-ia" (Supabase)
                                    ├─ ia_autorizar (sql/18): sesión, acceso a AZA, máx. 40 lecturas/día
                                    ├─ sitio_config 'ia_motores': motores activos (superadmin)
                                    └─▶ Gemini  /  motor privado  /  Claude  (las claves nunca llegan al navegador)
```

Todos los motores devuelven lo mismo (equipos → partidas → top y kills), así que la herramienta funciona igual con cualquiera.

## Configurar (una sola vez)

1. **SQL:** corre `sql/18_roles_ascensos_ia.sql` en Supabase → SQL Editor (si ya lo habías corrido, córrelo otra vez: se puede repetir).
2. **Gemini:** en [aistudio.google.com](https://aistudio.google.com) → **Get API key** → Create API key. Cópiala.
3. **Motor privado:** ten a mano la dirección de tu servidor (debe ser **https** y accesible desde internet, no `localhost`), el nombre del modelo y la clave si tu servidor la pide.
   - Ollama: `IA_PRIVADA_URL = https://tu-dominio/v1`, `IA_PRIVADA_MODELO = llama3.2-vision` (o el modelo con visión que tengas).
   - Si lo tienes en tu PC, publícalo con un túnel (ej. Cloudflare Tunnel) para que Supabase lo alcance.
4. **Secretos:** Supabase → *Edge Functions* → *Secrets* → **Add new secret**, uno por fila:
   - `GEMINI_API_KEY` = la clave de Google
   - `IA_PRIVADA_URL` = `https://.../v1`
   - `IA_PRIVADA_MODELO` = nombre del modelo
   - `IA_PRIVADA_KEY` = clave de tu servidor (si tiene)
   - `IA_PRIVADA_NOMBRE` = cómo quieres que se llame en la herramienta (ej. `IA Pumas`)
   Nunca pegues estas claves en archivos del repositorio.
5. **Publicar la función:** *Edge Functions* → **Deploy a new function** → *Via Editor* → nombre `ascensos-ia` → pega `supabase/functions/ascensos-ia/index.ts` → **Deploy** (deja "Verify JWT" activado). Si ya existía, ábrela, reemplaza el código y vuelve a desplegar.
6. **Activar:** entra con el superadmin a **Admin → Motores de IA**, enciende Gemini y el privado, elige el de por defecto y **Guardar**.
7. **Probar:** `/ascensos/admin.html` → **Con IA** → elige el motor → sube capturas → **Leer con IA**.

## Costos y límites

- Gemini y Claude se pagan por uso en sus cuentas (Gemini tiene una capa gratuita con límites). El motor privado corre en tu servidor.
- Límite: 40 lecturas por usuario cada 24 h (en `sql/18`, `limite constant int := 40`).
- `select usuario, portal, imagenes, creado from ia_uso order by creado desc;` muestra quién la usó.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| La función "ascensos-ia" no está publicada | Paso 5 |
| No hay ningún motor de IA activo | Paso 6 (y que tenga sus secretos, paso 4) |
| FALTA CONFIGURAR (en Motores de IA) | Faltan los secretos de ese motor (paso 4) |
| La clave GEMINI_API_KEY no es válida | Crea otra en AI Studio y reemplaza el secreto |
| Error del motor privado / no devolvió un JSON válido | Revisa que la URL termine en `/v1`, que el modelo tenga visión y que el servidor responda desde internet; prueba con Gemini mientras |
| Gemini está saturado | Es pasajero: la función ya reintenta sola y pasa a otro motor activo. Pon un `GEMINI_MODELO_RESPALDO` o activa un segundo motor |
| Límite de lecturas | Espera 24 h o súbelo en `sql/18` |
| La IA leyó mal un nombre | Corrígelo en la tabla antes de guardar (todo queda en el borrador) |
