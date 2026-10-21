-- =====================================================================
--  PUMAS GAMING · 17 · Ascensos AZA, Pruebas, módulos, torneos aliados,
--                      sorteos por portal, cupos y baneados
--  Requiere 01 a 12. Se puede correr las veces que quieras.
--
--  · Ascensos AZA (/ascensos/) y Pruebas (/pruebas/): base APARTE
--    (asc_jornadas), no se mezcla con los entrenos ni con LATAM.
--  · Baneados por portal (asc_baneados): lista pública, la editan los
--    usuarios con acceso a ese portal.
--  · Módulos: el superadmin crea/edita/borra portales (color, logo, título).
--    Los nuevos viven en /modulo/?p=<id>.
--  · Inicio: sección "Torneos aliados" (se activa desde el admin).
--  · Sorteos: el superadmin los activa en cualquier portal; los usuarios
--    de ese portal ven los inscritos y hacen el sorteo. Código del ticket
--    por portal: PUMAS-XXXXX, QFD-XXXXX, AZA-XXXXX...
--  · Cupos (como los de Pumas) para cualquier portal: portal_programados.
--  Nada tiene escritura pública: todo pasa por funciones que revisan la
--  sesión (menos inscribirse a un sorteo o a un cupo, que es público y
--  validado aquí).
-- =====================================================================

-- 1) PORTALES: personalización y tipo -----------------------------------
alter table public.portales add column if not exists logo       text;   -- ruta o URL del logo (null = el del código)
alter table public.portales add column if not exists titulo     text;   -- título del portal (null = el del código)
alter table public.portales add column if not exists subtitulo  text;
alter table public.portales add column if not exists color2     text;   -- color secundario
alter table public.portales add column if not exists color_tema text;   -- color principal de la página (null = el del código)
alter table public.portales add column if not exists tipo       text not null default 'fijo';
do $$ begin
    alter table public.portales add constraint portales_tipo_chk check (tipo in ('fijo', 'modulo', 'ascensos'));
exception when duplicate_object then null; end $$;

insert into public.portales (id, nombre, color, ruta, tipo, orden) values
    ('ascensosaza', 'Ascensos AZA', '#00E0C6', '/ascensos/', 'ascensos', 40),
    ('pruebas',     'Pruebas',      '#9BE15D', '/pruebas/',  'ascensos', 95)
on conflict (id) do update set tipo = excluded.tipo, ruta = excluded.ruta;

insert into public.roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios) values
    ('aza',     'Admin Ascensos AZA', '{ascensosaza}', false, false),
    ('pruebas', 'Pruebas',            '{pruebas}',     false, false)
on conflict (id) do nothing;

-- Usuario de pruebas (usuario: pruebas · clave: pruebas11). Cámbiala desde el panel si quieres.
do $$
begin
    if not exists (select 1 from public.usuarios_admin where lower(usuario) = 'pruebas') then
        insert into public.usuarios_admin (usuario, nombre, rol, activo, password)
        values ('pruebas', 'Pruebas', 'pruebas', true, extensions.crypt('pruebas11', extensions.gen_salt('bf')));
    else
        update public.usuarios_admin set rol = 'pruebas', activo = true where lower(usuario) = 'pruebas';
    end if;
end $$;
-- Ascensos AZA: crea su usuario desde el panel (coachniko → Usuarios y roles)
-- con el rol "Admin Ascensos AZA". Así la clave no queda escrita en el repositorio.


-- 2) ASCENSOS: jornadas (base aparte) y baneados -------------------------
--    1 fila por jornada; los equipos van compactos en jsonb:
--    equipos: [{n: nombre, t: tag, tc: tag cantidad, p: [top por sala], k: [kills por sala], pts, total, kills}]
create table if not exists public.asc_jornadas (
    id           bigint generated always as identity primary key,
    portal       text not null references public.portales(id) on delete cascade,
    categoria    text not null,              -- pumasgg, alca, cacm, leviatan, lyon, levxtatsu...
    titulo       text not null,
    fecha        timestamptz not null default now(),
    horario      text,
    moderador    text,
    salas        smallint not null default 0,
    modo         text not null default 'top',
    equipos      jsonb not null default '[]',
    clasificados jsonb not null default '[]',
    creado_por   text,
    creado       timestamptz not null default now()
);
create index if not exists asc_jornadas_portal_fecha on public.asc_jornadas (portal, fecha desc);

