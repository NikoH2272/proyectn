-- =====================================================================
--  PUMAS GAMING · Auditoría de ataques de bot en encuestas
--  Corre estas queries en el SQL Editor de Supabase para analizar.
--  Cambia 'entrenamientos' por el portal que quieres revisar.
-- =====================================================================

-- ── 1. VOLUMEN POR MINUTO ────────────────────────────────────────────
-- Señal de alerta: más de ~10 votos en un mismo minuto es sospechoso.
-- Un ataque de bot suele verse como picos de decenas o cientos de votos/min.

SELECT
    date_trunc('minute', creado)          AS minuto,
    count(*)                              AS votos,
    round(count(*) / 60.0, 1)            AS votos_por_segundo
FROM din_entradas
WHERE portal = 'entrenamientos'
  AND tipo   = 'encuesta'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 30;


-- ── 2. BRECHAS ENTRE VOTOS (patrón de bot: < 1 segundo) ─────────────
-- Los bots votan a intervalos regulares o casi sin pausa.
-- Votos humanos normalmente tienen > 3-5 segundos de diferencia.

SELECT
    id,
    creado,
    creado - lag(creado) OVER (ORDER BY creado) AS gap_anterior,
    metadata->>'opcion_idx'                       AS opcion
FROM din_entradas
WHERE portal = 'entrenamientos'
  AND tipo   = 'encuesta'
ORDER BY creado;


-- ── 3. RESUMEN: ¿hubo ráfagas sospechosas? ──────────────────────────
-- Cuenta cuántos votos llegaron con menos de 2 segundos del anterior.

WITH gaps AS (
    SELECT
        creado,
        creado - lag(creado) OVER (ORDER BY creado) AS gap
    FROM din_entradas
    WHERE portal = 'entrenamientos' AND tipo = 'encuesta'
)
SELECT
    count(*) FILTER (WHERE gap < interval '2 seconds')   AS votos_rafaga,
    count(*) FILTER (WHERE gap >= interval '2 seconds')  AS votos_normales,
    count(*)                                              AS total,
    min(creado)                                           AS primer_voto,
    max(creado)                                           AS ultimo_voto,
    max(creado) - min(creado)                             AS duracion_total
FROM gaps;


-- ── 4. IPs DISTINTAS QUE VOTARON (post-sql/38) ──────────────────────
-- Requiere que sql/38 ya esté corrido.
-- Un ataque distribuido usa muchas IPs distintas — mira el total y
-- la velocidad: muchas IPs en pocos minutos = botnet.

SELECT
    ronda,
    count(*)                  AS votos_totales,
    count(distinct ip_hash)   AS ips_distintas,
    count(distinct voter_token) AS tokens_distintos,
    min(creado)               AS inicio,
    max(creado)               AS fin,
    max(creado) - min(creado) AS duracion
FROM din_votos_ratelimit
WHERE portal = 'entrenamientos'
  AND tipo   = 'encuesta'
GROUP BY ronda
ORDER BY ronda DESC;


-- ── 5. CONCENTRACIÓN DE VOTOS POR MINUTO (post-sql/38) ──────────────
-- Combina IPs y tiempo para ver si fue una botnet coordinada.

SELECT
    date_trunc('minute', creado)   AS minuto,
    count(*)                       AS votos,
    count(distinct ip_hash)        AS ips_distintas
FROM din_votos_ratelimit
WHERE portal = 'entrenamientos'
  AND tipo   = 'encuesta'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20;


-- ── 6. INTENTOS RECHAZADOS (post-sql/39) ────────────────────────────
-- Requiere que sql/39_din_rechazos.sql esté corrido.
-- Muestra cuántos intentos de voto duplicado se bloquearon y de dónde.

SELECT
    motivo,
    count(*)          AS intentos_bloqueados,
    min(creado)       AS primer_intento,
    max(creado)       AS ultimo_intento
FROM din_rechazos
WHERE portal = 'entrenamientos'
  AND tipo   = 'encuesta'
GROUP BY motivo
ORDER BY 2 DESC;


-- ── 7. HISTORIAL: resultados de encuestas anteriores ─────────────────
-- Ver si los resultados de una ronda pasada lucen anómalos.

SELECT
    id,
    cerrado,
    ronda,
    total_votos,
    config->>'pregunta' AS pregunta,
    resultados,
    archivado_por
FROM din_historial
WHERE portal = 'entrenamientos'
  AND tipo   = 'encuesta'
ORDER BY cerrado DESC;
