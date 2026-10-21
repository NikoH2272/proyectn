-- =====================================================================
--  PUMAS GAMING · 19 · Moderadores de Ascensos AZA y registro VIP de Pumas
--  Requiere 17 y 18. Se puede correr las veces que quieras.
--
--  · Moderadores de AZA: los crea el Administrador Ascensos (o el
--    superadmin) desde la herramienta de AZA. Pueden abrir cupos y subir
--    resultados. La IA viene APAGADA por defecto y solo pueden usar los
--    eventos que les habiliten (asc_permisos).
--  · Registro VIP (Entrenos Pumas): página pública /entrenamientos/vip.html.
--    Las solicitudes (nombre, tag, número del representante y horarios)
--    llegan al panel de Pumas; al aprobarlas pasan a equipos_registrados.
-- =====================================================================

-- 1) MODERADORES DE AZA ---------------------------------------------------
insert into public.roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios, padre) values
    ('moderador_aza', 'Moderador Ascensos AZA', '{ascensosaza}', false, false, 'administradorascensos')
on conflict (id) do update set portales = '{ascensosaza}', padre = 'administradorascensos';

-- Permisos de cada moderador: IA (apagada por defecto) y eventos que puede hacer
-- eventos = null → todos · '{}' → ninguno · '{ev_fuego,ev_nova}' → solo esos
create table if not exists public.asc_permisos (
    usuario     text primary key,          -- en minúsculas
    portal      text not null default 'ascensosaza' references public.portales(id) on delete cascade,
    ia          boolean not null default false,
    eventos     text[],
    actualizado timestamptz not null default now(),
    actualizado_por text
);
alter table public.asc_permisos enable row level security;   -- sin políticas: solo vía funciones

-- ¿Puede administrar ascensos? (Administrador Ascensos o superadmin)
create or replace function public._jefe_ascensos(ses json)
returns boolean language sql immutable as $$
    select coalesce((ses->>'gestionar')::boolean, false) or ses->>'rol' = 'administradorascensos';
$$;
revoke execute on function public._jefe_ascensos(json) from public, anon, authenticated;

