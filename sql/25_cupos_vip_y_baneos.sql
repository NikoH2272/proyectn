-- =====================================================================
--  PUMAS GAMING · 25 · Cupos VIP, baneo por número y equipo, "Generar baneo"
--  Requiere 17, 19, 20 y 24. Se puede correr las veces que quieras.
--  Se usa en Entrenos Pumas (portal 'entrenamientos') y en el módulo de Pruebas.
--
--  · Cada cupo programado es PÚBLICO o VIP (columna tipo).
--  · VIP: solo se inscribe un equipo de la lista VIP del portal, con el MISMO
--    nombre y número con que se anotó (cupos_vip; en Pumas también valen los
--    registros VIP APROBADOS de vip.html).
--  · Baneados: por EQUIPO (asc_baneados, la lista pública de siempre) y por
--    NÚMERO (ban_telefonos, privado: el número nunca sale en lo público).
--    Un equipo baneado o un número baneado NO consigue cupo, ni público ni VIP.
--  · Se revisa con un trigger al insertar la inscripción, así no hay forma de
--    saltárselo (ni desde la página de cupos de Pumas, que inserta directo).
--  · "Generar baneo": al cargar resultados, los equipos que no jugaron 2 salas
--    o no jugaron la última se pueden banear (equipo + su número de los cupos).
-- =====================================================================

-- 1) Tipo de cupo -------------------------------------------------------
alter table public.portal_programados add column if not exists tipo text not null default 'PUBLICO';
alter table public.entrenamientos_programados add column if not exists tipo text not null default 'PUBLICO';
-- Hasta cuándo se puede inscribir (null = hasta la hora del entreno). Lo usan los horarios VIP.
alter table public.portal_programados add column if not exists cierra_en timestamptz;
alter table public.entrenamientos_programados add column if not exists cierra_en timestamptz;

-- 2) Lista VIP por portal (privada) --------------------------------------
create table if not exists public.cupos_vip (
    id         bigint generated always as identity primary key,
    portal     text not null references public.portales(id) on delete cascade,
    equipo     text not null,
    telefono   text not null,
    creado_por text,
    creado     timestamptz not null default now()
);
create unique index if not exists cupos_vip_equipo_key on public.cupos_vip (portal, regexp_replace(lower(equipo), '[^a-z0-9]', '', 'g'));
alter table public.cupos_vip enable row level security;   -- sin políticas: privado

-- 3) Números baneados por portal (privado) --------------------------------
create table if not exists public.ban_telefonos (
    id         bigint generated always as identity primary key,
    portal     text not null references public.portales(id) on delete cascade,
    telefono   text not null,                 -- como se escribió (+57 300...)
    equipo     text,                          -- de qué equipo era (referencia)
    motivo     text,
    hasta      date,                          -- null = sin fecha de fin
    creado_por text,
    creado     timestamptz not null default now()
);
create unique index if not exists ban_telefonos_key on public.ban_telefonos (portal, right(regexp_replace(telefono, '[^0-9]', '', 'g'), 10));
alter table public.ban_telefonos enable row level security;   -- sin políticas: privado

-- 4) Ayudantes -------------------------------------------------------------
-- Mismo número: se comparan los últimos 10 dígitos (con o sin indicativo del país)
create or replace function public._tel10(p text)
returns text language sql immutable
as $$ select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 10) $$;

create or replace function public._norm_eq(p text)
returns text language sql immutable
as $$ select regexp_replace(lower(coalesce(p, '')), '[^a-z0-9]', '', 'g') $$;

create or replace function public._tel_baneado(p_portal text, p_tel text)
returns boolean language sql stable
set search_path = public
as $$
    select length(_tel10(p_tel)) >= 7 and exists (
        select 1 from ban_telefonos b
         where b.portal = p_portal and (b.hasta is null or b.hasta >= current_date)
           and _tel10(b.telefono) = _tel10(p_tel));
$$;

create or replace function public._es_vip(p_portal text, p_equipo text, p_tel text)
returns boolean language sql stable
set search_path = public
as $$
    select exists (select 1 from cupos_vip v
                    where v.portal = p_portal and _norm_eq(v.equipo) = _norm_eq(p_equipo) and _tel10(v.telefono) = _tel10(p_tel))
        or (p_portal = 'entrenamientos' and exists (
                select 1 from vip_registros r
                 where r.estado = 'APROBADO' and _norm_eq(r.nombre) = _norm_eq(p_equipo) and _tel10(r.telefono) = _tel10(p_tel)));
