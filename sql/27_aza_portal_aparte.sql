-- =====================================================================
--  PUMAS GAMING · 27 · Ascensos AZA como portal aparte
--  Requiere 18, 19 y 20. Se puede correr las veces que quieras.
--
--  · Los usuarios de AZA (roles que solo ven 'ascensosaza': admins de AZA y
--    los moderadores que ellos crean) NO salen en la lista general de
--    Usuarios y roles para nadie, salvo el SUPERADMIN (que los ve en su
--    propia ventana "Ascensos AZA · subusuarios").
--  · Sus moderadores solo los manejan el superadmin y los admins de AZA
--    (antes también cualquier rol con "gestionar usuarios").
--  · Al iniciar sesión, los usuarios de AZA entran directo a /ascensos/admin.html
--    (no al panel principal) porque su rol solo tiene ese portal.
-- =====================================================================

-- ¿El rol es solo del portal AZA?
create or replace function public._rol_solo_aza(p_rol text)
returns boolean language sql stable
set search_path = public
as $$
    select coalesce((select r.portales = '{ascensosaza}'::text[] from roles r where r.id = p_rol), false);
$$;
revoke execute on function public._rol_solo_aza(text) from public, anon, authenticated;

-- Moderadores de AZA: solo superadmin y admins de AZA
create or replace function public._jefe_ascensos(ses json)
returns boolean language sql immutable as $$
    select ses->>'rol' in ('superadmin', 'administradorascensos', 'aza');
$$;
revoke execute on function public._jefe_ascensos(json) from public, anon, authenticated;

-- Lista de usuarios y roles: los de AZA solo los ve el superadmin
create or replace function public.admin_listar(p_token uuid)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'gestionar');
    super boolean := ses->>'rol' = 'superadmin';
begin
    return json_build_object(
        'usuarios', coalesce((
            select json_agg(json_build_object(
                       'usuario', u.usuario, 'nombre', u.nombre, 'email', u.email,
                       'rol', u.rol, 'activo', u.activo) order by lower(u.usuario))
              from usuarios_admin u
             where super or not _rol_solo_aza(u.rol)), '[]'::json),
        'roles', coalesce((
            select json_agg(json_build_object(
                       'id', r.id, 'nombre', r.nombre, 'portales', r.portales, 'padre', r.padre,
                       'personalizar', r.puede_personalizar, 'gestionar', r.puede_gestionar_usuarios,
                       'usuarios', (select count(*) from usuarios_admin u where u.rol = r.id)) order by r.id)
              from roles r
             where super or r.portales <> '{ascensosaza}'::text[]), '[]'::json),
        'portales', coalesce((
            select json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color) order by p.id)
              from portales p where p.activo), '[]'::json)
    );
end $$;
grant execute on function public.admin_listar(uuid) to anon, authenticated;
