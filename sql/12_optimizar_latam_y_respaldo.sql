-- =====================================================================
--  PUMAS GAMING · 12 · LATAM calculado en la base + respaldo
--  Requiere 08 y 02. Se puede correr las veces que quieras.
--
--  ANTES: cada visita a Entrenos LATAM descargaba TODAS las filas y el
--         navegador calculaba los rankings (MB por visita al crecer).
--  AHORA: la base calcula y manda solo el resultado:
--         index ≈ 3 KB · portal LATAM ≈ 40 KB, sin importar cuántos entrenos haya.
--  Misma fórmula de siempre:
--    PR = PG ÷ sesiones (entero) · orden PR → booyah → PG
--    KDA = kills ÷ salas · orden KDA → kills
--  Semana: ISO (lunes a domingo) en hora de Colombia; si la semana actual
--  no tiene entrenos, se usa la última semana con datos.
-- =====================================================================

-- 1) Equipos agregados (por portal opcional y rango de fechas opcional)
create or replace function public._latam_equipos(p_portal text, p_desde date, p_hasta date)
returns table (equipo text, ses int, b int, k int, pts int, pr int, entrenos int, part jsonb)
language sql stable
set search_path = public
as $$
    with e as (
        select v.*, lower(trim(v.equipo)) as kk from v_latam_equipos v
         where (p_portal is null or v.portal = p_portal)
           and (p_desde is null or (v.fecha at time zone 'America/Bogota')::date >= p_desde)
           and (p_hasta is null or (v.fecha at time zone 'America/Bogota')::date <= p_hasta)
    ),
    -- sesiones por entreno de cada equipo → {"row": 2, "zmf": 1}
    pp as (
        select z.kk, jsonb_object_agg(z.portal, z.n) as part
          from (select e.kk, e.portal, count(*)::int as n from e group by e.kk, e.portal) z
         group by z.kk
    ),
    t as (
        select e.kk,
               min(e.equipo)                    as equipo,
               count(*)::int                    as ses,
               coalesce(sum(e.booyahs), 0)::int as b,
               coalesce(sum(e.kills), 0)::int   as k,
               coalesce(sum(e.pts), 0)::int     as pts,
               count(distinct e.portal)::int    as entrenos
          from e group by e.kk
    )
    select t.equipo, t.ses, t.b, t.k, t.pts,
           round(t.pts::numeric / t.ses)::int,
           t.entrenos, pp.part
      from t left join pp on pp.kk = t.kk;
$$;

-- 2) Jugadores agregados
create or replace function public._latam_killers(p_portal text, p_desde date, p_hasta date)
returns table (jugador text, equipo text, k int, s int, kda numeric, part jsonb)
language sql stable
set search_path = public
as $$
    with x as (
        select v.*, lower(trim(v.jugador)) as kk from v_latam_killers v
         where (p_portal is null or v.portal = p_portal)
           and (p_desde is null or (v.fecha at time zone 'America/Bogota')::date >= p_desde)
           and (p_hasta is null or (v.fecha at time zone 'America/Bogota')::date <= p_hasta)
    ),
    pp as (
        select z.kk, jsonb_object_agg(z.portal, z.n) as part
          from (select x.kk, x.portal, count(*)::int as n from x group by x.kk, x.portal) z
         group by z.kk
    ),
    t as (
        select x.kk,
               min(x.jugador)                                 as jugador,
               (array_agg(x.equipo order by x.fecha desc))[1] as equipo,
               coalesce(sum(x.kills), 0)::int                 as k,
               coalesce(sum(x.salas), 0)::int                 as s
          from x group by x.kk
    )
    select t.jugador, t.equipo, t.k, t.s,
           round(t.k::numeric / t.s, 2),
           pp.part
      from t left join pp on pp.kk = t.kk
     where t.s > 0;
$$;

-- 3) Resumen LATAM listo para pintar
--    p_portal: null = todos · p_completo: false = solo lo del index (top 10 de la semana)
create or replace function public.latam_resumen(p_portal text default null, p_completo boolean default true)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
    lunes_act date := date_trunc('week', (now() at time zone 'America/Bogota'))::date;
    lunes     date;
    r         jsonb;
