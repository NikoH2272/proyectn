-- =====================================================================
--  PUMAS GAMING · 31 · Usuarios propios de cada portal
--  Requiere 28 (usa _rol_aparte y admin_listar). Se puede correr las veces que quieras.
--
--  · Cada portal (Dragon Fest, ZMF, ROW, Rusheo, QFD, Pruebas, módulos...)
--    puede tener su STAFF: usuarios que solo entran a ese portal.
--    Su rol se crea solo: staff_<portal> (en Pumas sigue siendo staff_pumas).
--  · El ADMIN del portal crea, edita y borra a su staff, sin ver a nadie más.
--  · El SUPERADMIN ve los usuarios de cada portal y crea sus ADMINISTRADORES
--    (si el portal no tiene rol de admin, se crea admin_<portal>).
--  · En Usuarios y roles, los staff solo los ve el superadmin.
-- =====================================================================

-- Rol de admin de un portal: el rol (que no es superadmin, ni de staff, ni de
-- moderador, ni de "todos los portales") que incluye ese portal; el más específico.
create or replace function public._rol_admin_portal(p_portal text)
returns text language sql stable
set search_path = public
as $$
    select r.id from roles r
     where p_portal = any(r.portales) and not ('*' = any(r.portales))
       and r.id not like 'staff\_%' and r.id not in ('superadmin', 'moderador_aza', 'administradorascensos')
     order by array_length(r.portales, 1), r.id
     limit 1;
$$;

-- Rol de staff de un portal (se crea si no existe). Ve los mismos portales que el admin
-- (p. ej. Dragon Fest mixto y femenino).
create or replace function public._rol_staff_portal(p_portal text)
returns text language plpgsql
set search_path = public
as $$
declare
    v_id text := case when p_portal = 'entrenamientos' then 'staff_pumas' else 'staff_' || p_portal end;
    v_portales text[];
    v_nombre text;
begin
    if not exists (select 1 from roles where id = v_id) then
        select coalesce((select r.portales from roles r where r.id = _rol_admin_portal(p_portal)), array[p_portal]) into v_portales;
        select nombre into v_nombre from portales where id = p_portal;
        insert into roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios)
        values (v_id, 'Staff ' || coalesce(v_nombre, p_portal), v_portales, false, false);
    end if;
    return v_id;
end $$;

-- ¿Puede manejar el staff de ese portal? superadmin, o su admin
create or replace function public._jefe_portal(ses json, p_portal text)
returns boolean language sql stable
set search_path = public
as $$
    select ses->>'rol' = 'superadmin'
        or (ses->>'rol' not like 'staff\_%' and ses->>'rol' not in ('moderador_aza')
            and exists (select 1 from roles r where r.id = ses->>'rol' and p_portal = any(r.portales)));
$$;
revoke execute on function public._rol_admin_portal(text) from public, anon, authenticated;
revoke execute on function public._rol_staff_portal(text) from public, anon, authenticated;
revoke execute on function public._jefe_portal(json, text) from public, anon, authenticated;

-- Usuarios del portal: admins (rol de admin del portal) y staff
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
        'staff', (select coalesce(json_agg(json_build_object('usuario', u.usuario, 'nombre', u.nombre, 'activo', u.activo) order by lower(u.usuario)), '[]'::json)
                    from usuarios_admin u where u.rol = v_staff));
end $$;

