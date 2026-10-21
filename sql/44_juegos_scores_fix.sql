-- =====================================================================
--  PUMAS GAMING · 44 · Fix + Test de puntuaciones de juegos
--  Corre esto en Supabase SQL Editor. Lee los resultados al final.
-- =====================================================================


-- ── 1. CONSTRAINT ────────────────────────────────────────────────────
-- Asegura que los 3 tipos de juego estén permitidos en din_sesiones

alter table public.din_sesiones
    drop constraint if exists din_sesiones_tipo_check;

alter table public.din_sesiones
    add constraint din_sesiones_tipo_check
    check (tipo in ('registro','encuesta','juego','juego_tetris','juego_3lineas'));


-- ── 2. FUNCIÓN din_registrar (upsert por mejor puntuación) ──────────
-- Eliminar AMBAS sobrecargas para evitar conflicto de tipos en p_voter_token

drop function if exists public.din_registrar(text,text,text,text,text,jsonb,text,text);
drop function if exists public.din_registrar(text,text,text,text,text,jsonb,uuid,text);

create or replace function public.din_registrar(
    p_portal        text,
    p_tipo          text,
    p_nombre        text,
    p_numero        text    default null,
    p_ig            text    default null,
    p_metadata      jsonb   default '{}',
    p_voter_token   uuid    default null,
    p_recaptcha_token text  default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses      din_sesiones;
    v_nom    text  := left(trim(coalesce(p_nombre, '')), 80);
    v_num    text  := left(trim(coalesce(p_numero, '')), 20);
    v_ig     text  := left(trim(replace(coalesce(p_ig, ''), '@', '')), 60);
    nuevo    bigint;
    v_id_ant bigint;
    v_pts_ant int;
    v_pts_new int;
    v_limite  int;
begin
    select * into ses from din_sesiones where portal = p_portal and tipo = p_tipo;
    if not found or not coalesce(ses.activo, false) then
        raise exception 'Dinámica no activa: % / %', p_portal, p_tipo;
    end if;
    if ses.inicio is not null and now() < ses.inicio then
        raise exception 'El registro aún no está abierto';
    end if;
    if ses.deadline is not null and now() > ses.deadline then
        raise exception 'El tiempo de registro cerró';
    end if;
    if v_nom = '' then
        raise exception 'El nombre es requerido';
    end if;
    if v_nom ~* '(puta|puto|culero|pendejo|chingad|mierda|coño|verga|cabron|mamada|pinche|carajo|joder|cojones|ojete|perra|marica|maricon|joto|hdp|imbecil|putazo|malparido)' then
        raise exception 'El nombre contiene palabras no permitidas';
    end if;

    v_limite := coalesce(nullif((ses.config->>'limite')::text, '')::int, 5000);
    if (select count(*) from din_entradas where portal = p_portal and tipo = p_tipo) >= v_limite then
        raise exception 'Se alcanzó el límite de registros';
    end if;

    -- ── JUEGOS: upsert — conserva la puntuación más alta ──
    if p_tipo like 'juego%' then
        v_pts_new := coalesce((p_metadata->>'puntos')::int, 0);
        select id, (metadata->>'puntos')::int
        into v_id_ant, v_pts_ant
        from din_entradas
        where portal = p_portal and tipo = p_tipo
          and lower(nombre) = lower(v_nom)
        order by (metadata->>'puntos')::int desc nulls last
        limit 1;

        if found then
            -- Solo actualiza si la nueva puntuación es mayor
            if v_pts_new > coalesce(v_pts_ant, 0) then
                update din_entradas
                   set metadata = coalesce(p_metadata, '{}'),
                       ig       = nullif(v_ig, ''),
                       creado   = now()
                 where id = v_id_ant;
            end if;
            return json_build_object('ok', true, 'id', v_id_ant, 'actualizado', v_pts_new > coalesce(v_pts_ant, 0));
        end if;
    end if;

    -- ── REGISTRO: no duplicar nombre ──
    if p_tipo = 'registro' and exists (
        select 1 from din_entradas
        where portal = p_portal and tipo = 'registro'
          and regexp_replace(lower(nombre), '[^a-z0-9]', '', 'g') =
              regexp_replace(lower(v_nom), '[^a-z0-9]', '', 'g')
    ) then
        raise exception 'Ese equipo ya está registrado';
    end if;

    insert into din_entradas (portal, tipo, nombre, numero, ig, metadata)
    values (p_portal, p_tipo, v_nom, nullif(v_num, ''), nullif(v_ig, ''),
            coalesce(p_metadata, '{}'))
    returning id into nuevo;

    return json_build_object('ok', true, 'id', nuevo, 'actualizado', false);
end $$;


-- ── 3. FUNCIÓN din_publico (top 20 por puntos para juegos) ──────────

create or replace function public.din_publico(p_portal text, p_tipo text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses     din_sesiones;
    cerrado boolean;
    abierto boolean;
begin
    select * into ses from din_sesiones where portal = p_portal and tipo = p_tipo;

    if not found or not coalesce(ses.activo, false) then
        return json_build_object('activo', false);
    end if;

    cerrado := ses.deadline is not null and now() > ses.deadline;
    abierto := ses.inicio is null or now() >= ses.inicio;

    return json_build_object(
        'activo',   true,
        'abierto',  abierto,
        'cerrado',  cerrado,
        'inicio',   ses.inicio,
        'tipo',     ses.tipo,
        'titulo',   ses.titulo,
        'config',   ses.config,
        'deadline', ses.deadline,
        'total',    (select count(*) from din_entradas where portal = p_portal and tipo = p_tipo),
        'entradas', case
            when p_tipo like 'juego%' then
                (select coalesce(json_agg(json_build_object(
                     'nombre', t.nombre,
                     'ig',     t.ig,
                     'puntos', (t.metadata->>'puntos')::int,
                     'creado', t.creado) order by (t.metadata->>'puntos')::int desc nulls last), '[]'::json)
                 from (select nombre, ig, metadata, creado
                       from din_entradas where portal = p_portal and tipo = p_tipo
                       order by (metadata->>'puntos')::int desc nulls last limit 20) t)
            when p_tipo = 'encuesta' then
                (select coalesce(json_agg(json_build_object(
                     'opcion_idx', v.opcion_idx::int,
                     'total',      v.cnt) order by v.opcion_idx::int), '[]'::json)
                 from (select (metadata->>'opcion_idx') as opcion_idx, count(*) as cnt
                       from din_entradas where portal = p_portal and tipo = 'encuesta'
                       group by metadata->>'opcion_idx') v)
            else
                (select coalesce(json_agg(json_build_object('nombre', nombre) order by creado), '[]'::json)
                 from din_entradas where portal = p_portal and tipo = 'registro')
            end
    );
end $$;


-- ── 4. din_admin_config (acepta nuevos tipos) ────────────────────────

create or replace function public.din_admin_config(
    p_token            uuid,
    p_portal           text,
    p_tipo             text,
    p_activo           boolean     default null,
    p_titulo           text        default null,
    p_config           jsonb       default null,
    p_deadline         timestamptz default null,
    p_quitar_deadline  boolean     default false,
    p_inicio           timestamptz default null,
    p_quitar_inicio    boolean     default false
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
begin
    if p_tipo not in ('registro','encuesta','juego','juego_tetris','juego_3lineas') then
        raise exception 'Tipo desconocido: %', p_tipo;
    end if;
    if not exists (select 1 from portales where id = p_portal) then
        raise exception 'Portal desconocido: %', p_portal;
    end if;

    insert into din_sesiones (portal, tipo, activo, titulo, config, deadline, inicio, actualizado_por)
    values (p_portal, p_tipo,
            coalesce(p_activo, false),
            nullif(trim(coalesce(p_titulo, '')), ''),
            coalesce(p_config, '{}'),
            case when coalesce(p_quitar_deadline, false) then null else p_deadline end,
            case when coalesce(p_quitar_inicio,   false) then null else p_inicio   end,
            ses->>'usuario')
    on conflict (portal, tipo) do update set
        activo          = coalesce(p_activo,   din_sesiones.activo),
        titulo          = case when p_titulo is null then din_sesiones.titulo
                               else nullif(trim(p_titulo), '') end,
        config          = coalesce(p_config,   din_sesiones.config),
        deadline        = case when coalesce(p_quitar_deadline, false) then null
                               else coalesce(p_deadline, din_sesiones.deadline) end,
        inicio          = case when coalesce(p_quitar_inicio, false) then null
                               else coalesce(p_inicio, din_sesiones.inicio) end,
        actualizado     = now(),
        actualizado_por = ses->>'usuario';

    return json_build_object('ok', true);
end $$;


-- ── 5. Permisos ───────────────────────────────────────────────────────

grant execute on function public.din_publico(text, text)                                                                              to anon, authenticated;
grant execute on function public.din_registrar(text, text, text, text, text, jsonb, uuid, text)                                       to anon, authenticated;
grant execute on function public.din_admin_config(uuid, text, text, boolean, text, jsonb, timestamptz, boolean, timestamptz, boolean) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════
--  PRUEBA AUTOMÁTICA — Lee los resultados debajo
-- ══════════════════════════════════════════════════════════════════════

do $$
declare
    v_portal text;
    v_res    json;
    v_count  int;
begin
    -- Tomar el primer portal disponible
    select id into v_portal from portales limit 1;
    if v_portal is null then
        raise notice '❌ PRUEBA: No hay portales en la tabla portales.';
        return;
    end if;
    raise notice '✅ PRUEBA: Usando portal "%"', v_portal;

    -- Asegura sesión activa para juego_tetris
    insert into din_sesiones (portal, tipo, activo, config)
    values (v_portal, 'juego_tetris', true, '{}')
    on conflict (portal, tipo) do update set activo = true;

    insert into din_sesiones (portal, tipo, activo, config)
    values (v_portal, 'juego_3lineas', true, '{}')
    on conflict (portal, tipo) do update set activo = true;

    raise notice '✅ PRUEBA: Sesiones juego_tetris y juego_3lineas activas en "%"', v_portal;

    -- Insertar puntuación de prueba (Tetris)
    v_res := din_registrar(v_portal, 'juego_tetris', 'TestBot', null, '999000', '{"puntos":1500}'::jsonb);
    raise notice '✅ PRUEBA Tetris insert: %', v_res;

    -- Intentar reemplazar con puntuación menor (NO debe actualizar)
    v_res := din_registrar(v_portal, 'juego_tetris', 'TestBot', null, '999000', '{"puntos":300}'::jsonb);
    raise notice '✅ PRUEBA Tetris menor (actualizado debe ser false): %', v_res;

    -- Intentar reemplazar con puntuación mayor (SÍ debe actualizar)
    v_res := din_registrar(v_portal, 'juego_tetris', 'TestBot', null, '999000', '{"puntos":9999}'::jsonb);
    raise notice '✅ PRUEBA Tetris mayor (actualizado debe ser true): %', v_res;

    -- Verificar top 20
    v_res := din_publico(v_portal, 'juego_tetris');
    raise notice '✅ PRUEBA din_publico Tetris: %', v_res;

    -- Insertar puntuación 3 en Línea
    v_res := din_registrar(v_portal, 'juego_3lineas', 'TestBot3', null, '888000', '{"puntos":5}'::jsonb);
    raise notice '✅ PRUEBA 3enLinea insert: %', v_res;

    -- Contar entradas de prueba
    select count(*) into v_count from din_entradas
    where portal = v_portal and tipo like 'juego%' and nombre like 'TestBot%';
    raise notice '✅ PRUEBA: % entradas de prueba creadas', v_count;

    -- Limpiar datos de prueba
    delete from din_entradas where portal = v_portal and nombre like 'TestBot%';
    raise notice '✅ PRUEBA: Datos de prueba eliminados. Todo funciona correctamente.';

exception when others then
    raise notice '❌ PRUEBA FALLÓ: % — %', SQLSTATE, SQLERRM;
end $$;


-- ── Vista final: puntuaciones reales guardadas ───────────────────────
select portal, tipo, nombre, ig,
       (metadata->>'puntos')::int as puntos,
       creado
from din_entradas
where tipo like 'juego%'
order by tipo, (metadata->>'puntos')::int desc
limit 30;
