-- =====================================================================
--  PUMAS GAMING · 07 · Entrenos LATAM (Rusheo, ROW, QFD, Dragon Fest, ZMF)
--  Requiere 02, 03 y 06. Se puede correr las veces que quieras.
--
--  CÓMO LLEGAN LOS DATOS A LATAM (sin gastar espacio):
--    Cada entreno guarda en SUS tablas (portal_sesiones / portal_salas /
--    portal_killers con su columna `portal`). LATAM NO copia nada: son
--    VISTAS que leen esas tablas en el momento → 0 bytes extra y siempre
--    al día. Cuando ROW guarde un entreno, aparece solo en LATAM.
--    Los entrenos de Pumas (entrenamientos_*) NO entran en LATAM.
--
--  AHORRO DE ESPACIO (las tablas aún están vacías, así que es gratis):
--    · números en smallint (2 bytes) en vez de int (4 bytes)
--    · killers: 1 fila por jugador POR ENTRENO (kills sumadas + salas
--      jugadas) en vez de 1 por sala → ~6 veces menos filas
--    · se quita un índice que no se usaba
--    · logs en storage: se subirán comprimidos (gzip, ~85% menos) cuando
--      armemos el guardado (04_... de cada portal)
-- =====================================================================

-- 1) PORTALES LATAM: orden, link del grupo y bandera -------------------
alter table public.portales add column if not exists latam boolean  not null default false;
alter table public.portales add column if not exists orden smallint not null default 99;
alter table public.portales add column if not exists link  text;   -- link del grupo (WhatsApp/Discord)

update public.portales set latam = true, orden = 1 where id = 'rusheo';
update public.portales set latam = true, orden = 2 where id = 'row';
update public.portales set latam = true, orden = 3 where id = 'ascensosqfd';
update public.portales set latam = true, orden = 4 where id = 'dragonfest';
update public.portales set latam = true, orden = 5 where id = 'dragonfestfem';
update public.portales set latam = true, orden = 6 where id = 'zmf';
update public.portales set ruta = '/dragonfest/femenino.html' where id = 'dragonfestfem';
update public.portales set color = '#4FC3F7' where id = 'ascensosqfd';

insert into public.portales (id, nombre, color, ruta) values ('entrenoslatam', 'Entrenos LATAM', '#D8C395', '/entrenoslatam/')
on conflict (id) do nothing;

-- PEGA AQUÍ LOS LINKS DE CADA GRUPO (o edítalos en Table Editor → portales → link)
-- update public.portales set link = 'https://chat.whatsapp.com/...' where id = 'rusheo';
-- update public.portales set link = 'https://chat.whatsapp.com/...' where id = 'row';
-- update public.portales set link = 'https://chat.whatsapp.com/...' where id = 'ascensosqfd';
-- update public.portales set link = 'https://chat.whatsapp.com/...' where id = 'dragonfest';
-- update public.portales set link = 'https://chat.whatsapp.com/...' where id = 'zmf';


-- 2) TABLAS MÁS LIVIANAS -------------------------------------------------
--    Las vistas del 03 dependen de estas columnas: se quitan, se ajustan
--    las columnas y se vuelven a crear abajo (mismo contenido).
drop view if exists public.v_tabla_general_todos;
drop view if exists public.v_tabla_general;

alter table public.portal_salas
    alter column numero_sala type smallint,
    alter column rank        type smallint,
    alter column kill_score  type smallint,
    alter column rank_score  type smallint,
    alter column total_score type smallint;

alter table public.portal_killers alter column kills type smallint;
alter table public.portal_killers add column if not exists salas smallint not null default 1;  -- salas jugadas en ese entreno
comment on table public.portal_killers is '1 fila por jugador por entreno: kills sumadas y salas jugadas (KDA = kills / salas)';

drop index if exists public.portal_salas_equipo;   -- no se usaba: ahorra espacio


-- 3) VISTAS DEL 03 (de nuevo, iguales) -----------------------------------
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


-- 4) VISTAS LATAM (lo que lee /entrenoslatam/ y el index) -----------------
--    Compactas: 1 fila por equipo por entreno y 1 por jugador por entreno.
--    La página suma todo con la misma fórmula de Pumas:
--      PG = puntos totales · PR = PG ÷ sesiones · KDA = kills ÷ salas.

-- Entrenos LATAM (para el calendario y el conteo)
create or replace view public.v_latam_sesiones
with (security_invoker = true) as
select s.id, s.portal, s.titulo, s.jornada, s.fecha, s.moderador
  from public.portal_sesiones s
  join public.portales p on p.id = s.portal and p.latam;

-- Equipo por entreno: puntos, kills, booyahs y salas de ese entreno
create or replace view public.v_latam_equipos
with (security_invoker = true) as
select s.id                                   as sesion_id,
       s.portal,
       s.fecha,
       min(sa.equipo_nombre)                  as equipo,
       count(*)::smallint                     as salas,
       sum(sa.total_score)::int               as pts,
       sum(sa.kill_score)::int                as kills,
       (count(*) filter (where sa.es_booyah))::smallint as booyahs
  from public.portal_sesiones s
  join public.portales p on p.id = s.portal and p.latam
  join public.portal_salas sa on sa.sesion_id = s.id
 group by s.id, s.portal, s.fecha, lower(trim(sa.equipo_nombre));

-- Jugador por entreno
create or replace view public.v_latam_killers
with (security_invoker = true) as
select s.id as sesion_id, s.portal, s.fecha,
       k.jugador_nombre as jugador, k.equipo_nombre as equipo,
       k.kills, k.salas
  from public.portal_sesiones s
  join public.portales p on p.id = s.portal and p.latam
  join public.portal_killers k on k.sesion_id = s.id;

grant select on public.v_tabla_general, public.v_tabla_general_todos,
                public.v_latam_sesiones, public.v_latam_equipos, public.v_latam_killers
    to anon, authenticated;


-- Revisión
select id, nombre, latam, orden, color, ruta, link from public.portales order by latam desc, orden;
