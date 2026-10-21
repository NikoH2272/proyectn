-- =====================================================================
--  PUMAS GAMING · 28 · Entrenos Pumas como portal aparte (como AZA)
--  Requiere 18 y 27. Se puede correr las veces que quieras.
--
--  · Configuración del portal público de Pumas: qué secciones se muestran
--    (sitio_config 'portal_entrenamientos' = {"ocultos": [...]}).
--  · Usuarios de Pumas (rol staff_pumas): solo entran al panel de Pumas y
--    solo a los módulos que les habiliten (pumas_permisos.modulos).
--    Los manejan el superadmin y los admins de Pumas (rol 'pumas'), desde
--    Admin Pumas → Configuración, o el superadmin en Usuarios y roles.
--  · En Usuarios y roles, los usuarios de portales aparte (AZA y staff de
--    Pumas) solo los ve el superadmin.
-- =====================================================================

-- 1) Rol de staff de Pumas (solo el portal de entrenos)
insert into public.roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios)
values ('staff_pumas', 'Staff Entrenos Pumas', '{entrenamientos}', false, false)
on conflict (id) do update set portales = '{entrenamientos}';

-- 2) Módulos del panel que puede usar cada usuario de staff
create table if not exists public.pumas_permisos (
    usuario         text primary key,
    modulos         text[] not null default '{}',
    actualizado     timestamptz not null default now(),
    actualizado_por text
);
alter table public.pumas_permisos enable row level security;   -- sin políticas: privado

create or replace function public._jefe_pumas(ses json)
returns boolean language sql immutable as $$
    select ses->>'rol' in ('superadmin', 'pumas');
$$;
revoke execute on function public._jefe_pumas(json) from public, anon, authenticated;

-- Lo que puede hacer el usuario en el panel de Pumas (modulos null = todo)
create or replace function public.pumas_mis_permisos(p_token uuid)
returns json language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:entrenamientos');
begin
    if ses->>'rol' = 'staff_pumas' then
        return json_build_object('jefe', false, 'modulos',
            coalesce((select to_json(modulos) from pumas_permisos where usuario = lower(ses->>'usuario')), '[]'::json));
    end if;
    return json_build_object('jefe', _jefe_pumas(ses), 'modulos', null);
end $$;

-- Usuarios de staff de Pumas
create or replace function public.pumas_usr_listar(p_token uuid)
returns json language plpgsql security definer stable
set search_path = public
as $$
declare ses json := validar_sesion(p_token);
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_pumas(ses) then raise exception 'Solo el admin de Pumas maneja sus usuarios'; end if;
    return (select coalesce(json_agg(json_build_object('usuario', u.usuario, 'nombre', u.nombre, 'activo', u.activo,
                'modulos', coalesce(p.modulos, '{}')) order by lower(u.usuario)), '[]'::json)
              from usuarios_admin u left join pumas_permisos p on p.usuario = lower(u.usuario)
             where u.rol = 'staff_pumas');
end $$;

create or replace function public.pumas_usr_guardar(p_token uuid, p_usuario text, p_nombre text, p_clave text, p_activo boolean, p_modulos text[])
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
    rol_actual text;
    existe boolean := false;
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_pumas(ses) then raise exception 'Solo el admin de Pumas maneja sus usuarios'; end if;
    if u !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Usuario inválido: 3 a 30 letras minúsculas, números, punto o guion'; end if;
    if p_clave is not null and length(p_clave) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;
    select rol, true into rol_actual, existe from usuarios_admin where lower(usuario) = u;
    if coalesce(existe, false) and coalesce(rol_actual, '') <> 'staff_pumas' then
        raise exception 'Ese usuario ya existe con otro rol: elige otro nombre de usuario';
    end if;
    if coalesce(existe, false) then
        update usuarios_admin
           set nombre = coalesce(nullif(trim(p_nombre), ''), nombre), activo = coalesce(p_activo, activo),
               password = case when p_clave is not null then crypt(p_clave, gen_salt('bf')) else password end
         where lower(usuario) = u;
        if p_clave is not null or not coalesce(p_activo, true) then delete from admin_sesiones where lower(usuario) = u; end if;
    else
        if p_clave is null then raise exception 'Para crear el usuario ponle contraseña'; end if;
        insert into usuarios_admin (usuario, nombre, rol, activo, password)
        values (u, coalesce(nullif(trim(p_nombre), ''), u), 'staff_pumas', coalesce(p_activo, true), crypt(p_clave, gen_salt('bf')));
    end if;
    insert into pumas_permisos (usuario, modulos, actualizado, actualizado_por)
    values (u, coalesce(p_modulos, '{}'), now(), ses->>'usuario')
    on conflict (usuario) do update set modulos = excluded.modulos, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

