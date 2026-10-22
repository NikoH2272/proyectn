-- =====================================================================
--  PROYECTN · 52 · Ascensos Rusheo — portal independiente
--  Requiere 17, 18, 19, 20. Se puede correr las veces que quieras.
--
--  · Crea el portal ascensosrusheo con sus dos categorías.
--  · Crea el rol moderador_rusheo (independiente de moderador_aza).
--  · Actualiza las funciones de moderadores para que reciban p_portal
--    y trabajen con el rol correcto según el portal.
--  · Actualiza asc_mis_permisos e ia_autorizar para soportar Rusheo.
--  · Actualiza asc_guardar_jornada para el rol moderador_rusheo.
-- =====================================================================

-- ── 1. Portal ────────────────────────────────────────────────────────
insert into public.portales (id, nombre, tipo)
values ('ascensosrusheo', 'Ascensos Rusheo', 'ascensos')
on conflict (id) do update set nombre = 'Ascensos Rusheo', tipo = 'ascensos';

-- ── 3. Rol moderador_rusheo ───────────────────────────────────────────
insert into public.roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios, padre)
values ('moderador_rusheo', 'Moderador Ascensos Rusheo', '{ascensosrusheo}', false, false, 'administradorascensos')
on conflict (id) do update set portales = '{ascensosrusheo}', padre = 'administradorascensos';

-- ── 4. Helper: rol de moderador según portal ──────────────────────────
create or replace function public._rol_mod_asc(p_portal text)
returns text language sql immutable as $$
    select case p_portal
        when 'ascensosaza'    then 'moderador_aza'
        when 'ascensosrusheo' then 'moderador_rusheo'
        else null
    end;
$$;
revoke execute on function public._rol_mod_asc(text) from public, anon, authenticated;

-- ── 5. Helper: ¿puede administrar ascensos EN ese portal? ─────────────
--   Reemplaza _jefe_ascensos(json) para añadir el rol rusheo.
create or replace function public._jefe_ascensos(ses json)
returns boolean language sql immutable as $$
    select coalesce((ses->>'gestionar')::boolean, false)
        or ses->>'rol' in ('administradorascensos', 'aza', 'rusheo');
$$;
revoke execute on function public._jefe_ascensos(json) from public, anon, authenticated;

-- ── 6. asc_mod_listar — ahora recibe p_portal ────────────────────────
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
                'ia', coalesce(p.ia, false), 'eventos', p.eventos) order by lower(u.usuario)), '[]'::json)
              from usuarios_admin u
              left join asc_permisos p on p.usuario = lower(u.usuario) and p.portal = p_portal
             where u.rol = rol_mod);
end $$;

