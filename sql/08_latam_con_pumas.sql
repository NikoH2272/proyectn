-- =====================================================================
--  PUMAS GAMING · 08 · Entrenos LATAM incluye a Pumas
--  Requiere 07. Se puede correr las veces que quieras.
--
--  Pumas guarda en sus tablas de siempre (entrenamientos_sesiones,
--  salas_resultados, top_killers). Las vistas LATAM ahora las suman con
--  UNION ALL: sigue sin copiarse nada (0 bytes extra).
-- =====================================================================

update public.portales
   set latam = true, orden = 0, color = '#D8C395', ruta = '/entrenamientos/',
       link = coalesce(link, 'https://chat.whatsapp.com/DW7DWlsOKKDENaW3S8aZCd')
 where id = 'entrenamientos';

-- Los ids van como texto: así sirven aunque Pumas use otro tipo de id.
drop view if exists public.v_latam_sesiones;
drop view if exists public.v_latam_equipos;
drop view if exists public.v_latam_killers;

-- Entrenos (calendario)
create view public.v_latam_sesiones
with (security_invoker = true) as
select s.id::text as id, s.portal, s.titulo, s.jornada, s.fecha, s.moderador
  from public.portal_sesiones s
  join public.portales p on p.id = s.portal and p.latam
union all
select es.id::text, 'entrenamientos', es.titulo, es.jornada, es.fecha, es.moderador
  from public.entrenamientos_sesiones es;

-- Equipo por entreno
create view public.v_latam_equipos
with (security_invoker = true) as
select s.id::text                             as sesion_id,
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
 group by s.id, s.portal, s.fecha, lower(trim(sa.equipo_nombre))
union all
select es.id::text, 'entrenamientos', es.fecha,
       min(sr.equipo_nombre),
       count(*)::smallint,
       sum(sr.total_score)::int,
       sum(sr.kill_score)::int,
       (count(*) filter (where sr.es_booyah))::smallint
  from public.entrenamientos_sesiones es
  join public.salas_resultados sr on sr.sesion_id = es.id
 group by es.id, es.fecha, lower(trim(sr.equipo_nombre));

-- Jugador por entreno (en Pumas top_killers tiene 1 fila por sala → se agrupa)
create view public.v_latam_killers
with (security_invoker = true) as
select s.id::text as sesion_id, s.portal, s.fecha,
       k.jugador_nombre as jugador, k.equipo_nombre as equipo,
       k.kills::int as kills, k.salas::int as salas
  from public.portal_sesiones s
  join public.portales p on p.id = s.portal and p.latam
  join public.portal_killers k on k.sesion_id = s.id
union all
select es.id::text, 'entrenamientos', es.fecha,
       min(tk.jugador_nombre), min(tk.equipo_nombre),
       sum(tk.kills)::int, count(*)::int
  from public.entrenamientos_sesiones es
  join public.top_killers tk on tk.sesion_id = es.id
 group by es.id, es.fecha, lower(trim(tk.jugador_nombre));

grant select on public.v_latam_sesiones, public.v_latam_equipos, public.v_latam_killers to anon, authenticated;

-- Revisión: cuántos entrenos hay por portal en LATAM
select portal, count(*) as entrenos from public.v_latam_sesiones group by portal order by portal;
