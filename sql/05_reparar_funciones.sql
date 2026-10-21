-- =====================================================================
--  PUMAS GAMING · 05 · Reparar funciones de login, sesión y permisos
--  Úsalo si coachniko es superadmin en la tabla pero el panel no le
--  muestra "Usuarios y roles" (pasa si se volvió a correr el 01 después
--  del 02: el 01 viejo pisaba estas funciones con su versión sin roles).
--  También cierra un hueco: si faltaba el permiso, antes se dejaba pasar.
--  Requiere 01 y 02. Se puede correr las veces que quieras.
-- =====================================================================

-- 4) SESIÓN: ahora devuelve rol y permisos -----------------------------
create or replace function public.validar_sesion(p_token uuid)
returns json
language sql security definer stable
set search_path = public
as $$
    select json_build_object(
               'token',        s.token,
               'usuario',      u.usuario,
               'nombre',       coalesce(u.nombre, u.usuario),
               'rol',          r.id,
               'rol_nombre',   r.nombre,
               'portales',     coalesce(r.portales, '{}'::text[]),
               'personalizar', coalesce(r.puede_personalizar, false),
               'gestionar',    coalesce(r.puede_gestionar_usuarios, false))
      from admin_sesiones s
      join usuarios_admin u on lower(u.usuario) = lower(s.usuario) and u.activo
      left join roles r on r.id = u.rol
     where s.token = p_token and s.expira > now();
$$;

create or replace function public.login_admin(p_usuario text, p_password text)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
    u record;
    t uuid;
begin
    select * into u
      from usuarios_admin
     where lower(usuario) = lower(trim(p_usuario)) and activo
     limit 1;

    if not found or u.password is null
       or u.password <> crypt(p_password, u.password) then
        return null;
    end if;

    delete from admin_sesiones where expira < now();
    insert into admin_sesiones (usuario) values (u.usuario) returning token into t;
    return validar_sesion(t);
end $$;

-- Exige un permiso: 'personalizar', 'gestionar' o 'portal:<id>'.
-- Devuelve la sesión o lanza error. Solo la usan otras funciones.
create or replace function public._exigir_permiso(p_token uuid, p_permiso text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
begin
    if ses is null then
        raise exception 'Sesión inválida o expirada';
    end if;
    -- coalesce: si falta el dato, se NIEGA (antes un null dejaba pasar)
    if p_permiso = 'personalizar' and not coalesce((ses->>'personalizar')::boolean, false) then
        raise exception 'Tu rol no puede personalizar las páginas';
    end if;
    if p_permiso = 'gestionar' and not coalesce((ses->>'gestionar')::boolean, false) then
        raise exception 'Tu rol no puede gestionar usuarios ni roles';
    end if;
    if p_permiso like 'portal:%' and not exists (
        select 1 from json_array_elements_text(ses->'portales') p
         where p in ('*', substr(p_permiso, 8))
    ) then
        raise exception 'Tu rol no tiene acceso a este portal';
    end if;
    return ses;
end $$;
revoke execute on function public._exigir_permiso(uuid, text) from public, anon, authenticated;

-- Efecto global: ahora lo decide el permiso del rol
create or replace function public.guardar_efecto_global(
    p_token uuid, p_efecto text, p_icono text, p_cantidad int
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'personalizar')->>'usuario';
begin
    insert into portal_config as c (portal, efecto, efecto_icono, efecto_cantidad, actualizado, actualizado_por)
    values ('global', p_efecto, left(coalesce(nullif(trim(p_icono), ''), '🔥'), 60), p_cantidad, now(), quien)
    on conflict (portal) do update
       set efecto          = excluded.efecto,
           efecto_icono    = excluded.efecto_icono,
           efecto_cantidad = excluded.efecto_cantidad,
           actualizado     = now(),
           actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

drop function if exists public._exigir_admin_pumas(uuid);
drop function if exists public.guardar_logos_portal(uuid, text, jsonb);


-- 5) GESTIÓN DE USUARIOS Y ROLES (solo roles con puede_gestionar_usuarios)

create or replace function public.admin_listar(p_token uuid)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    return json_build_object(
        'usuarios', coalesce((
            select json_agg(json_build_object(
                       'usuario', u.usuario, 'nombre', u.nombre, 'email', u.email,
                       'rol', u.rol, 'activo', u.activo) order by lower(u.usuario))
              from usuarios_admin u), '[]'::json),
        'roles', coalesce((
            select json_agg(json_build_object(
                       'id', r.id, 'nombre', r.nombre, 'portales', r.portales,
                       'personalizar', r.puede_personalizar, 'gestionar', r.puede_gestionar_usuarios,
                       'usuarios', (select count(*) from usuarios_admin u where u.rol = r.id)) order by r.id)
              from roles r), '[]'::json),
        'portales', coalesce((
            select json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color) order by p.id)
              from portales p where p.activo), '[]'::json)
    );
end $$;

-- Crea o edita un usuario. p_clave = null → no cambia la contraseña.
create or replace function public.admin_guardar_usuario(
    p_token uuid, p_usuario text, p_nombre text, p_rol text, p_activo boolean, p_clave text
)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
    yo     json := _exigir_permiso(p_token, 'gestionar');
    u      text := lower(trim(p_usuario));
    existe boolean;