-- ── 7. asc_mod_guardar — ahora recibe p_portal ───────────────────────
create or replace function public.asc_mod_guardar(
    p_token uuid, p_usuario text, p_nombre text, p_clave text, p_activo boolean, p_ia boolean, p_eventos text[],
    p_portal text default 'ascensosaza'
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
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_ascensos(ses) then raise exception 'Solo el Administrador Ascensos maneja moderadores'; end if;
    if rol_mod is null then raise exception 'Portal no soportado: %', p_portal; end if;
    if u !~ '^[a-z0-9._-]{3,30}$' then
        raise exception 'Usuario inválido: 3 a 30 letras minúsculas, números, punto o guion (sin @ ni espacios)';
    end if;
    if p_clave is not null and length(p_clave) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;

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

    insert into asc_permisos (usuario, portal, ia, eventos, actualizado, actualizado_por)
    values (u, p_portal, coalesce(p_ia, false), p_eventos, now(), ses->>'usuario')
    on conflict (usuario) do update
       set portal = p_portal, ia = coalesce(p_ia, asc_permisos.ia),
           eventos = p_eventos, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

-- ── 8. asc_mod_borrar — ahora recibe p_portal ────────────────────────
create or replace function public.asc_mod_borrar(p_token uuid, p_usuario text, p_portal text default 'ascensosaza')
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
    rol_mod text := _rol_mod_asc(p_portal);
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_ascensos(ses) then raise exception 'No puedes manejar moderadores'; end if;
    if rol_mod is null then raise exception 'Portal no soportado: %', p_portal; end if;
    if not exists (select 1 from usuarios_admin where lower(usuario) = u and rol = rol_mod) then
        raise exception 'Ese usuario no es un moderador de %', p_portal;
    end if;
    delete from admin_sesiones where lower(usuario) = u;
    delete from asc_permisos where usuario = u and portal = p_portal;
    delete from usuarios_admin where lower(usuario) = u and rol = rol_mod;
    return json_build_object('ok', true);
end $$;

-- ── 9. asc_mis_permisos — soporte para moderador_rusheo ──────────────
create or replace function public.asc_mis_permisos(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    rol_mod text := _rol_mod_asc(p_portal);
    pm asc_permisos;
begin
    if rol_mod is not null and ses->>'rol' = rol_mod then
        select * into pm from asc_permisos where usuario = lower(ses->>'usuario') and portal = p_portal;
        return json_build_object('jefe', false, 'moderador', true, 'nombre', ses->>'nombre',
            'ia', coalesce(pm.ia, false), 'eventos', case when pm.usuario is null then '{}'::text[] else pm.eventos end);
    end if;
    return json_build_object('jefe', _jefe_ascensos(ses), 'moderador', false, 'nombre', ses->>'nombre', 'ia', true, 'eventos', null);
end $$;

-- ── 10. ia_autorizar — permite ascensosrusheo ─────────────────────────
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
    limite int := case p_portal when 'ascensosrusheo' then 4 else 40 end;
    dia_semana int;
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
    if rol_mod is not null and ses->>'rol' = rol_mod
       and not coalesce((select ia from asc_permisos where usuario = lower(quien) and portal = p_portal), false) then
        raise exception 'Tu usuario no tiene habilitada la IA. Pídesela al Administrador Ascensos.';
    end if;
    if coalesce(p_imagenes, 0) < 1 or p_imagenes > 16 then
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

-- ── 11. asc_guardar_jornada — soporte para moderador_rusheo ──────────
create or replace function public.asc_guardar_jornada(p_token uuid, p_portal text, p_datos jsonb)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    quien text := ses->>'usuario';
    rol_mod text := _rol_mod_asc(p_portal);
    v_titulo text := left(trim(coalesce(p_datos->>'titulo', '')), 120);
    v_fecha timestamptz := coalesce((p_datos->>'fecha')::timestamptz, now());
    v_cat text := left(coalesce(nullif(trim(p_datos->>'categoria'), ''), 'general'), 30);
    permitidos text[];
    nuevo bigint;
begin
    if not exists (select 1 from portales where id = p_portal and tipo = 'ascensos') then
        raise exception 'Este portal no guarda ascensos: %', p_portal;
    end if;
    if rol_mod is not null and ses->>'rol' = rol_mod then
        select coalesce(eventos, null) into permitidos from asc_permisos where usuario = lower(quien) and portal = p_portal;
        if not found then permitidos := '{}'; end if;
        if permitidos is not null and not (v_cat = any(permitidos)) then
            raise exception 'No tienes habilitado este evento. Pídeselo al Administrador Ascensos.';
        end if;
    end if;
    if v_titulo = '' then
        raise exception 'La jornada necesita un título';
    end if;
    if jsonb_typeof(p_datos->'equipos') <> 'array' or jsonb_array_length(p_datos->'equipos') = 0 then
        raise exception 'No hay equipos para guardar';
    end if;
    if jsonb_array_length(p_datos->'equipos') > 80 or pg_column_size(p_datos) > 200000 then
        raise exception 'Demasiados datos en una sola jornada';
    end if;
    if exists (select 1 from asc_jornadas where portal = p_portal and titulo = v_titulo and fecha = v_fecha) then
        raise exception 'Esta jornada ya está guardada (mismo título y fecha)';
    end if;
    insert into asc_jornadas (portal, categoria, titulo, fecha, horario, moderador, salas, modo, equipos, clasificados, creado_por)
    values (p_portal, v_cat, v_titulo, v_fecha,
            left(nullif(trim(p_datos->>'horario'), ''), 40),
            left(nullif(trim(p_datos->>'moderador'), ''), 60),
            least(greatest(coalesce((p_datos->>'salas')::int, 0), 0), 20),
            case when p_datos->>'modo' = 'top_kill' then 'top_kill' else 'top' end,
            p_datos->'equipos',
            coalesce(p_datos->'clasificados', '[]'),
            quien)
    returning id into nuevo;
    return json_build_object('ok', true, 'id', nuevo);
end $$;

-- ── 12. Config inicial motores Rusheo ────────────────────────────────
insert into public.sitio_config (clave, valor)
values ('ia_motores_rusheo', '{"activos": ["claude"], "defecto": "claude"}')
on conflict (clave) do nothing;

-- ── 13. admin_ia_motores — recibe p_portal ────────────────────────────
create or replace function public.admin_ia_motores(p_token uuid, p_activos text[], p_defecto text, p_portal text default 'ascensosaza')
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'gestionar')->>'usuario';
    malo text;
    clave_cfg text := case p_portal
        when 'ascensosrusheo' then 'ia_motores_rusheo'
        else 'ia_motores'
    end;
begin
    select x into malo from unnest(coalesce(p_activos, '{}')) x
     where x not in ('gemini', 'privado', 'claude') limit 1;
    if malo is not null then raise exception 'Motor desconocido: %', malo; end if;
    if p_defecto is not null and not (p_defecto = any(coalesce(p_activos, '{}'))) then
        raise exception 'El motor por defecto tiene que estar activo';
    end if;
    insert into sitio_config (clave, valor, actualizado, actualizado_por)
    values (clave_cfg, jsonb_build_object('activos', coalesce(to_jsonb(p_activos), '[]'::jsonb), 'defecto', p_defecto), now(), quien)
    on conflict (clave) do update set valor = excluded.valor, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

-- ── 14. Permisos ──────────────────────────────────────────────────────
grant execute on function public.asc_mod_listar(uuid, text)                                                         to anon, authenticated;
grant execute on function public.asc_mod_guardar(uuid, text, text, text, boolean, boolean, text[], text)            to anon, authenticated;
grant execute on function public.asc_mod_borrar(uuid, text, text)                                                   to anon, authenticated;
grant execute on function public.asc_mis_permisos(uuid, text)                                                       to anon, authenticated;
grant execute on function public.ia_autorizar(uuid, text, int)                                                      to anon, authenticated;
grant execute on function public.asc_guardar_jornada(uuid, text, jsonb)                                             to anon, authenticated;
grant execute on function public.admin_ia_motores(uuid, text[], text, text)                                         to anon, authenticated;