$$;
revoke execute on function public._tel_baneado(text, text) from public, anon, authenticated;
revoke execute on function public._es_vip(text, text, text) from public, anon, authenticated;

-- 5) Revisión al inscribirse (trigger) -------------------------------------
create or replace function public._revisar_cupo(p_portal text, p_tipo text, p_equipo text, p_tel text)
returns void language plpgsql stable
set search_path = public
as $$
begin
    if _baneado(p_portal, p_equipo) then
        raise exception 'Este equipo está baneado y no puede inscribirse a los cupos';
    end if;
    if _tel_baneado(p_portal, p_tel) then
        raise exception 'Este número está baneado y no puede inscribirse a los cupos';
    end if;
    if coalesce(p_tipo, 'PUBLICO') = 'VIP' and not _es_vip(p_portal, p_equipo, p_tel) then
        raise exception 'Este entreno es solo para equipos VIP: inscríbete con el mismo nombre de equipo y número con que te registraste como VIP';
    end if;
end $$;

revoke execute on function public._revisar_cupo(text, text, text, text) from public, anon, authenticated;

-- Pumas (registro_cupos → entrenamientos_programados)
create or replace function public._trg_registro_cupos()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare v_tipo text; v_cierra timestamptz;
begin
    if new.telefono = 'REGISTRO STAFF' then return new; end if;   -- los de staff los pone el admin
    select tipo, cierra_en into v_tipo, v_cierra from entrenamientos_programados where id = new.entrenamiento_id;
    if v_cierra is not null and v_cierra <= now() then raise exception 'Las inscripciones de este cupo ya cerraron'; end if;
    perform _revisar_cupo('entrenamientos', v_tipo, new.nombre_jugador, new.telefono);
    return new;
end $$;
drop trigger if exists revisar_cupo on public.registro_cupos;
create trigger revisar_cupo before insert on public.registro_cupos for each row execute function public._trg_registro_cupos();

-- Demás portales (portal_cupos → portal_programados)
create or replace function public._trg_portal_cupos()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare g portal_programados;
begin
    if new.telefono = 'REGISTRO STAFF' then return new; end if;
    select * into g from portal_programados where id = new.programado_id;
    if g.cierra_en is not null and g.cierra_en <= now() then raise exception 'Las inscripciones de este cupo ya cerraron'; end if;
    perform _revisar_cupo(g.portal, g.tipo, new.nombre_equipo, new.telefono);
    return new;
end $$;
drop trigger if exists revisar_cupo on public.portal_cupos;
create trigger revisar_cupo before insert on public.portal_cupos for each row execute function public._trg_portal_cupos();

-- 6) Lo público: los cupos salen con su tipo ---------------------------------
create or replace function public.cupos_publicos(p_portal text)
returns json
language sql security definer stable
set search_path = public
as $$
    select coalesce(json_agg(json_build_object(
               'id', g.id, 'portal', g.portal, 'titulo', g.titulo, 'fecha', g.fecha, 'cupos', g.cupos_totales,
               'tipo', g.tipo, 'abre_en', g.publicar_en, 'cierra_en', g.cierra_en,
               'pendiente', g.publicar_en is not null and g.publicar_en > now(),
               'inscritos', (select coalesce(json_agg(json_build_object('equipo', c.nombre_equipo, 'staff', c.telefono = 'REGISTRO STAFF') order by c.creado), '[]'::json)
                               from portal_cupos c where c.programado_id = g.id)) order by coalesce(g.publicar_en, g.fecha), g.fecha), '[]'::json)
      from portal_programados g
     where g.portal = p_portal and g.estado = 'ABIERTO'
       and (g.publicar_en is null or g.publicar_en <= now() + interval '7 days')
       and g.fecha > now() - interval '6 hours'
       and (g.cierra_en is null or g.cierra_en > now());
$$;

