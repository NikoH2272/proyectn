-- =====================================================================
--  PUMAS GAMING · 10 · ZMF mixto y femenino (igual que Dragon Fest)
--  Requiere 02, 07 y 09. Se puede correr las veces que quieras.
--    - nuevo portal zmffem (resultados aparte, entra en Entrenos LATAM)
--    - el rol de ZMF maneja los dos (la herramienta /zmf/admin.html es compartida)
-- =====================================================================

insert into public.portales (id, nombre, color, ruta, latam, orden) values
    ('zmffem', 'ZMF Femenino', '#B620E0', '/zmf/femenino.html', true, 7)
on conflict (id) do update
   set latam = true, orden = 7, ruta = excluded.ruta;

update public.portales set nombre = 'ZMF' where id = 'zmf';

-- El rol de ZMF ahora ve mixto y femenino
update public.roles
   set portales = array(select distinct unnest(portales || array['zmffem'])),
       nombre = 'Admin ZMF'
 where id = 'zmf';

-- Revisión
select id, nombre, portales from public.roles where id = 'zmf';
select id, nombre, latam, orden, ruta from public.portales where id in ('zmf', 'zmffem');
