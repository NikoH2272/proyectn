-- =====================================================================
--  PUMAS GAMING · 11 · Links de los grupos de WhatsApp de cada entreno
--  Requiere 07. Se puede correr las veces que quieras.
--  (El sitio ya los trae por defecto; esto los deja también en la base,
--   donde se pueden cambiar sin tocar código: Table Editor → portales → link)
--  Dragon Fest queda pendiente: cuando tengas el link, corre la línea comentada.
-- =====================================================================

update public.portales set link = 'https://chat.whatsapp.com/DW7DWlsOKKDENaW3S8aZCd' where id = 'entrenamientos';
update public.portales set link = 'https://chat.whatsapp.com/Lqu9o94aq9XIBI1QlYR6M0' where id = 'rusheo';
update public.portales set link = 'https://chat.whatsapp.com/GMp7e5AUHpa6qoiJuhQ8wA' where id = 'row';
update public.portales set link = 'https://chat.whatsapp.com/GHpSM5xUyWdHr79DIsW2p8' where id = 'ascensosqfd';
update public.portales set link = 'https://chat.whatsapp.com/KSCHFXzg3XJGNIU6dt6UAl' where id in ('zmf', 'zmffem');
-- update public.portales set link = 'https://chat.whatsapp.com/...' where id in ('dragonfest', 'dragonfestfem');

select id, nombre, link from public.portales where latam order by orden;
