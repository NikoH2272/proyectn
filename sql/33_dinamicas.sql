-- =====================================================================
--  PUMAS GAMING · 33 · Dinámicas por portal
--  Registro de equipos, encuestas y puntuaciones del juego retro.
--  Requiere 01 a 17. Se puede correr las veces que quieras.
--
--  · din_sesiones  — estado de cada dinámica por portal
--  · din_entradas  — registros, votos y scores (campo metadata diferencia)
--
--  Registro:   metadata = {}
--  Encuesta:   metadata = {"opcion_idx": 2}
--  Juego:      metadata = {"puntos": 350}
-- =====================================================================

-- 1) TABLAS -----------------------------------------------------------

create table if not exists public.din_sesiones (
    portal          text        not null references public.portales(id) on delete cascade,
    tipo            text        not null check (tipo in ('registro', 'encuesta', 'juego')),
    activo          boolean     not null default false,
    titulo          text,
    config          jsonb       not null default '{}',
    deadline        timestamptz,
    actualizado     timestamptz default now(),
    actualizado_por text,
    primary key (portal, tipo)
);

create table if not exists public.din_entradas (
    id       bigint  generated always as identity primary key,
    portal   text    not null,
    tipo     text    not null,
    nombre   text    not null,
    numero   text,
    ig       text,
    metadata jsonb   not null default '{}',
    creado   timestamptz default now()
);

create index if not exists din_entradas_portal_tipo on public.din_entradas(portal, tipo);

alter table public.din_sesiones add column if not exists inicio timestamptz;


-- 2) FUNCIÓN PÚBLICA: leer estado -------------------------------------
-- Devuelve config + lista (sin datos sensibles) o null si no activo.

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
        'entradas', case when p_tipo = 'juego' then
            -- juego: top 20 — solo nombre y puntos (WhatsApp/FF no expuesto)
            (select coalesce(json_agg(json_build_object(
                 'nombre', t.nombre,
                 'puntos', (t.metadata->>'puntos')::int,
                 'creado', t.creado)), '[]'::json)
             from (select nombre, metadata, creado
                   from din_entradas where portal = p_portal and tipo = 'juego'
                   order by (metadata->>'puntos')::int desc nulls last limit 20) t)
        when p_tipo = 'encuesta' then
            -- encuesta: conteo por opción
            (select coalesce(json_agg(json_build_object(
                 'opcion_idx', v.opcion_idx::int,
                 'total',      v.cnt) order by v.opcion_idx::int), '[]'::json)
             from (select (metadata->>'opcion_idx') as opcion_idx, count(*) as cnt
                   from din_entradas where portal = p_portal and tipo = 'encuesta'
                   group by metadata->>'opcion_idx') v)
        else
            -- registro: solo nombre público (ig/numero guardados pero no expuestos)
            (select coalesce(json_agg(json_build_object('nombre', nombre) order by creado), '[]'::json)
             from din_entradas where portal = p_portal and tipo = 'registro')
        end
    );
end $$;


-- 3) FUNCIÓN PÚBLICA: registrarse/votar/enviar puntuación -------------

create or replace function public.din_registrar(
    p_portal   text,
    p_tipo     text,
    p_nombre   text,
    p_numero   text    default null,
    p_ig       text    default null,
    p_metadata jsonb   default '{}'
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
begin
    select * into ses from din_sesiones where portal = p_portal and tipo = p_tipo;
    if not found or not coalesce(ses.activo, false) then
        raise exception 'Esta dinámica no está activa';
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
    if (select count(*) from din_entradas where portal = p_portal and tipo = p_tipo) >= 5000 then
        raise exception 'Se alcanzó el límite de registros';
    end if;

    -- Juego: upsert por nombre — conservar solo la puntuación más alta
    if p_tipo = 'juego' then
        v_pts_new := coalesce((p_metadata->>'puntos')::int, 0);
        select id, (metadata->>'puntos')::int
        into v_id_ant, v_pts_ant
        from din_entradas
        where portal = p_portal and tipo = 'juego'
          and lower(nombre) = lower(v_nom)
        order by (metadata->>'puntos')::int desc nulls last
        limit 1;
        if found then
            if v_pts_new > coalesce(v_pts_ant, 0) then
                update din_entradas
                   set metadata = coalesce(p_metadata, '{}'),
                       ig       = nullif(v_ig, ''),
                       creado   = now()
                 where id = v_id_ant;
            end if;
            return json_build_object('ok', true, 'id', v_id_ant);
        end if;
        -- No existe entrada previa → continúa con el INSERT normal
    end if;

    -- Registro: no duplicar el mismo nombre
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

    return json_build_object('ok', true, 'id', nuevo);
end $$;


-- 4) FUNCIÓN ADMIN: configurar una dinámica ---------------------------

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
    if p_tipo not in ('registro', 'encuesta', 'juego') then
        raise exception 'Tipo de dinámica desconocido: %', p_tipo;
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


-- 5) FUNCIÓN ADMIN: listar entradas -----------------------------------

create or replace function public.din_admin_listar(p_token uuid, p_portal text, p_tipo text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses din_sesiones;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    select * into ses from din_sesiones where portal = p_portal and tipo = p_tipo;
    return json_build_object(
        'sesion', case when found then row_to_json(ses) else null end,
        'entradas', (
            select coalesce(json_agg(json_build_object(
                'id', id, 'nombre', nombre, 'numero', numero, 'ig', ig,
                'metadata', metadata, 'creado', creado)
                order by creado desc), '[]'::json)
            from din_entradas where portal = p_portal and tipo = p_tipo
        )
    );
end $$;


-- 6) FUNCIÓN ADMIN: borrar una entrada --------------------------------

create or replace function public.din_admin_borrar(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from din_entradas where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;


-- 7) FUNCIÓN ADMIN: vaciar todas las entradas -------------------------

create or replace function public.din_admin_vaciar(p_token uuid, p_portal text, p_tipo text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare n int;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from din_entradas where portal = p_portal and tipo = p_tipo;
    get diagnostics n = row_count;
    return json_build_object('ok', true, 'borrados', n);
end $$;


-- 8) GRANTS -----------------------------------------------------------

grant execute on function public.din_publico(text, text)                                to anon, authenticated;
grant execute on function public.din_registrar(text, text, text, text, text, jsonb)     to anon, authenticated;
grant execute on function public.din_admin_config(uuid, text, text, boolean, text, jsonb, timestamptz, boolean, timestamptz, boolean) to anon, authenticated;
grant execute on function public.din_admin_listar(uuid, text, text)                     to anon, authenticated;
grant execute on function public.din_admin_borrar(uuid, text, bigint)                   to anon, authenticated;
grant execute on function public.din_admin_vaciar(uuid, text, text)                     to anon, authenticated;