create table if not exists public.asc_baneados (
    id         bigint generated always as identity primary key,
    portal     text not null references public.portales(id) on delete cascade,
    equipo     text not null,
    tag        text,
    motivo     text,
    hasta      date,                         -- null = sin fecha de fin
    creado_por text,
    creado     timestamptz not null default now()
);
create unique index if not exists asc_baneados_equipo_key on public.asc_baneados (portal, lower(trim(equipo)));

alter table public.asc_jornadas enable row level security;
alter table public.asc_baneados enable row level security;
drop policy if exists "asc_jornadas lectura publica" on public.asc_jornadas;
create policy "asc_jornadas lectura publica" on public.asc_jornadas for select using (true);
drop policy if exists "asc_baneados lectura publica" on public.asc_baneados;
create policy "asc_baneados lectura publica" on public.asc_baneados for select using (true);


-- 3) INICIO: configuración y torneos aliados ------------------------------
create table if not exists public.sitio_config (
    clave           text primary key,
    valor           jsonb not null default '{}',
    actualizado     timestamptz not null default now(),
    actualizado_por text
);
insert into public.sitio_config (clave, valor) values ('torneos_aliados', '{"activo": false}')
on conflict (clave) do nothing;

create table if not exists public.torneos_aliados (
    id          bigint generated always as identity primary key,
    nombre      text not null,
    descripcion text,
    logo        text,
    link        text,
    fecha_texto text,                        -- ej. "Inscripciones hasta el 20 OCT"
    orden       smallint not null default 99,
    activo      boolean not null default true,
    creado      timestamptz not null default now()
);

alter table public.sitio_config    enable row level security;
alter table public.torneos_aliados enable row level security;
drop policy if exists "sitio_config lectura publica" on public.sitio_config;
create policy "sitio_config lectura publica" on public.sitio_config for select using (true);
drop policy if exists "torneos_aliados lectura publica" on public.torneos_aliados;
create policy "torneos_aliados lectura publica" on public.torneos_aliados for select using (true);


-- 4) SORTEOS POR PORTAL ----------------------------------------------------
create table if not exists public.sorteos (
    portal          text primary key references public.portales(id) on delete cascade,
    activo          boolean not null default false,
    titulo          text,
    prefijo         text not null default 'PUMAS',
    fecha_limite    timestamptz,
    mostrar_lista   boolean not null default true,
    ganador         jsonb,                   -- {equipo, codigo, fecha}
    actualizado     timestamptz not null default now(),
    actualizado_por text
);
create table if not exists public.sorteo_registros (
    id            bigint generated always as identity primary key,
    portal        text not null references public.portales(id) on delete cascade,
    equipo        text not null,
    representante text,
    instagram     text,
    contacto      text,                      -- dato personal: solo lo ven los admins del portal
    codigo        text not null unique,
    creado        timestamptz not null default now()
);
create unique index if not exists sorteo_registros_equipo_key on public.sorteo_registros (portal, lower(trim(equipo)));

alter table public.sorteos          enable row level security;
alter table public.sorteo_registros enable row level security;   -- sin políticas: privado
drop policy if exists "sorteos lectura publica" on public.sorteos;
create policy "sorteos lectura publica" on public.sorteos for select using (true);

-- Código del ticket según el portal
create or replace function public._prefijo_sorteo(p text)
returns text language sql immutable as $$
    select case p
        when 'principal'      then 'PUMAS'
        when 'entrenamientos' then 'PUMAS'
        when 'ascensosqfd'    then 'QFD'
        when 'ascensosaza'    then 'AZA'
        when 'pruebas'        then 'PRUEBA'
        else upper(left(regexp_replace(p, '[^a-z0-9]', '', 'g'), 8))
    end;
$$;

-- El sorteo viejo del inicio (sorteo_equipos / sorteo_config) pasa al portal principal
insert into public.sorteos (portal, activo, prefijo, titulo)
values ('principal', false, 'PUMAS', 'Sorteo Pumas Gaming')
on conflict (portal) do nothing;
do $$
begin
    if to_regclass('public.sorteo_equipos') is not null then
        execute $q$
            insert into public.sorteo_registros (portal, equipo, representante, instagram, contacto, codigo, creado)
            select 'principal', nombre_equipo, nombre_representante, ig_equipo, numero_contacto, codigo_serial,
                   coalesce(fecha_registro, now())
              from public.sorteo_equipos
             where coalesce(trim(nombre_equipo), '') <> '' and coalesce(trim(codigo_serial), '') <> ''
            on conflict do nothing
        $q$;
    end if;
    if to_regclass('public.sorteo_config') is not null then
        execute $q$
            update public.sorteos s
               set fecha_limite = c.fecha_limite
              from public.sorteo_config c
             where c.id = 1 and s.portal = 'principal' and s.fecha_limite is null
        $q$;
    end if;