-- Lo que puede hacer el usuario en la herramienta de un portal de ascensos
create or replace function public.asc_mis_permisos(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    pm asc_permisos;
begin
    if ses->>'rol' = 'moderador_aza' then
        select * into pm from asc_permisos where usuario = lower(ses->>'usuario');
        return json_build_object('jefe', false, 'moderador', true, 'nombre', ses->>'nombre',
            'ia', coalesce(pm.ia, false), 'eventos', case when pm.usuario is null then '{}'::text[] else pm.eventos end);
    end if;
    return json_build_object('jefe', _jefe_ascensos(ses), 'moderador', false, 'nombre', ses->>'nombre', 'ia', true, 'eventos', null);
end $$;

create or replace function public.asc_mod_listar(p_token uuid)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_ascensos(ses) then raise exception 'Solo el Administrador Ascensos maneja moderadores'; end if;
    return (select coalesce(json_agg(json_build_object(
                'usuario', u.usuario, 'nombre', u.nombre, 'activo', u.activo,
                'ia', coalesce(p.ia, false), 'eventos', p.eventos) order by lower(u.usuario)), '[]'::json)
              from usuarios_admin u
              left join asc_permisos p on p.usuario = lower(u.usuario)
             where u.rol = 'moderador_aza');
end $$;

-- Crea o edita un moderador. p_clave null → no cambia la clave.
create or replace function public.asc_mod_guardar(
    p_token uuid, p_usuario text, p_nombre text, p_clave text, p_activo boolean, p_ia boolean, p_eventos text[]
)
returns json
language plpgsql security definer
set search_path = public, extensions
as $$
declare
    ses json := validar_sesion(p_token);
    u text := lower(trim(coalesce(p_usuario, '')));
    rol_actual text;
    existe boolean := false;
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    if not _jefe_ascensos(ses) then raise exception 'Solo el Administrador Ascensos maneja moderadores'; end if;
    if u !~ '^[a-z0-9._-]{3,30}$' then
        raise exception 'Usuario inválido: 3 a 30 letras minúsculas, números, punto o guion (sin @ ni espacios)';
    end if;
    if p_clave is not null and length(p_clave) < 6 then raise exception 'La contraseña debe tener al menos 6 caracteres'; end if;

    select rol, true into rol_actual, existe from usuarios_admin where lower(usuario) = u;
    if coalesce(existe, false) and coalesce(rol_actual, '') <> 'moderador_aza' then
        raise exception 'Ese usuario ya existe con otro rol: elige otro nombre de usuario';
    end if;

    if coalesce(existe, false) then
        update usuarios_admin
           set nombre   = coalesce(nullif(trim(p_nombre), ''), nombre),
               activo   = coalesce(p_activo, activo),
               password = case when p_clave is not null then crypt(p_clave, gen_salt('bf')) else password end
         where lower(usuario) = u;
        if p_clave is not null or not coalesce(p_activo, true) then
            delete from admin_sesiones where lower(usuario) = u;   -- se cierra su sesión
        end if;
    else
        if p_clave is null then raise exception 'Para crear un moderador debes ponerle contraseña'; end if;
        insert into usuarios_admin (usuario, nombre, rol, activo, password)
        values (u, coalesce(nullif(trim(p_nombre), ''), u), 'moderador_aza', coalesce(p_activo, true), crypt(p_clave, gen_salt('bf')));
    end if;

    insert into asc_permisos (usuario, ia, eventos, actualizado, actualizado_por)
    values (u, coalesce(p_ia, false), p_eventos, now(), ses->>'usuario')
    on conflict (usuario) do update
       set ia = coalesce(p_ia, asc_permisos.ia), eventos = p_eventos, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

-- IA: los moderadores solo si se la habilitaron (resto igual que en sql/18)
create or replace function public.ia_autorizar(p_token uuid, p_portal text, p_imagenes int)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    quien text := ses->>'usuario';
    hoy int;
    limite constant int := 40;
begin
    if p_portal <> 'ascensosaza' then
        raise exception 'La lectura con IA es solo para Ascensos AZA';
    end if;
    if ses->>'rol' = 'moderador_aza'
       and not coalesce((select ia from asc_permisos where usuario = lower(quien)), false) then
        raise exception 'Tu usuario no tiene habilitada la IA. Pídesela al Administrador Ascensos.';
    end if;
    if coalesce(p_imagenes, 0) < 1 or p_imagenes > 16 then
        raise exception 'Sube de 1 a 16 capturas por lectura';
    end if;
    select count(*) into hoy from ia_uso
     where lower(usuario) = lower(quien) and creado > now() - interval '1 day';
    if hoy >= limite then
        raise exception 'Llegaste al límite de % lecturas con IA en 24 horas', limite;
    end if;
    insert into ia_uso (usuario, portal, imagenes) values (quien, p_portal, p_imagenes);
    return json_build_object('ok', true, 'usuario', quien, 'quedan', limite - hoy - 1);
end $$;

-- Guardar jornada: los moderadores solo en sus eventos (resto igual que en sql/17)
create or replace function public.asc_guardar_jornada(p_token uuid, p_portal text, p_datos jsonb)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    quien text := ses->>'usuario';
    v_titulo text := left(trim(coalesce(p_datos->>'titulo', '')), 120);
    v_fecha timestamptz := coalesce((p_datos->>'fecha')::timestamptz, now());
    v_cat text := left(coalesce(nullif(trim(p_datos->>'categoria'), ''), 'general'), 30);
    permitidos text[];
    nuevo bigint;
begin
    if not exists (select 1 from portales where id = p_portal and tipo = 'ascensos') then
        raise exception 'Este portal no guarda ascensos: %', p_portal;
    end if;
    if ses->>'rol' = 'moderador_aza' then
        select coalesce(eventos, null) into permitidos from asc_permisos where usuario = lower(quien);
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


-- 2) REGISTRO VIP (Entrenos Pumas) -------------------------------------------
create table if not exists public.vip_registros (
    id        bigint generated always as identity primary key,
    nombre    text not null,
    tag       text not null,
    telefono  text not null,                -- dato personal: solo lo ve el admin de Pumas
    horarios  text[] not null default '{}', -- 10AM, 1PM, 4PM, 6PM, 8PM
    estado    text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    creado    timestamptz not null default now()
);
alter table public.vip_registros enable row level security;   -- sin políticas: privado

-- Público: registrarse
create or replace function public.vip_registrar(p_nombre text, p_tag text, p_telefono text, p_horarios text[])
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    v_nom text := upper(left(trim(coalesce(p_nombre, '')), 60));
    v_tag text := upper(left(trim(coalesce(p_tag, '')), 10));
    v_hor text[];
