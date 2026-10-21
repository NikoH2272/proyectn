-- =====================================================================
--  PUMAS GAMING · 29 · Entrenos: siempre la semana ACTUAL
--  Requiere 15. Se puede correr las veces que quieras.
--
--  · La semana sigue yendo de LUNES a DOMINGO, hora Colombia.
--  · Siempre muestra la semana ACTUAL: si todavía no hay entrenos esa semana,
--    sale vacía con un aviso (antes seguía mostrando la última semana con datos).
--  · Aplica a Entrenos LATAM y a la tabla de la semana de cada portal de entrenos.
--  · Los resultados de Entrenos Pumas siguen entrando a LATAM igual que antes.
-- =====================================================================

create or replace function public.latam_resumen(p_portal text default null, p_completo boolean default true)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
    -- La semana va de LUNES a DOMINGO (hora Colombia) y siempre es la actual,
    -- aunque todavía no tenga entrenos (antes saltaba a la última semana con datos).
    lunes     date := date_trunc('week', (now() at time zone 'America/Bogota'))::date;
    r         jsonb;
    min_salas constant int := 3;   -- mínimo de salas jugadas para entrar a los top killers
begin
    r := jsonb_build_object(
        'semana', jsonb_build_object('lunes', lunes, 'inicio', lunes, 'fin', lunes + 6, 'num', extract(week from lunes)::int, 'actual', true),
        'semana_equipos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, lunes, lunes + 6)
             order by pr desc, b desc, pts desc, equipo limit (case when p_completo then 50 else 10 end)) t),
        'semana_killers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_killers(p_portal, lunes, lunes + 6) where s >= min_salas
             order by kda desc, k desc limit 10) t),
        'semana_killers_kills', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_killers(p_portal, lunes, lunes + 6) where s >= min_salas
             order by k desc, kda desc limit 10) t)
    );
    if not p_completo then
        return r;
    end if;

    return r || jsonb_build_object(
        'stats', jsonb_build_object(
            'entrenos', (select count(*) from v_latam_sesiones where p_portal is null or portal = p_portal),
            'equipos',  (select count(*) from _latam_equipos(p_portal, null, null)),
            'kills',    (select coalesce(sum(kills), 0) from v_latam_killers where p_portal is null or portal = p_portal),
            'mapas',    (select coalesce(sum(m), 0) from (select max(salas) as m from v_latam_equipos
                          where p_portal is null or portal = p_portal group by portal, sesion_id) z)),
        'historico', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, null, null) order by pr desc, b desc, pts desc, equipo limit 100) t),
        'killers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_killers(p_portal, null, null) where s >= min_salas order by kda desc, k desc limit 10) t),
        'killers_kills', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_killers(p_portal, null, null) where s >= min_salas order by k desc, kda desc limit 10) t),
        'letales', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, null, null) order by k desc, (k::numeric / ses) desc limit 5) t),
        'activos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, null, null) order by ses desc, entrenos desc, pr desc limit 5) t),
        'jugadores', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_killers(p_portal, null, null) where s >= min_salas order by k desc, kda desc limit 5) t),
        'top_booyah', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, null, null) where b > 0 order by b desc, pr desc, pts desc limit 5) t),
        'individuales', (select coalesce(jsonb_object_agg(p.id, jsonb_build_object(
                'entrenos', (select count(*) from v_latam_sesiones s where s.portal = p.id),
                'top', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
                    select * from _latam_equipos(p.id, null, null) order by pr desc, b desc, pts desc, equipo limit 10) t))), '{}')
            from portales p where p.latam and (p_portal is null or p.id = p_portal)),
        'ultimos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select id, portal, titulo, jornada, fecha from v_latam_sesiones
             where p_portal is null or portal = p_portal order by fecha desc limit 8) t)
    );
end $$;