exception when others then
    raise notice 'No se pudo copiar el sorteo viejo: %', sqlerrm;
end $$;


-- 5) FUNCIONES: ASCENSOS ---------------------------------------------------
create or replace function public.asc_guardar_jornada(p_token uuid, p_portal text, p_datos jsonb)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    v_titulo text := left(trim(coalesce(p_datos->>'titulo', '')), 120);
    v_fecha timestamptz := coalesce((p_datos->>'fecha')::timestamptz, now());
    nuevo bigint;
begin
    if not exists (select 1 from portales where id = p_portal and tipo = 'ascensos') then
        raise exception 'Este portal no guarda ascensos: %', p_portal;
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
    values (p_portal,
            left(coalesce(nullif(trim(p_datos->>'categoria'), ''), 'general'), 30),
            v_titulo, v_fecha,
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

create or replace function public.asc_borrar_jornada(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from asc_jornadas where id = p_id and portal = p_portal;
    if not found then raise exception 'Esa jornada no existe en este portal'; end if;
    return json_build_object('ok', true);
end $$;

create or replace function public.asc_baneado_guardar(
    p_token uuid, p_portal text, p_equipo text, p_tag text, p_motivo text, p_hasta date
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    v_eq text := left(trim(coalesce(p_equipo, '')), 60);
begin
    if v_eq = '' then raise exception 'Escribe el nombre del equipo'; end if;
    if (select count(*) from asc_baneados where portal = p_portal) >= 500 then
        raise exception 'La lista de baneados está llena (500)';
    end if;
    insert into asc_baneados (portal, equipo, tag, motivo, hasta, creado_por)
    values (p_portal, v_eq, left(nullif(trim(p_tag), ''), 20), left(nullif(trim(p_motivo), ''), 200), p_hasta, quien)
    on conflict (portal, lower(trim(equipo))) do update
       set tag = excluded.tag, motivo = excluded.motivo, hasta = excluded.hasta, creado_por = excluded.creado_por;
    return json_build_object('ok', true);
end $$;

create or replace function public.asc_baneado_borrar(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from asc_baneados where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;


-- 6) FUNCIONES: MÓDULOS (solo superadmin: rol con "gestionar") --------------
--    En la edición: null = no cambia · '' = lo borra (vuelve al del código)
create or replace function public.admin_modulo_guardar(
    p_token uuid, p_id text, p_crear boolean,
    p_nombre text, p_titulo text, p_subtitulo text,
    p_color text, p_color2 text, p_logo text, p_link text,
    p_latam boolean, p_activo boolean
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    yo  json := _exigir_permiso(p_token, 'gestionar');
    mid text := lower(trim(coalesce(p_id, '')));
    c   text;
begin
    foreach c in array array[p_color, p_color2] loop
        if nullif(trim(c), '') is not null and trim(c) !~ '^#[0-9a-fA-F]{6}$' then
            raise exception 'Color inválido: % (usa formato #RRGGBB)', c;
        end if;
    end loop;
    if nullif(trim(p_logo), '') is not null and trim(p_logo) !~ '^(/|https://)' then
        raise exception 'El logo debe ser una ruta del sitio (/imagenes/...) o un link https://';
    end if;
    if nullif(trim(p_link), '') is not null and trim(p_link) !~ '^https://' then
        raise exception 'El link del grupo debe empezar con https://';
    end if;

    if coalesce(p_crear, false) then
        if mid !~ '^[a-z0-9_]{2,30}$' then
            raise exception 'Código inválido: 2 a 30 letras minúsculas, números o guion bajo';
        end if;
        if exists (select 1 from portales where id = mid) then
            raise exception 'Ya existe un portal con el código %', mid;
        end if;
        if coalesce(trim(p_nombre), '') = '' then
            raise exception 'El módulo necesita un nombre';
        end if;
        insert into portales (id, nombre, color, color_tema, color2, logo, titulo, subtitulo, ruta, tipo, latam, link, orden, activo)
        values (mid, left(trim(p_nombre), 60),
                coalesce(nullif(trim(p_color), ''), '#D8C395'), coalesce(nullif(trim(p_color), ''), '#D8C395'),
                nullif(trim(p_color2), ''), left(nullif(trim(p_logo), ''), 300),
                left(nullif(trim(p_titulo), ''), 60), left(nullif(trim(p_subtitulo), ''), 120),
                '/modulo/?p=' || mid, 'modulo', coalesce(p_latam, true), left(nullif(trim(p_link), ''), 300),
                coalesce((select max(orden) from portales where orden < 90), 0) + 1, coalesce(p_activo, true));
        return json_build_object('ok', true, 'id', mid, 'creado', true);
    end if;

    if not exists (select 1 from portales where id = mid) then
        raise exception 'El portal % no existe', mid;
    end if;
    update portales set
        nombre     = coalesce(left(nullif(trim(p_nombre), ''), 60), nombre),
        titulo     = case when p_titulo    is null then titulo    else left(nullif(trim(p_titulo), ''), 60) end,
        subtitulo  = case when p_subtitulo is null then subtitulo else left(nullif(trim(p_subtitulo), ''), 120) end,
        color      = case when nullif(trim(p_color), '') is null then color else trim(p_color) end,
        color_tema = case when p_color is null then color_tema else nullif(trim(p_color), '') end,
        color2     = case when p_color2 is null then color2 else nullif(trim(p_color2), '') end,
        logo       = case when p_logo   is null then logo   else left(nullif(trim(p_logo), ''), 300) end,
        link       = case when p_link   is null then link   else left(nullif(trim(p_link), ''), 300) end,
        latam      = case when tipo = 'modulo' then coalesce(p_latam, latam) else latam end,
        activo     = case when tipo = 'modulo' or id not in ('principal') then coalesce(p_activo, activo) else activo end
     where id = mid;
    return json_build_object('ok', true, 'id', mid);
end $$;

-- Borra un módulo creado desde el panel y TODO lo suyo (entrenos, cupos, sorteo).
-- Los portales del código (ROW, Rusheo...) no se borran: se editan.
create or replace function public.admin_modulo_borrar(p_token uuid, p_id text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    n int;
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if not exists (select 1 from portales where id = p_id and tipo = 'modulo') then
        raise exception 'Solo se pueden borrar módulos creados desde el panel';
    end if;
    select count(*) into n from portal_sesiones where portal = p_id;
    delete from portal_sesiones    where portal = p_id;   -- salas y killers se van en cascada
    delete from portal_programados where portal = p_id;   -- cupos en cascada
    delete from portal_equipos     where portal = p_id;
    update roles set portales = array_remove(portales, p_id) where p_id = any(portales);
    delete from portales where id = p_id;                 -- sorteos, baneados y jornadas en cascada
    return json_build_object('ok', true, 'entrenos_borrados', n);
end $$;

-- Los módulos guardan entrenos aunque no estén en LATAM
create or replace function public.guardar_entreno(
    p_token uuid, p_portal text, p_titulo text, p_jornada text,
    p_fecha timestamptz, p_moderador text, p_salas jsonb, p_killers jsonb
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    nuevo bigint;
begin
    if not exists (select 1 from portales where id = p_portal and (latam or tipo = 'modulo')) or p_portal = 'entrenamientos' then
        raise exception 'Portal no válido para guardar: %', p_portal;
    end if;
    if jsonb_typeof(p_salas) <> 'array' or jsonb_array_length(p_salas) = 0 then
        raise exception 'No hay resultados para guardar';
    end if;
    if jsonb_array_length(p_salas) > 3000 or jsonb_array_length(coalesce(p_killers, '[]')) > 3000 then
        raise exception 'Demasiados datos en un solo entreno';
    end if;
    if exists (select 1 from portal_sesiones
                where portal = p_portal and titulo = trim(p_titulo) and fecha = p_fecha) then
        raise exception 'Este entreno ya está guardado (mismo título y fecha)';
    end if;

    insert into portal_sesiones (portal, titulo, jornada, fecha, moderador, creado_por)
    values (p_portal, left(trim(p_titulo), 120), left(nullif(trim(p_jornada), ''), 60),
            coalesce(p_fecha, now()), left(nullif(trim(p_moderador), ''), 60), quien)
    returning id into nuevo;

    insert into portal_salas (sesion_id, numero_sala, equipo_nombre, rank, kill_score, rank_score, total_score, es_booyah)
    select nuevo,
           (x->>'numero_sala')::smallint,
           left(trim(x->>'equipo_nombre'), 60),
           nullif(x->>'rank', '')::smallint,
           coalesce((x->>'kill_score')::smallint, 0),
           coalesce((x->>'rank_score')::smallint, 0),
           coalesce((x->>'total_score')::smallint, 0),
           coalesce((x->>'es_booyah')::boolean, false)
      from jsonb_array_elements(p_salas) x
     where coalesce(trim(x->>'equipo_nombre'), '') <> '';

    insert into portal_killers (sesion_id, jugador_nombre, equipo_nombre, kills, salas)
    select nuevo,
           left(trim(x->>'jugador_nombre'), 60),
           left(trim(x->>'equipo_nombre'), 60),
           coalesce((x->>'kills')::smallint, 0),
           greatest(coalesce((x->>'salas')::smallint, 1), 1)
      from jsonb_array_elements(coalesce(p_killers, '[]')) x
     where coalesce(trim(x->>'jugador_nombre'), '') <> '';

    return json_build_object('ok', true, 'id', nuevo);
end $$;


-- 7) FUNCIONES: INICIO (rol con "personalizar") -------------------------------
create or replace function public.admin_sitio_guardar(p_token uuid, p_clave text, p_valor jsonb)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'personalizar')->>'usuario';
begin
    if p_clave not in ('torneos_aliados') then
        raise exception 'Configuración desconocida: %', p_clave;
    end if;
    insert into sitio_config (clave, valor, actualizado, actualizado_por)
    values (p_clave, coalesce(p_valor, '{}'), now(), quien)
    on conflict (clave) do update set valor = excluded.valor, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_aliado_guardar(
    p_token uuid, p_id bigint, p_nombre text, p_descripcion text, p_logo text,
    p_link text, p_fecha_texto text, p_orden int, p_activo boolean
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    nuevo bigint;
begin
    perform _exigir_permiso(p_token, 'personalizar');
    if coalesce(trim(p_nombre), '') = '' then raise exception 'El torneo necesita un nombre'; end if;
    if nullif(trim(p_logo), '') is not null and trim(p_logo) !~ '^(/|https://)' then
        raise exception 'El logo debe ser una ruta del sitio (/imagenes/...) o un link https://';
    end if;
    if nullif(trim(p_link), '') is not null and trim(p_link) !~ '^https://' then
        raise exception 'El link debe empezar con https://';
    end if;
    if p_id is null then
        if (select count(*) from torneos_aliados) >= 60 then raise exception 'Máximo 60 torneos aliados'; end if;
        insert into torneos_aliados (nombre, descripcion, logo, link, fecha_texto, orden, activo)
        values (left(trim(p_nombre), 80), left(nullif(trim(p_descripcion), ''), 300), left(nullif(trim(p_logo), ''), 300),
                left(nullif(trim(p_link), ''), 300), left(nullif(trim(p_fecha_texto), ''), 80),
                coalesce(p_orden, 99), coalesce(p_activo, true))
        returning id into nuevo;
        return json_build_object('ok', true, 'id', nuevo);
    end if;
    update torneos_aliados set
        nombre = left(trim(p_nombre), 80), descripcion = left(nullif(trim(p_descripcion), ''), 300),
        logo = left(nullif(trim(p_logo), ''), 300), link = left(nullif(trim(p_link), ''), 300),
        fecha_texto = left(nullif(trim(p_fecha_texto), ''), 80), orden = coalesce(p_orden, orden),
        activo = coalesce(p_activo, activo)
     where id = p_id;
    return json_build_object('ok', true, 'id', p_id);
end $$;

create or replace function public.admin_aliado_borrar(p_token uuid, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'personalizar');
    delete from torneos_aliados where id = p_id;
    return json_build_object('ok', true);
end $$;


-- 8) FUNCIONES: SORTEOS ------------------------------------------------------
-- Público: estado del sorteo de un portal (sin datos personales)
create or replace function public.sorteo_publico(p_portal text)
returns json
language sql security definer stable
set search_path = public
as $$
    select json_build_object(
        'portal', p.id, 'nombre', p.nombre,
        'activo', coalesce(s.activo, false),
        'titulo', coalesce(s.titulo, 'Sorteo ' || p.nombre),
        'prefijo', coalesce(s.prefijo, _prefijo_sorteo(p.id)),
        'fecha_limite', s.fecha_limite,
        'mostrar_lista', coalesce(s.mostrar_lista, true),
        'ganador', s.ganador,
        'total', (select count(*) from sorteo_registros r where r.portal = p.id),
        'equipos', case when coalesce(s.activo, false) and coalesce(s.mostrar_lista, true) then
            (select coalesce(json_agg(json_build_object('equipo', r.equipo, 'codigo', r.codigo) order by r.creado), '[]'::json)
               from sorteo_registros r where r.portal = p.id)
            else '[]'::json end)
      from portales p
      left join sorteos s on s.portal = p.id
     where p.id = p_portal;
$$;

-- Público: inscribirse (valida que esté activo, la fecha límite y que el equipo no se repita)
create or replace function public.sorteo_inscribir(
    p_portal text, p_equipo text, p_representante text, p_instagram text, p_contacto text
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    s sorteos;
    v_eq text := left(trim(coalesce(p_equipo, '')), 60);
    cod text;
    i int := 0;
begin
    select * into s from sorteos where portal = p_portal;
    if not found or not s.activo then raise exception 'Este sorteo no está activo'; end if;
    if s.fecha_limite is not null and now() > s.fecha_limite then raise exception 'Las inscripciones ya cerraron'; end if;
    if v_eq = '' or coalesce(trim(p_representante), '') = '' or coalesce(trim(p_contacto), '') = '' then
        raise exception 'Completa equipo, representante y contacto';
    end if;
    if (select count(*) from sorteo_registros where portal = p_portal) >= 3000 then
        raise exception 'El sorteo llegó al máximo de inscritos';
    end if;
    if exists (select 1 from sorteo_registros
                where portal = p_portal
                  and regexp_replace(lower(equipo), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v_eq), '[^a-z0-9]', '', 'g')) then
        raise exception 'Ese equipo ya está inscrito en el sorteo';
    end if;
    loop
        cod := coalesce(nullif(s.prefijo, ''), _prefijo_sorteo(p_portal)) || '-' ||
               upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
        exit when not exists (select 1 from sorteo_registros where codigo = cod);
        i := i + 1;
        if i > 20 then raise exception 'No se pudo generar el código, intenta de nuevo'; end if;
    end loop;
    insert into sorteo_registros (portal, equipo, representante, instagram, contacto, codigo)
    values (p_portal, v_eq, left(trim(p_representante), 60), left(nullif(trim(p_instagram), ''), 60),
            left(trim(p_contacto), 30), cod);
    return json_build_object('ok', true, 'codigo', cod, 'equipo', v_eq);
end $$;

-- Admin del portal: inscritos con contacto y configuración
create or replace function public.sorteo_admin_listar(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return json_build_object(
        'config', sorteo_publico(p_portal),
        'registros', (select coalesce(json_agg(json_build_object(
                'id', r.id, 'equipo', r.equipo, 'representante', r.representante, 'instagram', r.instagram,
                'contacto', r.contacto, 'codigo', r.codigo, 'creado', r.creado) order by r.creado desc), '[]'::json)
              from sorteo_registros r where r.portal = p_portal));
end $$;

-- Admin del portal: estado de los sorteos de todos sus portales
create or replace function public.sorteo_admin_estado(p_token uuid)
returns json
language plpgsql security definer stable
set search_path = public
as $$
declare
    ses json := validar_sesion(p_token);
begin
    if ses is null then raise exception 'Sesión inválida o expirada'; end if;
    return (select coalesce(json_agg(json_build_object(
                'portal', p.id, 'nombre', p.nombre, 'color', coalesce(p.color_tema, p.color),
                'activo', coalesce(s.activo, false), 'prefijo', coalesce(s.prefijo, _prefijo_sorteo(p.id)),
                'fecha_limite', s.fecha_limite,
                'total', (select count(*) from sorteo_registros r where r.portal = p.id)) order by p.orden, p.id), '[]'::json)
              from portales p
              left join sorteos s on s.portal = p.id
             where p.activo and p.id <> 'entrenoslatam'
               and exists (select 1 from json_array_elements_text(ses->'portales') x where x in ('*', p.id)));
end $$;

-- Configurar: activar/desactivar y cambiar el código SOLO superadmin
-- (o el rol de Pumas para el sorteo del inicio). Fecha límite, título y lista: usuarios del portal.
create or replace function public.sorteo_admin_config(
    p_token uuid, p_portal text, p_activo boolean, p_titulo text, p_prefijo text,
    p_fecha_limite timestamptz, p_quitar_fecha boolean, p_mostrar_lista boolean
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
    jefe boolean := coalesce((ses->>'gestionar')::boolean, false)
                 or (p_portal = 'principal' and coalesce((ses->>'personalizar')::boolean, false));
    actual sorteos;
begin
    if not exists (select 1 from portales where id = p_portal) then raise exception 'Portal desconocido'; end if;
    insert into sorteos (portal, prefijo, titulo) values (p_portal, _prefijo_sorteo(p_portal), null)
    on conflict (portal) do nothing;
    select * into actual from sorteos where portal = p_portal;

    if p_activo is not null and p_activo is distinct from actual.activo and not jefe then
        raise exception 'Solo el superadmin puede activar o desactivar sorteos';
    end if;
    if nullif(trim(p_prefijo), '') is not null and upper(trim(p_prefijo)) <> actual.prefijo then
        if not jefe then raise exception 'Solo el superadmin cambia el código del ticket'; end if;
        if upper(trim(p_prefijo)) !~ '^[A-Z0-9]{2,10}$' then raise exception 'Código: 2 a 10 letras o números'; end if;
    end if;

    update sorteos set
        activo        = coalesce(p_activo, activo),
        titulo        = case when p_titulo is null then titulo else left(nullif(trim(p_titulo), ''), 80) end,
        prefijo       = coalesce(upper(nullif(trim(p_prefijo), '')), prefijo),
        fecha_limite  = case when coalesce(p_quitar_fecha, false) then null else coalesce(p_fecha_limite, fecha_limite) end,
        mostrar_lista = coalesce(p_mostrar_lista, mostrar_lista),
        actualizado   = now(),
        actualizado_por = ses->>'usuario'
     where portal = p_portal;
    return json_build_object('ok', true);
end $$;

create or replace function public.sorteo_admin_borrar(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from sorteo_registros where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Vacía la lista (para empezar un sorteo nuevo) y borra el ganador
create or replace function public.sorteo_admin_vaciar(p_token uuid, p_portal text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare n int;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from sorteo_registros where portal = p_portal;
    get diagnostics n = row_count;
    update sorteos set ganador = null where portal = p_portal;
    return json_build_object('ok', true, 'borrados', n);
end $$;

-- Guarda el ganador (se muestra en la página pública)
create or replace function public.sorteo_admin_ganador(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
declare r sorteo_registros;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    select * into r from sorteo_registros where id = p_id and portal = p_portal;
    if not found then raise exception 'Ese registro no existe'; end if;
    update sorteos set ganador = json_build_object('equipo', r.equipo, 'codigo', r.codigo, 'fecha', now())::jsonb
     where portal = p_portal;
    return json_build_object('ok', true);
end $$;


-- 9) FUNCIONES: CUPOS (como los de Pumas, para cualquier portal) ------------
--    El teléfono nunca sale en lo público; el link del grupo solo se entrega al inscribirse.
create or replace function public.cupos_publicos(p_portal text)
returns json
language sql security definer stable
set search_path = public
as $$
    select coalesce(json_agg(json_build_object(
               'id', g.id, 'titulo', g.titulo, 'fecha', g.fecha, 'cupos', g.cupos_totales,
               'inscritos', (select coalesce(json_agg(json_build_object('equipo', c.nombre_equipo, 'staff', c.telefono = 'REGISTRO STAFF') order by c.creado), '[]'::json)
                               from portal_cupos c where c.programado_id = g.id)) order by g.fecha), '[]'::json)
      from portal_programados g
     where g.portal = p_portal and g.estado = 'ABIERTO'
       and (g.publicar_en is null or g.publicar_en <= now())
       and g.fecha > now() - interval '6 hours';
$$;

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

create or replace function public.admin_cupos_listar(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return (select coalesce(json_agg(json_build_object(
               'id', g.id, 'titulo', g.titulo, 'fecha', g.fecha, 'cupos', g.cupos_totales, 'estado', g.estado,
               'publicar_en', g.publicar_en, 'link', g.link_grupo,
               'inscritos', (select coalesce(json_agg(json_build_object('id', c.id, 'equipo', c.nombre_equipo, 'telefono', c.telefono,
                                    'staff', c.telefono = 'REGISTRO STAFF') order by c.creado), '[]'::json)
                               from portal_cupos c where c.programado_id = g.id)) order by g.fecha desc), '[]'::json)
              from portal_programados g
             where g.portal = p_portal and g.fecha > now() - interval '60 days');
end $$;

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
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if coalesce(trim(p_titulo), '') = '' or p_fecha is null then raise exception 'Completa título y fecha'; end if;
    if coalesce(p_cupos, 0) < 1 or p_cupos > 100 then raise exception 'Cupos: de 1 a 100'; end if;
    if nullif(trim(p_link), '') is not null and trim(p_link) !~ '^https://' then
        raise exception 'El link del grupo debe empezar con https://';
    end if;
    insert into portal_programados (portal, titulo, fecha, hay_staff, cupos_totales, link_grupo, estado, publicar_en)
    values (p_portal, left(trim(p_titulo), 120), p_fecha, coalesce(array_length(p_staff, 1), 0) > 0, p_cupos,
            left(nullif(trim(p_link), ''), 300), 'ABIERTO', p_publicar_en)
    returning id into nuevo;
    insert into portal_cupos (programado_id, nombre_equipo, telefono)
    select distinct on (lower(trim(x))) nuevo, left(trim(x), 60), 'REGISTRO STAFF'
      from unnest(coalesce(p_staff, '{}')) x where trim(x) <> '';
    return json_build_object('ok', true, 'id', nuevo);
end $$;

create or replace function public.admin_cupo_estado(p_token uuid, p_portal text, p_id bigint, p_estado text)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if p_estado = 'PUBLICAR' then
        update portal_programados set publicar_en = null, estado = 'ABIERTO' where id = p_id and portal = p_portal;
    elsif p_estado in ('ABIERTO', 'CERRADO', 'FINALIZADO') then
        update portal_programados set estado = p_estado where id = p_id and portal = p_portal;
    else
        raise exception 'Estado inválido';
    end if;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_cupo_borrar(p_token uuid, p_portal text, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from portal_programados where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_cupo_quitar(p_token uuid, p_portal text, p_cupo bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from portal_cupos c using portal_programados g
     where c.id = p_cupo and g.id = c.programado_id and g.portal = p_portal;
    update portal_programados g set estado = 'ABIERTO'
     where g.portal = p_portal and g.estado = 'CERRADO'
       and (select count(*) from portal_cupos c where c.programado_id = g.id) < g.cupos_totales
       and g.fecha > now();
    return json_build_object('ok', true);
end $$;


-- 10) RESPALDO: suma las tablas nuevas --------------------------------------
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
        'asc_jornadas', 'asc_baneados', 'sorteos', 'sorteo_registros',
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
    return jsonb_build_object(
        'respaldo', 'pumasgaming',
        'version', 2,
        'creado', now(),
        'creado_por', quien,
        'filas_por_tabla', conteo,
        'tablas', datos);
end $$;


-- 11) PERMISOS DE EJECUCIÓN ---------------------------------------------------
revoke execute on function public._prefijo_sorteo(text) from public, anon, authenticated;
grant execute on function public.asc_guardar_jornada(uuid, text, jsonb)                          to anon, authenticated;
grant execute on function public.asc_borrar_jornada(uuid, text, bigint)                          to anon, authenticated;
grant execute on function public.asc_baneado_guardar(uuid, text, text, text, text, date)         to anon, authenticated;
grant execute on function public.asc_baneado_borrar(uuid, text, bigint)                          to anon, authenticated;
grant execute on function public.admin_modulo_guardar(uuid, text, boolean, text, text, text, text, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.admin_modulo_borrar(uuid, text)                                 to anon, authenticated;
grant execute on function public.guardar_entreno(uuid, text, text, text, timestamptz, text, jsonb, jsonb) to anon, authenticated;
grant execute on function public.admin_sitio_guardar(uuid, text, jsonb)                          to anon, authenticated;
grant execute on function public.admin_aliado_guardar(uuid, bigint, text, text, text, text, text, int, boolean) to anon, authenticated;
grant execute on function public.admin_aliado_borrar(uuid, bigint)                               to anon, authenticated;
grant execute on function public.sorteo_publico(text)                                            to anon, authenticated;
grant execute on function public.sorteo_inscribir(text, text, text, text, text)                  to anon, authenticated;
grant execute on function public.sorteo_admin_listar(uuid, text)                                 to anon, authenticated;
grant execute on function public.sorteo_admin_estado(uuid)                                       to anon, authenticated;
grant execute on function public.sorteo_admin_config(uuid, text, boolean, text, text, timestamptz, boolean, boolean) to anon, authenticated;
grant execute on function public.sorteo_admin_borrar(uuid, text, bigint)                         to anon, authenticated;
grant execute on function public.sorteo_admin_vaciar(uuid, text)                                 to anon, authenticated;
grant execute on function public.sorteo_admin_ganador(uuid, text, bigint)                        to anon, authenticated;
grant execute on function public.cupos_publicos(text)                                            to anon, authenticated;
grant execute on function public.cupo_inscribir(bigint, text, text)                              to anon, authenticated;
grant execute on function public.admin_cupos_listar(uuid, text)                                  to anon, authenticated;
grant execute on function public.admin_cupo_guardar(uuid, text, text, timestamptz, int, text, timestamptz, text[]) to anon, authenticated;
grant execute on function public.admin_cupo_estado(uuid, text, bigint, text)                     to anon, authenticated;
grant execute on function public.admin_cupo_borrar(uuid, text, bigint)                           to anon, authenticated;
grant execute on function public.admin_cupo_quitar(uuid, text, bigint)                           to anon, authenticated;
grant execute on function public.admin_respaldo(uuid)                                            to anon, authenticated;

-- Revisión
select id, nombre, tipo, ruta from public.portales order by orden, id;
select portal, activo, prefijo, (select count(*) from public.sorteo_registros r where r.portal = s.portal) as inscritos
  from public.sorteos s;