-- Crear o editar. p_tipo: 'staff' (admin del portal o superadmin) · 'admin' (solo superadmin).
-- p_clave null → no cambia la clave.
create or replace function public.portal_usuario_guardar(p_token uuid, p_portal text, p_usuario text, p_nombre text, p_clave text, p_activo boolean, p_tipo text)
returns json language plpgsql security definer
set search_path = public, extensions
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
    v_rol text;
    v_nombre_portal text;
    rol_actual text;
    existe boolean := false;
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_portal(ses, p_portal) then raise exception 'No puedes manejar los usuarios de este portal'; end if;
    if p_tipo not in ('staff', 'admin') then raise exception 'Tipo de usuario inválido'; end if;
    if p_tipo = 'admin' and ses->>'rol' <> 'superadmin' then raise exception 'Solo el superadmin crea administradores de un portal'; end if;
    if u !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Usuario inválido: 3 a 30 letras minúsculas, números, punto o guion (sin @ ni espacios)'; end if;
    if p_clave is not null and length(p_clave) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;

    if p_tipo = 'staff' then
        v_rol := _rol_staff_portal(p_portal);
    else
        v_rol := _rol_admin_portal(p_portal);
        if v_rol is null then   -- el portal no tiene rol de admin: se crea
            select nombre into v_nombre_portal from portales where id = p_portal;
            v_rol := 'admin_' || p_portal;
            insert into roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios)
            values (v_rol, 'Admin ' || coalesce(v_nombre_portal, p_portal), array[p_portal], false, false)
            on conflict (id) do nothing;
        end if;
    end if;

    select rol, true into rol_actual, existe from usuarios_admin where lower(usuario) = u;
    if coalesce(existe, false) and coalesce(rol_actual, '') <> v_rol then
        raise exception 'Ese usuario ya existe con otro rol: elige otro nombre de usuario';
    end if;
    if u = lower(ses->>'usuario') and coalesce(p_activo, true) = false then raise exception 'No puedes desactivarte a ti mismo'; end if;

    if coalesce(existe, false) then
        update usuarios_admin
           set nombre = coalesce(nullif(trim(p_nombre), ''), nombre), activo = coalesce(p_activo, activo),
               password = case when p_clave is not null then crypt(p_clave, gen_salt('bf')) else password end
         where lower(usuario) = u;
        if p_clave is not null or not coalesce(p_activo, true) then delete from admin_sesiones where lower(usuario) = u; end if;
    else
        if p_clave is null then raise exception 'Para crear el usuario ponle contraseña'; end if;
        insert into usuarios_admin (usuario, nombre, rol, activo, password)
        values (u, coalesce(nullif(trim(p_nombre), ''), u), v_rol, coalesce(p_activo, true), crypt(p_clave, gen_salt('bf')));
        -- En Pumas el staff necesita sus módulos (sql/28): se le dan los de cargar resultados
        if v_rol = 'staff_pumas' then
            insert into pumas_permisos (usuario, modulos, actualizado_por) values (u, '{cargar,cargarStats}', ses->>'usuario')
            on conflict (usuario) do nothing;
        end if;
    end if;
    return json_build_object('ok', true, 'rol', v_rol);
end $$;

create or replace function public.portal_usuario_borrar(p_token uuid, p_portal text, p_usuario text)
returns json language plpgsql security definer
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
    v_rol text;
    v_staff text := case when p_portal = 'entrenamientos' then 'staff_pumas' else 'staff_' || p_portal end;
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_portal(ses, p_portal) then raise exception 'No puedes manejar los usuarios de este portal'; end if;
    if u = lower(ses->>'usuario') then raise exception 'No puedes borrarte a ti mismo'; end if;
    select rol into v_rol from usuarios_admin where lower(usuario) = u;
    if v_rol is null then raise exception 'Ese usuario no existe'; end if;
    if v_rol = v_staff then
        null;   -- staff del portal: lo borra su admin o el superadmin
    elsif ses->>'rol' = 'superadmin' and v_rol = _rol_admin_portal(p_portal) then
        null;   -- admin del portal: solo el superadmin
    else
        raise exception 'Ese usuario no es de este portal o no puedes borrarlo';
    end if;
    delete from admin_sesiones where lower(usuario) = u;
    delete from pumas_permisos where usuario = u;
    delete from usuarios_admin where lower(usuario) = u;
    return json_build_object('ok', true);
end $$;

-- Usuarios y roles: los staff de cualquier portal también solo los ve el superadmin
create or replace function public._rol_aparte(p_rol text)
returns boolean language sql stable
set search_path = public
as $$
    select p_rol like 'staff\_%'
        or coalesce((select r.portales in ('{ascensosaza}'::text[], '{entrenamientos}'::text[]) from roles r where r.id = p_rol), false);
$$;
revoke execute on function public._rol_aparte(text) from public, anon, authenticated;

grant execute on function public.portal_usuarios(uuid, text) to anon, authenticated;
grant execute on function public.portal_usuario_guardar(uuid, text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.portal_usuario_borrar(uuid, text, text) to anon, authenticated;
