-- =====================================================================
--  PUMAS GAMING · 09 · Guardar entrenos y corregirlos
--  Requiere 02, 03, 07 y 08. Se puede correr las veces que quieras.
--
--  · guardar_entreno: lo usa el botón "Cargar a la base de datos" de cada
--    herramienta (QFD, ROW, Rusheo, ZMF, Dragon Fest). Solo puede guardar
--    quien tenga acceso a ESE portal.
--  · admin_*: solo superadmin (rol con "gestionar"): listar, borrar un
--    entreno y corregir el nombre de un equipo, en cualquier portal,
--    incluido Pumas (entrenamientos).
--  Las tablas no tienen permisos de escritura públicos: todo pasa por
--  estas funciones, que revisan la sesión del usuario.
-- =====================================================================

-- 1) GUARDAR UN ENTRENO ----------------------------------------------------
--    p_salas:   [{numero_sala, equipo_nombre, rank, kill_score, rank_score, total_score, es_booyah}]
--    p_killers: [{jugador_nombre, equipo_nombre, kills, salas}]   (1 por jugador)
create or replace function public.guardar_entreno(
    p_token uuid, p_portal text, p_titulo text, p_jornada text,
    p_fecha timestamptz, p_moderador text, p_salas jsonb, p_killers jsonb
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    nuevo bigint;
begin
    if not exists (select 1 from portales where id = p_portal and latam) or p_portal = 'entrenamientos' then
        raise exception 'Portal no válido para guardar: %', p_portal;
    end if;
    if jsonb_typeof(p_salas) <> 'array' or jsonb_array_length(p_salas) = 0 then
        raise exception 'No hay resultados para guardar';
    end if;
    if jsonb_array_length(p_salas) > 3000 or jsonb_array_length(coalesce(p_killers, '[]')) > 3000 then
        raise exception 'Demasiados datos en un solo entreno';
    end if;
    if exists (select 1 from portal_sesiones
                where portal = p_portal and titulo = trim(p_titulo) and fecha = p_fecha) then
        raise exception 'Este entreno ya está guardado (mismo título y fecha)';
    end if;

    insert into portal_sesiones (portal, titulo, jornada, fecha, moderador, creado_por)
    values (p_portal, left(trim(p_titulo), 120), left(nullif(trim(p_jornada), ''), 60),
            coalesce(p_fecha, now()), left(nullif(trim(p_moderador), ''), 60), quien)
    returning id into nuevo;

    insert into portal_salas (sesion_id, numero_sala, equipo_nombre, rank, kill_score, rank_score, total_score, es_booyah)
    select nuevo,
           (x->>'numero_sala')::smallint,
           left(trim(x->>'equipo_nombre'), 60),
           nullif(x->>'rank', '')::smallint,
           coalesce((x->>'kill_score')::smallint, 0),
           coalesce((x->>'rank_score')::smallint, 0),
           coalesce((x->>'total_score')::smallint, 0),
           coalesce((x->>'es_booyah')::boolean, false)
      from jsonb_array_elements(p_salas) x
     where coalesce(trim(x->>'equipo_nombre'), '') <> '';

    insert into portal_killers (sesion_id, jugador_nombre, equipo_nombre, kills, salas)
    select nuevo,
           left(trim(x->>'jugador_nombre'), 60),
           left(trim(x->>'equipo_nombre'), 60),
           coalesce((x->>'kills')::smallint, 0),
           greatest(coalesce((x->>'salas')::smallint, 1), 1)
      from jsonb_array_elements(coalesce(p_killers, '[]')) x
     where coalesce(trim(x->>'jugador_nombre'), '') <> '';

    return json_build_object('ok', true, 'id', nuevo);
end $$;


-- 2) SUPERADMIN: LISTAR ENTRENOS DE UN PORTAL -------------------------------
create or replace function public.admin_entrenos(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if p_portal = 'entrenamientos' then
        return coalesce((
            select json_agg(t order by t.fecha desc) from (
                select es.id::text as id, es.titulo, es.jornada, es.fecha, es.moderador,
                       (select count(distinct lower(trim(sr.equipo_nombre))) from salas_resultados sr where sr.sesion_id = es.id) as equipos,
                       (select count(distinct sr.numero_sala) from salas_resultados sr where sr.sesion_id = es.id) as salas
                  from entrenamientos_sesiones es
                 order by es.fecha desc limit 300) t), '[]'::json);
    end if;
    return coalesce((
        select json_agg(t order by t.fecha desc) from (
            select s.id::text as id, s.titulo, s.jornada, s.fecha, s.moderador,
                   (select count(distinct lower(trim(sa.equipo_nombre))) from portal_salas sa where sa.sesion_id = s.id) as equipos,
                   (select count(distinct sa.numero_sala) from portal_salas sa where sa.sesion_id = s.id) as salas
              from portal_sesiones s
             where s.portal = p_portal
             order by s.fecha desc limit 300) t), '[]'::json);
end $$;

-- Equipos de un portal (para elegir cuál corregir)
create or replace function public.admin_equipos_portal(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if p_portal = 'entrenamientos' then
        return coalesce((select json_agg(t order by lower(t.equipo)) from (
            select min(sr.equipo_nombre) as equipo, count(distinct sr.sesion_id) as entrenos
              from salas_resultados sr group by lower(trim(sr.equipo_nombre))) t), '[]'::json);
    end if;
    return coalesce((select json_agg(t order by lower(t.equipo)) from (
        select min(sa.equipo_nombre) as equipo, count(distinct sa.sesion_id) as entrenos
          from portal_salas sa join portal_sesiones s on s.id = sa.sesion_id
         where s.portal = p_portal
         group by lower(trim(sa.equipo_nombre))) t), '[]'::json);
end $$;


-- 3) SUPERADMIN: BORRAR UN ENTRENO ------------------------------------------
create or replace function public.admin_borrar_entreno(p_token uuid, p_portal text, p_sesion text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    n int;
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if p_portal = 'entrenamientos' then
        delete from top_killers      where sesion_id::text = p_sesion;
        delete from salas_resultados where sesion_id::text = p_sesion;
        delete from entrenamientos_sesiones where id::text = p_sesion;
    else
        delete from portal_sesiones where id::text = p_sesion and portal = p_portal;  -- salas y killers se borran solos (cascade)
    end if;
    get diagnostics n = row_count;
    if n = 0 then
        raise exception 'No se encontró ese entreno en %', p_portal;
    end if;
    return json_build_object('ok', true);
end $$;


-- 4) SUPERADMIN: CORREGIR EL NOMBRE DE UN EQUIPO ------------------------------
--    En todos los entrenos del portal, o solo en uno (p_sesion).
--    Si el nombre nuevo ya existe, ambos quedan unidos como un solo equipo.
create or replace function public.admin_renombrar_equipo(
    p_token uuid, p_portal text, p_viejo text, p_nuevo text, p_sesion text default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    nuevo text := left(trim(p_nuevo), 60);
    filas int := 0;
    n int;
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if coalesce(nuevo, '') = '' then
        raise exception 'Escribe el nombre correcto';
    end if;
    if p_portal = 'entrenamientos' then
        update salas_resultados set equipo_nombre = nuevo
         where lower(trim(equipo_nombre)) = lower(trim(p_viejo)) and (p_sesion is null or sesion_id::text = p_sesion);
        get diagnostics n = row_count; filas := filas + n;
        update top_killers set equipo_nombre = nuevo
         where lower(trim(equipo_nombre)) = lower(trim(p_viejo)) and (p_sesion is null or sesion_id::text = p_sesion);
    else
        update portal_salas sa set equipo_nombre = nuevo
          from portal_sesiones s
         where s.id = sa.sesion_id and s.portal = p_portal
           and lower(trim(sa.equipo_nombre)) = lower(trim(p_viejo))
           and (p_sesion is null or s.id::text = p_sesion);
        get diagnostics n = row_count; filas := filas + n;
        update portal_killers k set equipo_nombre = nuevo
          from portal_sesiones s
         where s.id = k.sesion_id and s.portal = p_portal
           and lower(trim(k.equipo_nombre)) = lower(trim(p_viejo))
           and (p_sesion is null or s.id::text = p_sesion);
    end if;
    if filas = 0 then
        raise exception 'No se encontró el equipo "%" en %', p_viejo, p_portal;
    end if;
    return json_build_object('ok', true, 'salas', filas);
end $$;

grant execute on function public.guardar_entreno(uuid, text, text, text, timestamptz, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.admin_entrenos(uuid, text)                                to anon, authenticated;
grant execute on function public.admin_equipos_portal(uuid, text)                          to anon, authenticated;
grant execute on function public.admin_borrar_entreno(uuid, text, text)                    to anon, authenticated;
grant execute on function public.admin_renombrar_equipo(uuid, text, text, text, text)      to anon, authenticated;

select 'listo' as estado;
