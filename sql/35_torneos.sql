-- =====================================================================
--  PUMAS GAMING · 35 · Torneos aliados
--  Soporta múltiples torneos por portal, carga de .log y tabla de resultados.
--  Se puede correr las veces que quieras (idempotente).
-- =====================================================================

-- 1) TABLAS -----------------------------------------------------------

-- Torneo principal
create table if not exists public.torneos (
    id              bigint generated always as identity primary key,
    portal          text references public.portales(id) on delete cascade,
    nombre          text        not null,
    juego           text        not null default 'free_fire',
    descripcion     text,
    fecha_inicio    timestamptz,
    fecha_fin       timestamptz,
    estado          text        not null default 'borrador'
                    check (estado in ('borrador','inscripciones','en_curso','finalizado')),
    config          jsonb       not null default '{}',
    -- config incluye: { formato, grupos, rondas, puntos_kill, puntos_posicion: [...], max_equipos }
    colores         jsonb       not null default '{}',
    -- colores: { primary, secondary, accent, bg }
    logo_url        text,
    banner_url      text,
    publico         boolean     not null default false,
    creado          timestamptz default now(),
    actualizado     timestamptz default now(),
    actualizado_por text
);

-- Equipos inscritos
create table if not exists public.torneos_equipos (
    id          bigint generated always as identity primary key,
    torneo_id   bigint not null references public.torneos(id) on delete cascade,
    nombre      text   not null,
    contacto    text,
    ig          text,
    seed        int,
    grupo       text,
    eliminado   boolean not null default false,
    metadata    jsonb   not null default '{}',
    creado      timestamptz default now()
);

-- Partidas / salas
create table if not exists public.torneos_partidas (
    id          bigint generated always as identity primary key,
    torneo_id   bigint not null references public.torneos(id) on delete cascade,
    fase        text   not null default 'grupos',
    -- fase: 'grupos' | 'cuartos' | 'semis' | 'final' | 'gran_final'
    ronda       int    not null default 1,
    sala        int,
    estado      text   not null default 'pendiente'
                check (estado in ('pendiente','en_curso','finalizado')),
    notas       text,
    creado      timestamptz default now()
);

-- Resultados por equipo en cada partida (llenado desde el .log)
create table if not exists public.torneos_resultados (
    id            bigint generated always as identity primary key,
    partida_id    bigint not null references public.torneos_partidas(id) on delete cascade,
    torneo_id     bigint not null references public.torneos(id) on delete cascade,
    equipo_id     bigint references public.torneos_equipos(id) on delete set null,
    equipo_nombre text   not null,
    posicion      int    not null default 0,
    kills         int    not null default 0,
    puntos        int    not null default 0,
    metadata      jsonb  not null default '{}'
    -- metadata: { boosts, daño, supervivencia, etc. }
);

create index if not exists torneos_resultados_torneo   on public.torneos_resultados(torneo_id);
create index if not exists torneos_resultados_partida  on public.torneos_resultados(partida_id);

-- Logs .log crudos subidos
create table if not exists public.torneos_logs (
    id              bigint generated always as identity primary key,
    torneo_id       bigint not null references public.torneos(id) on delete cascade,
    partida_id      bigint references public.torneos_partidas(id) on delete set null,
    nombre_archivo  text,
    contenido       text,    -- texto crudo del archivo .log
    procesado       boolean  not null default false,
    error_proceso   text,
    creado          timestamptz default now()
);

create index if not exists torneos_logs_torneo on public.torneos_logs(torneo_id);


-- 2) FUNCIONES PÚBLICAS -----------------------------------------------

-- Leer torneos públicos de un portal
create or replace function public.torneos_publico(p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    return coalesce(
        (select json_agg(
            json_build_object(
                'id',           t.id,
                'nombre',       t.nombre,
                'juego',        t.juego,
                'descripcion',  t.descripcion,
                'estado',       t.estado,
                'fecha_inicio', t.fecha_inicio,
                'fecha_fin',    t.fecha_fin,
                'config',       t.config,
                'colores',      t.colores,
                'logo_url',     t.logo_url,
                'banner_url',   t.banner_url
            ) order by t.fecha_inicio desc
        )
        from torneos t
        where (t.portal = p_portal or p_portal is null)
          and t.publico = true
          and t.estado != 'borrador'),
        '[]'::json
    );
end $$;

-- Leer tabla de posiciones de un torneo
create or replace function public.torneos_tabla(p_torneo_id bigint)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    v_config jsonb;
begin
    select config into v_config from torneos where id = p_torneo_id;
    if not found then return '[]'::json; end if;

    return coalesce(
        (select json_agg(row order by row.puntos_total desc, row.kills_total desc)
         from (
             select
                 coalesce(te.nombre, tr.equipo_nombre) as nombre,
                 te.ig,
                 count(distinct tr.partida_id)         as partidas,
                 sum(tr.kills)                         as kills_total,
                 sum(tr.puntos)                        as puntos_total,
                 min(tr.posicion) filter (where tr.posicion > 0) as mejor_posicion
             from torneos_resultados tr
             left join torneos_equipos te on te.id = tr.equipo_id
             where tr.torneo_id = p_torneo_id
             group by coalesce(te.nombre, tr.equipo_nombre), te.ig
         ) row),
        '[]'::json
    );
end $$;


-- 3) FUNCIONES ADMIN --------------------------------------------------