begin
    if exists (select 1 from v_latam_sesiones
                where (p_portal is null or portal = p_portal)
                  and (fecha at time zone 'America/Bogota')::date between lunes_act and lunes_act + 6) then
        lunes := lunes_act;
    else
        select date_trunc('week', max(fecha) at time zone 'America/Bogota')::date into lunes
          from v_latam_sesiones where p_portal is null or portal = p_portal;
    end if;
    lunes := coalesce(lunes, lunes_act);

    r := jsonb_build_object(
        'semana', jsonb_build_object('lunes', lunes, 'num', extract(week from lunes)::int, 'actual', lunes = lunes_act),
        'semana_equipos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, lunes, lunes + 6)
             order by pr desc, b desc, pts desc, equipo limit (case when p_completo then 50 else 10 end)) t),
        'semana_killers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_killers(p_portal, lunes, lunes + 6)
             order by kda desc, k desc limit 10) t)
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
            select * from _latam_killers(p_portal, null, null) order by kda desc, k desc limit 10) t),
        'letales', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, null, null) order by k desc, (k::numeric / ses) desc limit 5) t),
        'activos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_equipos(p_portal, null, null) order by ses desc, entrenos desc, pr desc limit 5) t),
        'jugadores', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from (
            select * from _latam_killers(p_portal, null, null) order by k desc, kda desc limit 5) t),
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

-- 4) Calendario: solo los entrenos del mes que se está viendo
create or replace function public.latam_calendario(p_portal text, p_desde date, p_hasta date)
returns jsonb
language sql stable
set search_path = public
as $$
    select coalesce(jsonb_agg(to_jsonb(t) order by t.fecha desc), '[]') from (
        select id, portal, titulo, jornada, fecha from v_latam_sesiones
         where (p_portal is null or portal = p_portal)
           and (fecha at time zone 'America/Bogota')::date between p_desde and p_hasta
         limit 500) t;
$$;

grant execute on function public._latam_equipos(text, date, date)  to anon, authenticated;
grant execute on function public._latam_killers(text, date, date)  to anon, authenticated;
grant execute on function public.latam_resumen(text, boolean)      to anon, authenticated;
grant execute on function public.latam_calendario(text, date, date) to anon, authenticated;


-- 5) RESPALDO (solo superadmin: rol con "gestionar") ----------------------
--    Devuelve todas las tablas en JSON. NO incluye contraseñas ni sesiones.
--    Las tablas que no existan se saltan sin error.
create or replace function public.admin_respaldo(p_token uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'gestionar')->>'usuario';
    tablas text[] := array[
        'portales', 'roles', 'usuarios_admin', 'portal_config',
        'portal_equipos', 'portal_sesiones', 'portal_salas', 'portal_killers', 'portal_programados', 'portal_cupos',
        'entrenamientos_sesiones', 'salas_resultados', 'top_killers', 'equipos_registrados',
        'entrenamientos_programados', 'registro_cupos'];
    t text;
    filas jsonb;
    datos jsonb := '{}';
    conteo jsonb := '{}';
begin
    foreach t in array tablas loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;
        execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from public.%I x', t) into filas;
        if t = 'usuarios_admin' then   -- nunca se exportan las contraseñas cifradas
            select coalesce(jsonb_agg(f - 'password'), '[]') into filas from jsonb_array_elements(filas) f;
        end if;
        datos := datos || jsonb_build_object(t, filas);
        conteo := conteo || jsonb_build_object(t, jsonb_array_length(filas));
    end loop;
    return jsonb_build_object(
        'respaldo', 'pumasgaming',
        'version', 1,
        'creado', now(),
        'creado_por', quien,
        'filas_por_tabla', conteo,
        'tablas', datos);
end $$;

grant execute on function public.admin_respaldo(uuid) to anon, authenticated;

-- Prueba rápida (debe devolver la semana y el top 10)
select latam_resumen(null, false);
