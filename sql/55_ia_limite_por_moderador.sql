-- =====================================================================
--  PROYECTN · 55 · Límite diario de IA configurable por moderador
--  Requiere 52. Se puede correr las veces que quieras.
--
--  · Añade ia_limite_diario a asc_permisos (null = usar el default del portal).
--  · Actualiza asc_mod_guardar para aceptar el nuevo parámetro.
--  · Actualiza asc_mod_listar para devolver ia_limite_diario.
--  · Actualiza ia_autorizar para usar el límite del usuario si está definido.
-- =====================================================================

-- 1) Columna en asc_permisos ------------------------------------------
alter table public.asc_permisos
    add column if not exists ia_limite_diario int check (ia_limite_diario is null or (ia_limite_diario >= 0 and ia_limite_diario <= 9999));

-- 2) asc_mod_listar — devuelve ia_limite_diario -----------------------
create or replace function public.asc_mod_listar(p_token uuid, p_portal text default 'ascensosaza')
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
    rol_mod text := _rol_mod_asc(p_portal);
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_ascensos(ses) then raise exception 'Solo el Administrador Ascensos maneja moderadores'; end if;
    if rol_mod is null then raise exception 'Portal no soportado: %', p_portal; end if;
    return (select coalesce(json_agg(json_build_object(
                'usuario', u.usuario, 'nombre', u.nombre, 'activo', u.activo,
                'ia', coalesce(p.ia, false), 'eventos', p.eventos,
                'ia_limite_diario', p.ia_limite_diario) order by lower(u.usuario)), '[]'::json)
              from usuarios_admin u
              left join asc_permisos p on p.usuario = lower(u.usuario) and p.portal = p_portal
             where u.rol = rol_mod);
end $$;

-- 3) asc_mod_guardar — acepta p_ia_limite (null = default del portal) -
create or replace function public.asc_mod_guardar(
    p_token uuid, p_usuario text, p_nombre text, p_clave text, p_activo boolean, p_ia boolean, p_eventos text[],
    p_portal text default 'ascensosaza',
    p_ia_limite int default null
)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
    rol_mod text := _rol_mod_asc(p_portal);
    rol_actual text;
    existe boolean := false;
    lim int := nullif(p_ia_limite, 0);   -- 0 equivale a "sin límite especial" → null
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_ascensos(ses) then raise exception 'Solo el Administrador Ascensos maneja moderadores'; end if;
    if rol_mod is null then raise exception 'Portal no soportado: %', p_portal; end if;
    if u !~ '^[a-z0-9._-]{3,30}$' then
        raise exception 'Usuario inválido: 3 a 30 letras minúsculas, números, punto o guion (sin @ ni espacios)';
    end if;
    if p_clave is not null and length(p_clave) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;
    if lim is not null and (lim < 0 or lim > 9999) then raise exception 'El límite diario debe ser entre 0 y 9999'; end if;

    select rol, true into rol_actual, existe from usuarios_admin where lower(usuario) = u;
    if coalesce(existe, false) and coalesce(rol_actual, '') <> rol_mod then
        raise exception 'Ese usuario ya existe con otro rol: elige otro nombre de usuario';
    end if;

    if coalesce(existe, false) then
        update usuarios_admin
           set nombre   = coalesce(nullif(trim(p_nombre), ''), nombre),
               activo   = coalesce(p_activo, activo),
               password = case when p_clave is not null then crypt(p_clave, gen_salt('bf')) else password end
         where lower(usuario) = u;
        if p_clave is not null or not coalesce(p_activo, true) then
            delete from admin_sesiones where lower(usuario) = u;
        end if;
    else
        if p_clave is null then raise exception 'Para crear un moderador debes ponerle contraseña'; end if;
        insert into usuarios_admin (usuario, nombre, rol, activo, password)
        values (u, coalesce(nullif(trim(p_nombre), ''), u), rol_mod, coalesce(p_activo, true), crypt(p_clave, gen_salt('bf')));
    end if;

    insert into asc_permisos (usuario, portal, ia, eventos, ia_limite_diario, actualizado, actualizado_por)
    values (u, p_portal, coalesce(p_ia, false), p_eventos, lim, now(), ses->>'usuario')
    on conflict (usuario) do update
       set portal = p_portal, ia = coalesce(p_ia, asc_permisos.ia),
           eventos = p_eventos,
           ia_limite_diario = lim,
           actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

-- 4) ia_autorizar — usa el límite del usuario cuando está definido -----
create or replace function public.ia_autorizar(p_token uuid, p_portal text, p_imagenes int)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    quien text := ses->>'usuario';
    rol_mod text := _rol_mod_asc(p_portal);
    hoy int;
    limite_defecto int := case p_portal when 'ascensosrusheo' then 4 else 40 end;
    limite int;
    dia_semana int;
    perm asc_permisos;
begin
    if p_portal not in ('ascensosaza', 'ascensosrusheo') then
        raise exception 'La lectura con IA no está habilitada para este portal';
    end if;
    -- Ascensos Rusheo: solo lunes a viernes (hora México)
    if p_portal = 'ascensosrusheo' then
        dia_semana := extract(isodow from now() at time zone 'America/Mexico_City');
        if dia_semana >= 6 then
            raise exception 'La IA de Ascensos Rusheo solo está disponible de lunes a viernes';
        end if;
    end if;
    if rol_mod is not null and ses->>'rol' = rol_mod then
        select * into perm from asc_permisos where usuario = lower(quien) and portal = p_portal;
        if not coalesce(perm.ia, false) then
            raise exception 'Tu usuario no tiene habilitada la IA. Pídesela al Administrador Ascensos.';
        end if;
        -- Límite: el del moderador (si está definido) o el default del portal
        limite := coalesce(perm.ia_limite_diario, limite_defecto);
    else
        -- Jefe / superadmin: usa el límite que tenga en asc_permisos o 9999
        select ia_limite_diario into perm from asc_permisos where usuario = lower(quien) and portal = p_portal;
        limite := coalesce(perm.ia_limite_diario, 9999);
    end if;
    if coalesce(p_imagenes, 0) < 1 then
        raise exception 'Sube al menos una captura';
    end if;
    if p_portal = 'ascensosrusheo' and p_imagenes > 8 then
        raise exception 'Máximo 8 capturas por lectura en Ascensos Rusheo (3 slots + 5 resultados)';
    end if;
    if p_imagenes > 16 then
        raise exception 'Sube de 1 a 16 capturas por lectura';
    end if;
    select count(*) into hoy from ia_uso
     where lower(usuario) = lower(quien) and portal = p_portal
       and creado > (now() at time zone 'America/Mexico_City')::date;
    if hoy >= limite then
        raise exception 'Llegaste al límite de % lecturas con IA por hoy', limite;
    end if;
    insert into ia_uso (usuario, portal, imagenes) values (quien, p_portal, p_imagenes);
    return json_build_object('ok', true, 'usuario', quien, 'quedan', limite - hoy - 1);
end $$;

-- 5) Permisos ---------------------------------------------------------
grant execute on function public.asc_mod_listar(uuid, text)                                                              to anon, authenticated;
grant execute on function public.asc_mod_guardar(uuid, text, text, text, boolean, boolean, text[], text, int)            to anon, authenticated;
grant execute on function public.ia_autorizar(uuid, text, int)                                                           to anon, authenticated;

-- Revisión
select u.usuario, p.ia, p.ia_limite_diario, p.portal
  from asc_permisos p join usuarios_admin u on lower(u.usuario) = p.usuario
 order by p.portal, u.usuario;