begin
    if v_nom = '' or v_tag = '' or length(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g')) < 7 then
        raise exception 'Completa nombre del equipo, tag y un número válido del representante';
    end if;
    select array_agg(distinct h order by h) into v_hor
      from unnest(coalesce(p_horarios, '{}')) h where h in ('10AM', '1PM', '4PM', '6PM', '8PM');
    if v_hor is null then raise exception 'Elige al menos un horario'; end if;
    if (select count(*) from vip_registros where creado > now() - interval '1 day') >= 300 then
        raise exception 'Hay demasiados registros hoy, intenta mañana';
    end if;
    if exists (select 1 from vip_registros where estado <> 'RECHAZADO'
                and regexp_replace(lower(nombre), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v_nom), '[^a-z0-9]', '', 'g')) then
        raise exception 'Ese equipo ya tiene un registro VIP';
    end if;
    insert into vip_registros (nombre, tag, telefono, horarios)
    values (v_nom, v_tag, left(trim(p_telefono), 30), v_hor);
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_vip_registros(p_token uuid)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:entrenamientos');
    return (select coalesce(json_agg(to_json(v) order by (v.estado = 'PENDIENTE') desc, v.creado desc), '[]'::json) from vip_registros v);
end $$;

-- Aprobar (pasa a la lista VIP: equipos_registrados), rechazar o volver a pendiente
create or replace function public.admin_vip_estado(p_token uuid, p_id bigint, p_estado text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare r vip_registros;
begin
    perform _exigir_permiso(p_token, 'portal:entrenamientos');
    if p_estado not in ('PENDIENTE', 'APROBADO', 'RECHAZADO') then raise exception 'Estado inválido'; end if;
    select * into r from vip_registros where id = p_id;
    if not found then raise exception 'Ese registro no existe'; end if;
    update vip_registros set estado = p_estado where id = p_id;
    if p_estado = 'APROBADO' and not exists (
        select 1 from equipos_registrados
         where regexp_replace(lower(nombre), '[^a-z0-9]', '', 'g') = regexp_replace(lower(r.nombre), '[^a-z0-9]', '', 'g')) then
        insert into equipos_registrados (nombre, tag) values (r.nombre, r.tag);
    end if;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_vip_borrar(p_token uuid, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:entrenamientos');
    delete from vip_registros where id = p_id;
    return json_build_object('ok', true);
end $$;


-- 3) RESPALDO: suma las tablas nuevas -------------------------------------
create or replace function public.admin_respaldo(p_token uuid)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'gestionar')->>'usuario';
    tablas text[] := array[
        'portales', 'roles', 'usuarios_admin', 'portal_config', 'sitio_config', 'torneos_aliados',
        'portal_equipos', 'portal_sesiones', 'portal_salas', 'portal_killers', 'portal_programados', 'portal_cupos',
        'asc_jornadas', 'asc_baneados', 'asc_permisos', 'sorteos', 'sorteo_registros', 'ia_uso', 'vip_registros',
        'entrenamientos_sesiones', 'salas_resultados', 'top_killers', 'equipos_registrados',
        'entrenamientos_programados', 'registro_cupos', 'sorteo_equipos', 'sorteo_config'];
    t text;
    filas jsonb;
    datos jsonb := '{}';
    conteo jsonb := '{}';
begin
    foreach t in array tablas loop
        if to_regclass('public.' || t) is null then
            continue;
        end if;
        execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from public.%I x', t) into filas;
        if t = 'usuarios_admin' then   -- nunca se exportan las contraseñas cifradas
            select coalesce(jsonb_agg(f - 'password'), '[]') into filas from jsonb_array_elements(filas) f;
        end if;
        datos := datos || jsonb_build_object(t, filas);
        conteo := conteo || jsonb_build_object(t, jsonb_array_length(filas));
    end loop;
    return jsonb_build_object('respaldo', 'pumasgaming', 'version', 3, 'creado', now(), 'creado_por', quien,
                              'filas_por_tabla', conteo, 'tablas', datos);
end $$;

grant execute on function public.asc_mis_permisos(uuid, text)                                  to anon, authenticated;
grant execute on function public.asc_mod_listar(uuid)                                          to anon, authenticated;
grant execute on function public.asc_mod_guardar(uuid, text, text, text, boolean, boolean, text[]) to anon, authenticated;
grant execute on function public.ia_autorizar(uuid, text, int)                                 to anon, authenticated;
grant execute on function public.asc_guardar_jornada(uuid, text, jsonb)                        to anon, authenticated;
grant execute on function public.vip_registrar(text, text, text, text[])                      to anon, authenticated;
grant execute on function public.admin_vip_registros(uuid)                                     to anon, authenticated;
grant execute on function public.admin_vip_estado(uuid, bigint, text)                          to anon, authenticated;
grant execute on function public.admin_vip_borrar(uuid, bigint)                                to anon, authenticated;
grant execute on function public.admin_respaldo(uuid)                                          to anon, authenticated;

-- Revisión
select id, nombre, padre, portales from public.roles where id in ('administradorascensos', 'moderador_aza', 'aza');
