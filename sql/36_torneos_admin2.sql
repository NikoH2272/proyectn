-- =====================================================================
--  PUMAS GAMING · 36 · Torneos — funciones admin para equipos y partidas
--  Complementa sql/35_torneos.sql. Idempotente.
-- =====================================================================

-- Listar equipos de un torneo
create or replace function public.torneos_admin_equipos(p_token uuid, p_portal text, p_torneo_id bigint)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if not exists (select 1 from torneos where id = p_torneo_id and portal = p_portal) then
        raise exception 'Torneo no encontrado';
    end if;
    return coalesce(
        (select json_agg(e order by e.seed nulls last, e.nombre)
         from torneos_equipos e where e.torneo_id = p_torneo_id),
        '[]'::json
    );
end $$;

-- Guardar equipo (crear o editar)
create or replace function public.torneos_admin_equipo_guardar(
    p_token      uuid,
    p_portal     text,
    p_torneo_id  bigint,
    p_id         bigint  default null,
    p_nombre     text    default null,
    p_contacto   text    default null,
    p_ig         text    default null,
    p_seed       int     default null,
    p_grupo      text    default null,
    p_eliminado  boolean default false,
    p_metadata   jsonb   default '{}'
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare nuevo_id bigint;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if not exists (select 1 from torneos where id = p_torneo_id and portal = p_portal) then
        raise exception 'Torneo no encontrado';
    end if;
    if p_id is not null then
        update torneos_equipos set
            nombre     = coalesce(p_nombre,    nombre),
            contacto   = p_contacto,
            ig         = p_ig,
            seed       = p_seed,
            grupo      = p_grupo,
            eliminado  = coalesce(p_eliminado, eliminado),
            metadata   = coalesce(p_metadata, metadata)
        where id = p_id and torneo_id = p_torneo_id
        returning id into nuevo_id;
        if not found then raise exception 'Equipo no encontrado'; end if;
    else
        if p_nombre is null then raise exception 'El nombre es requerido'; end if;
        insert into torneos_equipos (torneo_id, nombre, contacto, ig, seed, grupo, eliminado, metadata)
        values (p_torneo_id, p_nombre, p_contacto, p_ig, p_seed, p_grupo, coalesce(p_eliminado,false), coalesce(p_metadata,'{}'))
        returning id into nuevo_id;
    end if;
    return json_build_object('ok', true, 'id', nuevo_id);
end $$;

-- Borrar equipo
create or replace function public.torneos_admin_equipo_borrar(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from torneos_equipos e
    using torneos t
    where e.id = p_id and e.torneo_id = t.id and t.portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Listar partidas de un torneo (con conteo de resultados)
create or replace function public.torneos_admin_partidas(p_token uuid, p_portal text, p_torneo_id bigint)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if not exists (select 1 from torneos where id = p_torneo_id and portal = p_portal) then
        raise exception 'Torneo no encontrado';
    end if;
    return coalesce(
        (select json_agg(
            json_build_object(
                'id',       p.id,
                'fase',     p.fase,
                'ronda',    p.ronda,
                'sala',     p.sala,
                'estado',   p.estado,
                'notas',    p.notas,
                'creado',   p.creado,
                'n_resultados', (select count(*) from torneos_resultados r where r.partida_id = p.id)
            ) order by p.ronda, p.sala nulls last
        )
        from torneos_partidas p where p.torneo_id = p_torneo_id),
        '[]'::json
    );
end $$;

-- Guardar partida (crear o editar)
create or replace function public.torneos_admin_partida_guardar(
    p_token      uuid,
    p_portal     text,
    p_torneo_id  bigint,
    p_id         bigint  default null,
    p_fase       text    default 'grupos',
    p_ronda      int     default 1,
    p_sala       int     default null,
    p_estado     text    default 'pendiente',
    p_notas      text    default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare nuevo_id bigint;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if not exists (select 1 from torneos where id = p_torneo_id and portal = p_portal) then
        raise exception 'Torneo no encontrado';
    end if;
    if p_id is not null then
        update torneos_partidas set
            fase   = coalesce(p_fase,   fase),
            ronda  = coalesce(p_ronda,  ronda),
            sala   = p_sala,
            estado = coalesce(p_estado, estado),
            notas  = p_notas
        where id = p_id and torneo_id = p_torneo_id
        returning id into nuevo_id;
        if not found then raise exception 'Partida no encontrada'; end if;
    else
        insert into torneos_partidas (torneo_id, fase, ronda, sala, estado, notas)
        values (p_torneo_id, coalesce(p_fase,'grupos'), coalesce(p_ronda,1), p_sala, coalesce(p_estado,'pendiente'), p_notas)
        returning id into nuevo_id;
    end if;
    return json_build_object('ok', true, 'id', nuevo_id);
end $$;

-- Borrar partida (y sus resultados en cascade)
create or replace function public.torneos_admin_partida_borrar(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from torneos_partidas p
    using torneos t
    where p.id = p_id and p.torneo_id = t.id and t.portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Listar logs de un torneo
create or replace function public.torneos_admin_logs(p_token uuid, p_portal text, p_torneo_id bigint)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if not exists (select 1 from torneos where id = p_torneo_id and portal = p_portal) then
        raise exception 'Torneo no encontrado';
    end if;
    return coalesce(
        (select json_agg(
            json_build_object(
                'id', l.id, 'nombre_archivo', l.nombre_archivo,
                'partida_id', l.partida_id, 'procesado', l.procesado,
                'error_proceso', l.error_proceso, 'creado', l.creado
            ) order by l.creado desc
        ) from torneos_logs l where l.torneo_id = p_torneo_id),
        '[]'::json
    );
end $$;

-- GRANTS
grant execute on function public.torneos_admin_equipos(uuid,text,bigint)                                                                   to anon, authenticated;
grant execute on function public.torneos_admin_equipo_guardar(uuid,text,bigint,bigint,text,text,text,int,text,boolean,jsonb)                to anon, authenticated;
grant execute on function public.torneos_admin_equipo_borrar(uuid,text,bigint)                                                             to anon, authenticated;
grant execute on function public.torneos_admin_partidas(uuid,text,bigint)                                                                  to anon, authenticated;
grant execute on function public.torneos_admin_partida_guardar(uuid,text,bigint,bigint,text,int,int,text,text)                             to anon, authenticated;
grant execute on function public.torneos_admin_partida_borrar(uuid,text,bigint)                                                            to anon, authenticated;
grant execute on function public.torneos_admin_logs(uuid,text,bigint)                                                                      to anon, authenticated;