create or replace function public.pumas_usr_borrar(p_token uuid, p_usuario text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_pumas(ses) then raise exception 'Solo el admin de Pumas maneja sus usuarios'; end if;
    if not exists (select 1 from usuarios_admin where lower(usuario) = u and rol = 'staff_pumas') then
        raise exception 'Ese usuario no es del staff de Pumas';
    end if;
    delete from admin_sesiones where lower(usuario) = u;
    delete from pumas_permisos where usuario = u;
    delete from usuarios_admin where lower(usuario) = u and rol = 'staff_pumas';
    return json_build_object('ok', true);
end $$;

-- 3) Secciones del portal público de Pumas
insert into public.sitio_config (clave, valor) values ('portal_entrenamientos', '{"ocultos": []}')
on conflict (clave) do nothing;

create or replace function public.pumas_portal_guardar(p_token uuid, p_ocultos text[])
returns json language plpgsql security definer
set search_path = public
as $$
declare ses json := _exigir_permiso(p_token, 'portal:entrenamientos');
begin
    if not _jefe_pumas(ses) then raise exception 'Solo el admin de Pumas configura el portal'; end if;
    insert into sitio_config (clave, valor, actualizado, actualizado_por)
    values ('portal_entrenamientos', jsonb_build_object('ocultos', coalesce(to_jsonb(p_ocultos), '[]'::jsonb)), now(), ses->>'usuario')
    on conflict (clave) do update set valor = excluded.valor, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

-- 4) Usuarios y roles: los de portales aparte (AZA y staff de Pumas) solo los ve el superadmin
create or replace function public._rol_aparte(p_rol text)
returns boolean language sql stable
set search_path = public
as $$
    select coalesce((select r.portales in ('{ascensosaza}'::text[], '{entrenamientos}'::text[]) from roles r where r.id = p_rol), false);
$$;
revoke execute on function public._rol_aparte(text) from public, anon, authenticated;

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
             where super or not _rol_aparte(u.rol)), '[]'::json),
        'roles', coalesce((
            select json_agg(json_build_object(
                       'id', r.id, 'nombre', r.nombre, 'portales', r.portales, 'padre', r.padre,
                       'personalizar', r.puede_personalizar, 'gestionar', r.puede_gestionar_usuarios,
                       'usuarios', (select count(*) from usuarios_admin u where u.rol = r.id)) order by r.id)
              from roles r
             where super or not _rol_aparte(r.id)), '[]'::json),
        'portales', coalesce((
            select json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color) order by p.id)
              from portales p where p.activo), '[]'::json)
    );
end $$;

grant execute on function public.pumas_mis_permisos(uuid) to anon, authenticated;
grant execute on function public.pumas_usr_listar(uuid) to anon, authenticated;
grant execute on function public.pumas_usr_guardar(uuid, text, text, text, boolean, text[]) to anon, authenticated;
grant execute on function public.pumas_usr_borrar(uuid, text) to anon, authenticated;
grant execute on function public.pumas_portal_guardar(uuid, text[]) to anon, authenticated;
grant execute on function public.admin_listar(uuid) to anon, authenticated;