begin
    if u !~ '^[a-z0-9._-]{3,30}$' then
        raise exception 'Usuario inválido: 3 a 30 letras minúsculas, números, punto o guion (sin @ ni espacios)';
    end if;
    if p_rol is null or not exists (select 1 from roles where id = p_rol) then
        raise exception 'Elige un rol válido';
    end if;
    if p_clave is not null and length(p_clave) < 6 then
        raise exception 'La contraseña debe tener al menos 6 caracteres';
    end if;

    -- Evita que el gestor se quede afuera
    if u = lower(yo->>'usuario') then
        if not coalesce(p_activo, true) then
            raise exception 'No puedes desactivar tu propio usuario';
        end if;
        if not (select puede_gestionar_usuarios from roles where id = p_rol) then
            raise exception 'No puedes quitarte un rol que gestiona usuarios';
        end if;
    end if;

    select true into existe from usuarios_admin where lower(usuario) = u;

    if coalesce(existe, false) then
        update usuarios_admin
           set nombre   = coalesce(nullif(trim(p_nombre), ''), nombre),
               rol      = p_rol,
               activo   = coalesce(p_activo, activo),
               password = case when p_clave is not null then crypt(p_clave, gen_salt('bf')) else password end
         where lower(usuario) = u;
        -- Clave cambiada o usuario desactivado → se cierran sus sesiones abiertas
        if (p_clave is not null or not coalesce(p_activo, true)) and u <> lower(yo->>'usuario') then
            delete from admin_sesiones where lower(usuario) = u;
        end if;
    else
        if p_clave is null then
            raise exception 'Para crear un usuario debes ponerle contraseña';
        end if;
        insert into usuarios_admin (usuario, nombre, rol, activo, password)
        values (u, coalesce(nullif(trim(p_nombre), ''), u), p_rol, coalesce(p_activo, true),
                crypt(p_clave, gen_salt('bf')));
    end if;
    return json_build_object('ok', true);
end $$;

-- Crea o edita un rol
create or replace function public.admin_guardar_rol(
    p_token uuid, p_id text, p_nombre text, p_portales text[], p_personalizar boolean, p_gestionar boolean
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    yo  json := _exigir_permiso(p_token, 'gestionar');
    rid text := lower(trim(p_id));
    malo text;
begin
    if rid !~ '^[a-z0-9_]{2,30}$' then
        raise exception 'Código de rol inválido: 2 a 30 letras minúsculas, números o guion bajo';
    end if;
    if coalesce(trim(p_nombre), '') = '' then
        raise exception 'El rol necesita un nombre';
    end if;
    select x into malo from unnest(coalesce(p_portales, '{}')) x
     where x <> '*' and not exists (select 1 from portales p where p.id = x) limit 1;
    if malo is not null then
        raise exception 'El portal % no existe', malo;
    end if;
    if rid = yo->>'rol' and not coalesce(p_gestionar, false) then
        raise exception 'No puedes quitarle la gestión de usuarios a tu propio rol';
    end if;

    insert into roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios)
    values (rid, trim(p_nombre), coalesce(p_portales, '{}'), coalesce(p_personalizar, false), coalesce(p_gestionar, false))
    on conflict (id) do update
       set nombre = excluded.nombre,
           portales = excluded.portales,
           puede_personalizar = excluded.puede_personalizar,
           puede_gestionar_usuarios = excluded.puede_gestionar_usuarios;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_eliminar_rol(p_token uuid, p_id text)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if p_id = 'superadmin' then
        raise exception 'El rol superadmin no se puede borrar';
    end if;
    if exists (select 1 from usuarios_admin where rol = p_id) then
        raise exception 'Hay usuarios con este rol. Cámbiales el rol primero.';
    end if;
    delete from roles where id = p_id;
    return json_build_object('ok', true);
end $$;

grant execute on function public.validar_sesion(uuid)                       to anon, authenticated;
grant execute on function public.login_admin(text, text)                    to anon, authenticated;
grant execute on function public.guardar_efecto_global(uuid, text, text, int) to anon, authenticated;
grant execute on function public.admin_listar(uuid)                         to anon, authenticated;
grant execute on function public.admin_guardar_usuario(uuid, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.admin_guardar_rol(uuid, text, text, text[], boolean, boolean) to anon, authenticated;
grant execute on function public.admin_eliminar_rol(uuid, text)             to anon, authenticated;


-- Cierra sesiones viejas: todos vuelven a entrar con la versión corregida
delete from public.admin_sesiones;

-- DIAGNÓSTICO: así verá la página a coachniko al entrar.
-- Debe decir "rol": "superadmin", "gestionar": true, "personalizar": true.
insert into public.admin_sesiones (usuario, expira)
select usuario, now() + interval '1 minute' from public.usuarios_admin where lower(usuario) = 'coachniko';

select (public.validar_sesion(s.token)::jsonb - 'token') as coachniko_ve
  from public.admin_sesiones s
 where lower(s.usuario) = 'coachniko'
 order by s.creada desc
 limit 1;