-- Crear o actualizar un torneo
create or replace function public.torneos_admin_guardar(
    p_token      uuid,
    p_portal     text,
    p_id         bigint  default null,
    p_nombre     text    default null,
    p_juego      text    default 'free_fire',
    p_descripcion text   default null,
    p_fecha_inicio timestamptz default null,
    p_fecha_fin    timestamptz default null,
    p_estado     text    default 'borrador',
    p_config     jsonb   default '{}',
    p_colores    jsonb   default '{}',
    p_logo_url   text    default null,
    p_banner_url text    default null,
    p_publico    boolean default false
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    nuevo_id bigint;
begin
    if p_id is not null then
        update torneos set
            nombre        = coalesce(p_nombre, nombre),
            juego         = coalesce(p_juego, juego),
            descripcion   = p_descripcion,
            fecha_inicio  = p_fecha_inicio,
            fecha_fin     = p_fecha_fin,
            estado        = coalesce(p_estado, estado),
            config        = coalesce(p_config, config),
            colores       = coalesce(p_colores, colores),
            logo_url      = p_logo_url,
            banner_url    = p_banner_url,
            publico       = coalesce(p_publico, publico),
            actualizado   = now(),
            actualizado_por = ses->>'usuario'
        where id = p_id and portal = p_portal
        returning id into nuevo_id;
        if not found then raise exception 'Torneo no encontrado'; end if;
    else
        if p_nombre is null then raise exception 'El nombre es requerido'; end if;
        insert into torneos (portal, nombre, juego, descripcion, fecha_inicio, fecha_fin,
                             estado, config, colores, logo_url, banner_url, publico, actualizado_por)
        values (p_portal, p_nombre, p_juego, p_descripcion, p_fecha_inicio, p_fecha_fin,
                coalesce(p_estado,'borrador'), coalesce(p_config,'{}'), coalesce(p_colores,'{}'),
                p_logo_url, p_banner_url, coalesce(p_publico,false), ses->>'usuario')
        returning id into nuevo_id;
    end if;
    return json_build_object('ok', true, 'id', nuevo_id);
end $$;

-- Listar torneos (admin)
create or replace function public.torneos_admin_listar(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return coalesce(
        (select json_agg(t order by t.creado desc)
         from torneos t where t.portal = p_portal),
        '[]'::json
    );
end $$;

-- Borrar torneo
create or replace function public.torneos_admin_borrar(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from torneos where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Guardar resultado de una partida (desde el .log procesado)
create or replace function public.torneos_admin_resultado(
    p_token     uuid,
    p_portal    text,
    p_torneo_id bigint,
    p_partida_id bigint,
    p_resultados jsonb  -- array de { equipo_nombre, posicion, kills, puntos, metadata? }
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    r   jsonb;
    eid bigint;
begin
    -- Verificar que el torneo pertenece al portal
    if not exists (select 1 from torneos where id = p_torneo_id and portal = p_portal) then
        raise exception 'Torneo no encontrado en este portal';
    end if;
    -- Limpiar resultados anteriores de esta partida
    delete from torneos_resultados where partida_id = p_partida_id;
    -- Insertar nuevos resultados
    for r in select * from jsonb_array_elements(p_resultados) loop
        select id into eid from torneos_equipos
        where torneo_id = p_torneo_id
          and lower(nombre) = lower(r->>'equipo_nombre')
        limit 1;
        insert into torneos_resultados
            (partida_id, torneo_id, equipo_id, equipo_nombre, posicion, kills, puntos, metadata)
        values (
            p_partida_id, p_torneo_id, eid,
            r->>'equipo_nombre',
            coalesce((r->>'posicion')::int, 0),
            coalesce((r->>'kills')::int, 0),
            coalesce((r->>'puntos')::int, 0),
            coalesce(r->'metadata', '{}')
        );
    end loop;
    -- Marcar partida como finalizada
    update torneos_partidas set estado = 'finalizado' where id = p_partida_id;
    return json_build_object('ok', true);
end $$;

-- Guardar log crudo (.log) para procesamiento posterior
create or replace function public.torneos_admin_log(
    p_token     uuid,
    p_portal    text,
    p_torneo_id bigint,
    p_partida_id bigint default null,
    p_nombre    text   default null,
    p_contenido text   default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    nuevo_id bigint;
begin
    if not exists (select 1 from torneos where id = p_torneo_id and portal = p_portal) then
        raise exception 'Torneo no encontrado';
    end if;
    insert into torneos_logs (torneo_id, partida_id, nombre_archivo, contenido)
    values (p_torneo_id, p_partida_id, p_nombre, p_contenido)
    returning id into nuevo_id;
    return json_build_object('ok', true, 'id', nuevo_id);
end $$;


-- 4) GRANTS -----------------------------------------------------------

grant execute on function public.torneos_publico(text)                                                                                  to anon, authenticated;
grant execute on function public.torneos_tabla(bigint)                                                                                   to anon, authenticated;
grant execute on function public.torneos_admin_guardar(uuid,text,bigint,text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,text,text,boolean) to anon, authenticated;
grant execute on function public.torneos_admin_listar(uuid, text)                                                                        to anon, authenticated;
grant execute on function public.torneos_admin_borrar(uuid, text, bigint)                                                                to anon, authenticated;
grant execute on function public.torneos_admin_resultado(uuid, text, bigint, bigint, jsonb)                                              to anon, authenticated;
grant execute on function public.torneos_admin_log(uuid, text, bigint, bigint, text, text)                                               to anon, authenticated;
