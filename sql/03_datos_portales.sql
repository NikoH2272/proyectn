-- =====================================================================
--  PUMAS GAMING · 03 · Bases de datos de los portales (solo estructura)
--  Requiere 01 y 02. Idempotente.
--
--  Misma forma que el portal de Pumas (entrenamientos), pero COMPARTIDA:
--  cada fila lleva la columna `portal`, así:
--    - cada portal ve solo lo suyo (where portal = 'row')
--    - y se pueden cruzar todos (tabla general de todos los portales)
--
--    Pumas hoy                    →  Portales (nuevo)
--    equipos_registrados          →  portal_equipos
--    entrenamientos_sesiones      →  portal_sesiones
--    salas_resultados             →  portal_salas
--    top_killers                  →  portal_killers
--    entrenamientos_programados   →  portal_programados
--    registro_cupos               →  portal_cupos
--    storage entrenamientos_logs  →  storage portales-logs   (carpeta por portal)
--    storage logos_equipos        →  storage portales-logos  (carpeta por portal)
--
--  ⚠ Todavía NO hay permisos de escritura: las páginas aún no guardan
--    nada aquí. Cuando definamos cómo se guarda, agregamos las funciones
--    de guardado (04_...). Por ahora solo lectura pública de resultados.
-- =====================================================================

-- 1) EQUIPOS -----------------------------------------------------------
create table if not exists public.portal_equipos (
    id        bigint generated always as identity primary key,
    portal    text not null references public.portales(id),
    nombre    text not null,
    tag       text,
    logo_url  text,             -- archivo en storage portales-logos/<portal>/...
    creado    timestamptz not null default now()
);
create unique index if not exists portal_equipos_nombre_key
    on public.portal_equipos (portal, lower(trim(nombre)));


-- 2) SESIONES (un entreno / una jornada) --------------------------------
create table if not exists public.portal_sesiones (
    id          bigint generated always as identity primary key,
    portal      text not null references public.portales(id),
    titulo      text not null,
    jornada     text,
    fecha       timestamptz not null default now(),
    moderador   text,
    archivo_url text,           -- carpeta en storage portales-logs/<portal>/<carpeta>
    creado_por  text,           -- usuario admin que la guardó
    creado      timestamptz not null default now()
);
create index if not exists portal_sesiones_portal_fecha on public.portal_sesiones (portal, fecha desc);


-- 3) RESULTADOS POR SALA -----------------------------------------------
create table if not exists public.portal_salas (
    id            bigint generated always as identity primary key,
    sesion_id     bigint not null references public.portal_sesiones(id) on delete cascade,
    numero_sala   int not null,
    equipo_nombre text not null,
    rank          int,
    kill_score    int not null default 0,
    rank_score    int not null default 0,
    total_score   int not null default 0,
    es_booyah     boolean not null default false
);
create index if not exists portal_salas_sesion on public.portal_salas (sesion_id);
create index if not exists portal_salas_equipo on public.portal_salas (lower(trim(equipo_nombre)));


-- 4) KILLERS -----------------------------------------------------------
create table if not exists public.portal_killers (
    id             bigint generated always as identity primary key,
    sesion_id      bigint not null references public.portal_sesiones(id) on delete cascade,
    jugador_nombre text not null,
    equipo_nombre  text,
    kills          int not null default 0
);
create index if not exists portal_killers_sesion on public.portal_killers (sesion_id);


-- 5) ENTRENOS PROGRAMADOS Y CUPOS --------------------------------------
create table if not exists public.portal_programados (
    id            bigint generated always as identity primary key,
    portal        text not null references public.portales(id),
    titulo        text not null,
    fecha         timestamptz not null,
    hay_staff     boolean not null default false,
    cupos_totales int not null default 12 check (cupos_totales > 0),
    link_grupo    text,
    estado        text not null default 'ABIERTO' check (estado in ('ABIERTO','CERRADO','EN_CURSO','FINALIZADO')),
    publicar_en   timestamptz,
    creado        timestamptz not null default now()
);
create index if not exists portal_programados_portal_fecha on public.portal_programados (portal, fecha desc);

create table if not exists public.portal_cupos (
    id             bigint generated always as identity primary key,
    programado_id  bigint not null references public.portal_programados(id) on delete cascade,
    nombre_equipo  text not null,
    telefono       text,          -- dato personal: NO es de lectura pública
    creado         timestamptz not null default now()
);
create unique index if not exists portal_cupos_equipo_key
    on public.portal_cupos (programado_id, lower(trim(nombre_equipo)));


-- 6) SEGURIDAD: lectura pública de resultados, nada de escritura aún ----
alter table public.portal_equipos     enable row level security;
alter table public.portal_sesiones    enable row level security;
alter table public.portal_salas       enable row level security;
alter table public.portal_killers     enable row level security;
alter table public.portal_programados enable row level security;
alter table public.portal_cupos       enable row level security;  -- sin políticas: privado

do $$
declare t text;
begin
    foreach t in array array['portal_equipos','portal_sesiones','portal_salas','portal_killers','portal_programados'] loop
        execute format('drop policy if exists "%1$s lectura publica" on public.%1$I', t);
        execute format('create policy "%1$s lectura publica" on public.%1$I for select using (true)', t);
    end loop;
end $$;


-- 7) VISTAS QUE CONECTAN LOS PORTALES ----------------------------------

-- Tabla general por portal y equipo (incluye Pumas/entrenamientos)
create or replace view public.v_tabla_general
with (security_invoker = true) as
select s.portal,
       min(sa.equipo_nombre)                       as equipo,
       count(distinct s.id)                        as entrenos,
       count(*)                                    as salas,
       count(*) filter (where sa.es_booyah)        as booyahs,
       sum(sa.kill_score)                          as kills,
       sum(sa.total_score)                         as puntos
  from public.portal_sesiones s
  join public.portal_salas sa on sa.sesion_id = s.id
 group by s.portal, lower(trim(sa.equipo_nombre))
union all
select 'entrenamientos',
       min(sr.equipo_nombre),
       count(distinct es.id),
       count(*),
       count(*) filter (where sr.es_booyah),
       sum(sr.kill_score),
       sum(sr.total_score)
  from public.entrenamientos_sesiones es
  join public.salas_resultados sr on sr.sesion_id = es.id
 group by lower(trim(sr.equipo_nombre));

-- Un equipo sumado en TODOS los portales donde ha jugado
create or replace view public.v_tabla_general_todos
with (security_invoker = true) as
select min(equipo)                     as equipo,
       array_agg(distinct portal)      as portales,
       sum(entrenos)                   as entrenos,
       sum(salas)                      as salas,
       sum(booyahs)                    as booyahs,
       sum(kills)                      as kills,
       sum(puntos)                     as puntos
  from public.v_tabla_general
 group by lower(trim(equipo));

grant select on public.v_tabla_general, public.v_tabla_general_todos to anon, authenticated;


-- 8) STORAGE -----------------------------------------------------------
--    Si prefieres crearlos desde el panel (Storage → New bucket), usa
--    EXACTAMENTE estos nombres y opciones y omite este bloque.
--    Estructura de carpetas:
--      portales-logs/<portal>/<aaaa-mm-dd>_<sesion>/sala1.log
--      portales-logos/<portal>/<equipo>.png
insert into storage.buckets (id, name, public, file_size_limit)
values ('portales-logs', 'portales-logs', false, 5242880)          -- privado, 5 MB por archivo
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portales-logos', 'portales-logos', true, 2097152,          -- público, 2 MB por imagen
        array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
--    Las políticas de subida se agregan en el paso de guardado (04_...).


-- Revisión
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like 'portal%' order by 1;
