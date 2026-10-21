-- =====================================================================
--  PUMAS GAMING · 32 · Qué secciones del panel ve cada usuario
--  Requiere 31. Se puede correr las veces que quieras.
--
--  · En "Usuarios del portal", a cada usuario del staff se le marcan las
--    secciones que puede ver (herramienta, cupos, baneados...), en vez de
--    depender solo de su rol.
--  · Sin nada marcado (o sin registro) ve todas las secciones de su portal.
--  · Los administradores del portal y el superadmin siempre ven todo.
-- =====================================================================

create table if not exists public.portal_permisos (
    usuario         text not null,
    portal          text not null references public.portales(id) on delete cascade,
    secciones       text[] not null default '{}',
    actualizado     timestamptz not null default now(),
    actualizado_por text,
    primary key (usuario, portal)
);
alter table public.portal_permisos enable row level security;   -- sin políticas: privado

-- Secciones que ve quien entra (null = todas)
create or replace function public.portal_mis_secciones(p_token uuid, p_portal text)
returns json language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    v text[];
begin
    if ses->>'rol' not like 'staff\_%' then return json_build_object('secciones', null); end if;
    select secciones into v from portal_permisos where usuario = lower(ses->>'usuario') and portal = p_portal;
    return json_build_object('secciones', case when v is null or cardinality(v) = 0 then null else to_json(v) end);
end $$;

-- Guardar las secciones de un usuario del staff (lo hace su admin o el superadmin)
create or replace function public.portal_usuario_secciones(p_token uuid, p_portal text, p_usuario text, p_secciones text[])
returns json language plpgsql security definer
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
    v_staff text := case when p_portal = 'entrenamientos' then 'staff_pumas' else 'staff_' || p_portal end;
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_portal(ses, p_portal) then raise exception 'No puedes manejar los usuarios de este portal'; end if;
    if not exists (select 1 from usuarios_admin where lower(usuario) = u and rol = v_staff) then
        raise exception 'Las secciones solo se eligen para el staff del portal';
    end if;
    insert into portal_permisos (usuario, portal, secciones, actualizado, actualizado_por)
    values (u, p_portal, coalesce(p_secciones, '{}'), now(), ses->>'usuario')
    on conflict (usuario, portal) do update set secciones = excluded.secciones, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

-- La lista de usuarios del portal ahora trae las secciones de cada staff
create or replace function public.portal_usuarios(p_token uuid, p_portal text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
    v_admin text := _rol_admin_portal(p_portal);
    v_staff text := case when p_portal = 'entrenamientos' then 'staff_pumas' else 'staff_' || p_portal end;
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not exists (select 1 from portales where id = p_portal) then raise exception 'Ese portal no existe'; end if;
    if not _jefe_portal(ses, p_portal) then raise exception 'No puedes manejar los usuarios de este portal'; end if;
    return json_build_object(
        'super', ses->>'rol' = 'superadmin',
        'rol_admin', v_admin,
        'admins', (select coalesce(json_agg(json_build_object('usuario', u.usuario, 'nombre', u.nombre, 'activo', u.activo, 'rol', u.rol) order by lower(u.usuario)), '[]'::json)
                     from usuarios_admin u join roles r on r.id = u.rol
                    where p_portal = any(r.portales) and not ('*' = any(r.portales))
                      and u.rol not like 'staff\_%' and u.rol not in ('moderador_aza', 'administradorascensos')),
        'staff', (select coalesce(json_agg(json_build_object('usuario', u.usuario, 'nombre', u.nombre, 'activo', u.activo,
                        'secciones', coalesce(pp.secciones, '{}')) order by lower(u.usuario)), '[]'::json)
                    from usuarios_admin u
                    left join portal_permisos pp on pp.usuario = lower(u.usuario) and pp.portal = p_portal
                   where u.rol = v_staff));
end $$;

grant execute on function public.portal_mis_secciones(uuid, text) to anon, authenticated;
grant execute on function public.portal_usuario_secciones(uuid, text, text, text[]) to anon, authenticated;
grant execute on function public.portal_usuarios(uuid, text) to anon, authenticated;
