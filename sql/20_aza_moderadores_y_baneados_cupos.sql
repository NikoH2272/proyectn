-- =====================================================================
--  PUMAS GAMING · 20 · Admin de AZA maneja moderadores · baneados sin cupo
--  Requiere 17 y 19. Se puede correr las veces que quieras.
--
--  · El usuario de AZA (rol "aza", Ascensos AZA) también crea, modifica y
--    ELIMINA moderadores (antes solo el Administrador Ascensos y el superadmin).
--  · Un equipo baneado (asc_baneados, vigente) NO puede inscribirse a los
--    cupos de ese portal, ni lo pueden poner como equipo de staff.
-- =====================================================================

-- 1) Quién maneja moderadores: superadmin, Administrador Ascensos y Ascensos AZA
create or replace function public._jefe_ascensos(ses json)
returns boolean language sql immutable as $$
    select coalesce((ses->>'gestionar')::boolean, false) or ses->>'rol' in ('administradorascensos', 'aza');
$$;
revoke execute on function public._jefe_ascensos(json) from public, anon, authenticated;

-- Eliminar un moderador (solo usuarios con rol de moderador de AZA)
create or replace function public.asc_mod_borrar(p_token uuid, p_usuario text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_ascensos(ses) then raise exception 'No puedes manejar moderadores'; end if;
    if not exists (select 1 from usuarios_admin where lower(usuario) = u and rol = 'moderador_aza') then
        raise exception 'Ese usuario no es un moderador de AZA';
    end if;
    delete from admin_sesiones where lower(usuario) = u;
    delete from asc_permisos where usuario = u;
    delete from usuarios_admin where lower(usuario) = u and rol = 'moderador_aza';
    return json_build_object('ok', true);
end $$;

-- 2) ¿Está baneado (vigente) en ese portal?
create or replace function public._baneado(p_portal text, p_equipo text)
returns boolean language sql stable
set search_path = public
as $$
    select exists (
        select 1 from asc_baneados b
         where b.portal = p_portal
           and (b.hasta is null or b.hasta >= current_date)
           and regexp_replace(lower(b.equipo), '[^a-z0-9]', '', 'g') = regexp_replace(lower(coalesce(p_equipo, '')), '[^a-z0-9]', '', 'g'));
$$;
revoke execute on function public._baneado(text, text) from public, anon, authenticated;

-- Inscribirse a un cupo (igual que en sql/17 + baneados)
create or replace function public.cupo_inscribir(p_programado bigint, p_equipo text, p_telefono text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    g portal_programados;
    v_eq text := left(trim(coalesce(p_equipo, '')), 60);
    n int;
begin
    select * into g from portal_programados where id = p_programado for update;
    if not found or g.estado <> 'ABIERTO' or (g.publicar_en is not null and g.publicar_en > now()) then
        raise exception 'Este entreno no tiene inscripciones abiertas';
    end if;
    if v_eq = '' or coalesce(trim(p_telefono), '') = '' then raise exception 'Completa equipo y teléfono'; end if;
    if _baneado(g.portal, v_eq) then
        raise exception 'Este equipo está baneado y no puede inscribirse a los cupos';
    end if;
    select count(*) into n from portal_cupos where programado_id = g.id;
    if n >= g.cupos_totales then
        update portal_programados set estado = 'CERRADO' where id = g.id;
        raise exception 'Los cupos se acaban de agotar';
    end if;
    if exists (select 1 from portal_cupos where programado_id = g.id
                and regexp_replace(lower(nombre_equipo), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v_eq), '[^a-z0-9]', '', 'g')) then
        raise exception 'Ese equipo ya está inscrito en este entreno';
    end if;
    insert into portal_cupos (programado_id, nombre_equipo, telefono) values (g.id, v_eq, left(trim(p_telefono), 30));
    if n + 1 >= g.cupos_totales then update portal_programados set estado = 'CERRADO' where id = g.id; end if;
    return json_build_object('ok', true, 'link', g.link_grupo);
end $$;

-- Abrir cupos (igual que en sql/17 + no deja poner baneados como staff)
create or replace function public.admin_cupo_guardar(
    p_token uuid, p_portal text, p_titulo text, p_fecha timestamptz, p_cupos int,
    p_link text, p_publicar_en timestamptz, p_staff text[]
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    nuevo bigint;
    malos text;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if coalesce(trim(p_titulo), '') = '' or p_fecha is null then raise exception 'Completa título y fecha'; end if;
    if coalesce(p_cupos, 0) < 1 or p_cupos > 100 then raise exception 'Cupos: de 1 a 100'; end if;
    if nullif(trim(p_link), '') is not null and trim(p_link) !~ '^https://' then
        raise exception 'El link del grupo debe empezar con https://';
    end if;
    select string_agg(trim(x), ', ') into malos from unnest(coalesce(p_staff, '{}')) x where trim(x) <> '' and _baneado(p_portal, x);
    if malos is not null then raise exception 'Estos equipos están baneados y no pueden ir como staff: %', malos; end if;

    insert into portal_programados (portal, titulo, fecha, hay_staff, cupos_totales, link_grupo, estado, publicar_en)
    values (p_portal, left(trim(p_titulo), 120), p_fecha, coalesce(array_length(p_staff, 1), 0) > 0, p_cupos,
            left(nullif(trim(p_link), ''), 300), 'ABIERTO', p_publicar_en)
    returning id into nuevo;
    insert into portal_cupos (programado_id, nombre_equipo, telefono)
    select distinct on (lower(trim(x))) nuevo, left(trim(x), 60), 'REGISTRO STAFF'
      from unnest(coalesce(p_staff, '{}')) x where trim(x) <> '';
    return json_build_object('ok', true, 'id', nuevo);
end $$;

grant execute on function public.asc_mod_borrar(uuid, text) to anon, authenticated;
grant execute on function public.cupo_inscribir(bigint, text, text) to anon, authenticated;
grant execute on function public.admin_cupo_guardar(uuid, text, text, timestamptz, int, text, timestamptz, text[]) to anon, authenticated;