-- 7) Admin -------------------------------------------------------------------
-- Lista de cupos del admin, ahora con su tipo
create or replace function public.admin_cupos_listar(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return (select coalesce(json_agg(json_build_object(
               'id', g.id, 'titulo', g.titulo, 'fecha', g.fecha, 'cupos', g.cupos_totales, 'estado', g.estado,
               'publicar_en', g.publicar_en, 'link', g.link_grupo, 'tipo', g.tipo, 'cierra_en', g.cierra_en,
               'inscritos', (select coalesce(json_agg(json_build_object('id', c.id, 'equipo', c.nombre_equipo, 'telefono', c.telefono,
                                    'staff', c.telefono = 'REGISTRO STAFF') order by c.creado), '[]'::json)
                               from portal_cupos c where c.programado_id = g.id)) order by g.fecha desc), '[]'::json)
              from portal_programados g
             where g.portal = p_portal and g.fecha > now() - interval '60 days');
end $$;

-- Tipo de un cupo ya creado (PUBLICO / VIP)
create or replace function public.admin_cupo_tipo(p_token uuid, p_portal text, p_id bigint, p_tipo text)
returns json language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if p_tipo not in ('PUBLICO', 'VIP') then raise exception 'Tipo inválido'; end if;
    update portal_programados set tipo = p_tipo where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Horarios VIP: deja el cupo como VIP y con su hora de cierre de inscripciones
create or replace function public.admin_cupo_vip(p_token uuid, p_portal text, p_id bigint, p_cierra_en timestamptz)
returns json language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    update portal_programados set tipo = 'VIP', cierra_en = p_cierra_en where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Lista VIP
create or replace function public.admin_vip_lista(p_token uuid, p_portal text)
returns json language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return json_build_object(
        'lista', (select coalesce(json_agg(json_build_object('id', id, 'equipo', equipo, 'telefono', telefono, 'creado', creado) order by equipo), '[]'::json)
                    from cupos_vip where portal = p_portal),
        -- En Pumas también cuentan los registros VIP aprobados (vip.html)
        'registros', case when p_portal = 'entrenamientos' then
                    (select coalesce(json_agg(json_build_object('equipo', nombre, 'tag', tag, 'telefono', telefono) order by nombre), '[]'::json)
                       from vip_registros where estado = 'APROBADO') else '[]'::json end);
end $$;

create or replace function public.admin_vip_guardar(p_token uuid, p_portal text, p_equipo text, p_telefono text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    v_eq text := upper(left(trim(coalesce(p_equipo, '')), 60));
begin
    if v_eq = '' or length(_tel10(p_telefono)) < 7 then raise exception 'Escribe el nombre del equipo y un número válido'; end if;
    if (select count(*) from cupos_vip where portal = p_portal) >= 500 then raise exception 'La lista VIP está llena (500)'; end if;
    insert into cupos_vip (portal, equipo, telefono, creado_por) values (p_portal, v_eq, left(trim(p_telefono), 30), quien)
    on conflict (portal, regexp_replace(lower(equipo), '[^a-z0-9]', '', 'g')) do update set telefono = excluded.telefono, creado_por = excluded.creado_por;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_vip_borrar(p_token uuid, p_portal text, p_id bigint)
returns json language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from cupos_vip where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Baneados: equipos (asc_baneados) y números (ban_telefonos)
create or replace function public.admin_baneos_lista(p_token uuid, p_portal text)
returns json language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return json_build_object(
        'equipos', (select coalesce(json_agg(json_build_object('id', id, 'equipo', equipo, 'tag', tag, 'motivo', motivo, 'hasta', hasta, 'creado', creado) order by creado desc), '[]'::json)
                      from asc_baneados where portal = p_portal),
        'telefonos', (select coalesce(json_agg(json_build_object('id', id, 'telefono', telefono, 'equipo', equipo, 'motivo', motivo, 'hasta', hasta, 'creado', creado) order by creado desc), '[]'::json)
                      from ban_telefonos where portal = p_portal));
end $$;

-- Banear equipo y/o número (si vienen los dos, quedan los dos)
create or replace function public.admin_baneo_guardar(p_token uuid, p_portal text, p_equipo text, p_telefono text, p_motivo text, p_hasta date)
returns json language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    v_eq text := left(trim(coalesce(p_equipo, '')), 60);
    v_mot text := left(nullif(trim(coalesce(p_motivo, '')), ''), 200);
begin
    if v_eq = '' and length(_tel10(p_telefono)) < 7 then raise exception 'Escribe el equipo, el número o los dos'; end if;
    if v_eq <> '' then
        insert into asc_baneados (portal, equipo, motivo, hasta, creado_por) values (p_portal, v_eq, v_mot, p_hasta, quien)
        on conflict (portal, lower(trim(equipo))) do update set motivo = excluded.motivo, hasta = excluded.hasta, creado_por = excluded.creado_por;
    end if;
    if length(_tel10(p_telefono)) >= 7 then
        insert into ban_telefonos (portal, telefono, equipo, motivo, hasta, creado_por)
        values (p_portal, left(trim(p_telefono), 30), nullif(v_eq, ''), v_mot, p_hasta, quien)
        on conflict (portal, right(regexp_replace(telefono, '[^0-9]', '', 'g'), 10)) do update
           set equipo = coalesce(excluded.equipo, ban_telefonos.equipo), motivo = excluded.motivo, hasta = excluded.hasta, creado_por = excluded.creado_por;
    end if;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_baneo_borrar(p_token uuid, p_portal text, p_tipo text, p_id bigint)
returns json language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if p_tipo = 'telefono' then delete from ban_telefonos where id = p_id and portal = p_portal;
    else delete from asc_baneados where id = p_id and portal = p_portal; end if;
    return json_build_object('ok', true);
end $$;

-- "Generar baneo" desde los resultados: banea el equipo y los números con que
-- ese equipo se inscribió a los cupos del portal en los últimos 30 días
create or replace function public.admin_baneo_resultados(p_token uuid, p_portal text, p_equipo text, p_motivo text, p_hasta date)
returns json language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    v_eq text := left(trim(coalesce(p_equipo, '')), 60);
    v_mot text := left(coalesce(nullif(trim(coalesce(p_motivo, '')), ''), 'No cumplió las salas del entreno'), 200);
    tel text;
    n int := 0;
begin
    if v_eq = '' then raise exception 'Falta el equipo'; end if;
    insert into asc_baneados (portal, equipo, motivo, hasta, creado_por) values (p_portal, v_eq, v_mot, p_hasta, quien)
    on conflict (portal, lower(trim(equipo))) do update set motivo = excluded.motivo, hasta = excluded.hasta, creado_por = excluded.creado_por;
    for tel in
        select distinct t from (
            select rc.telefono as t from registro_cupos rc
              join entrenamientos_programados ep on ep.id = rc.entrenamiento_id
             where p_portal = 'entrenamientos' and rc.telefono <> 'REGISTRO STAFF'
               and _norm_eq(rc.nombre_jugador) = _norm_eq(v_eq) and ep.fecha > now() - interval '30 days'
            union all
            select pc.telefono from portal_cupos pc
              join portal_programados pp on pp.id = pc.programado_id
             where pp.portal = p_portal and pc.telefono <> 'REGISTRO STAFF'
               and _norm_eq(pc.nombre_equipo) = _norm_eq(v_eq) and pp.fecha > now() - interval '30 days'
        ) x where length(_tel10(t)) >= 7
    loop
        insert into ban_telefonos (portal, telefono, equipo, motivo, hasta, creado_por) values (p_portal, left(tel, 30), v_eq, v_mot, p_hasta, quien)
        on conflict (portal, right(regexp_replace(telefono, '[^0-9]', '', 'g'), 10)) do update
           set equipo = excluded.equipo, motivo = excluded.motivo, hasta = excluded.hasta, creado_por = excluded.creado_por;
        n := n + 1;
    end loop;
    return json_build_object('ok', true, 'telefonos', n);
end $$;

grant execute on function public.cupos_publicos(text) to anon, authenticated;
grant execute on function public.admin_cupo_tipo(uuid, text, bigint, text) to anon, authenticated;
grant execute on function public.admin_cupo_vip(uuid, text, bigint, timestamptz) to anon, authenticated;
grant execute on function public.admin_vip_lista(uuid, text) to anon, authenticated;
grant execute on function public.admin_vip_guardar(uuid, text, text, text) to anon, authenticated;
grant execute on function public.admin_vip_borrar(uuid, text, bigint) to anon, authenticated;
grant execute on function public.admin_baneos_lista(uuid, text) to anon, authenticated;
grant execute on function public.admin_baneo_guardar(uuid, text, text, text, text, date) to anon, authenticated;
grant execute on function public.admin_baneo_borrar(uuid, text, text, bigint) to anon, authenticated;
grant execute on function public.admin_baneo_resultados(uuid, text, text, text, date) to anon, authenticated;
