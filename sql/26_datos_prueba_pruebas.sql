-- =====================================================================
--  PUMAS GAMING · 26 · DATOS DE EJEMPLO para el módulo de PRUEBAS (opcional)
--  Requiere 25. Solo toca el portal 'pruebas'. Se puede correr las veces que quieras
--  (primero borra los ejemplos anteriores y los vuelve a crear).
--
--  Qué deja para probar:
--    · Lista VIP: 4 equipos con su número.
--    · Baneados: 2 equipos y 2 números (uno de ellos de un equipo que NO está
--      baneado por nombre, para probar que el número solo ya bloquea).
--    · Cupos:
--        - [DEMO] SCRIM PÚBLICO 8PM  → abierto, 12 cupos, 4 inscritos (1 de staff)
--        - [DEMO] SCRIM VIP 10PM     → solo VIP, 12 cupos, 2 VIP inscritos
--        - [DEMO] SCRIM PÚBLICO MAÑANA → programado: se abre en 2 horas (contador)
--        - [DEMO] SCRIM VIP LLENO    → VIP, 3 de 3 cupos: sale "Cupos agotados"
--
--  Los cupos PÚBLICOS salen en /pruebas/cupos.html; los VIP SOLO en la página
--  oculta /pruebas/cupos-vip.html (el link está en Admin → Cupos → Lista VIP).
--  Cómo probar:
--    ✔ Inscribir "LOS TIGRES" con +57 3005550001 en el VIP 10PM → entra (es VIP)
--    ✖ Inscribir "LOS TIGRES" con otro número en el VIP → "solo para equipos VIP..."
--    ✖ Inscribir "EQUIPO X" en el VIP → no está en la lista VIP
--    ✖ Inscribir "TOXIC SQUAD" en el público → equipo baneado
--    ✖ Inscribir cualquier equipo con +57 3009990001 en el público → número baneado
--    ✔ Inscribir "NUEVOS GG" con +57 3001112233 en el público → entra
--
--  Para BORRAR los ejemplos: corre solo el bloque "1) Limpiar" de abajo.
-- =====================================================================

-- 1) Limpiar ejemplos anteriores ------------------------------------------
delete from public.portal_cupos c using public.portal_programados p
 where c.programado_id = p.id and p.portal = 'pruebas' and p.titulo like '[DEMO]%';
delete from public.portal_programados where portal = 'pruebas' and titulo like '[DEMO]%';
delete from public.cupos_vip          where portal = 'pruebas' and creado_por = 'demo';
delete from public.ban_telefonos      where portal = 'pruebas' and creado_por = 'demo';
delete from public.asc_baneados       where portal = 'pruebas' and creado_por = 'demo';

-- 2) Lista VIP ------------------------------------------------------------
insert into public.cupos_vip (portal, equipo, telefono, creado_por) values
    ('pruebas', 'LOS TIGRES',      '+57 3005550001', 'demo'),
    ('pruebas', 'DRAGONES FC',     '+52 5512340002', 'demo'),
    ('pruebas', 'NOVA LEGION',     '+57 3005550003', 'demo'),
    ('pruebas', 'BLOODY BROTHERS', '+54 1155550004', 'demo')
on conflict do nothing;

-- 3) Baneados -------------------------------------------------------------
insert into public.asc_baneados (portal, equipo, tag, motivo, hasta, creado_por) values
    ('pruebas', 'TOXIC SQUAD', 'TXS', 'DEMO · No jugó la última sala', null, 'demo'),
    ('pruebas', 'GHOST TEAM',  'GHT', 'DEMO · Jugó solo 1 sala',      current_date + 7, 'demo')
on conflict do nothing;
insert into public.ban_telefonos (portal, telefono, equipo, motivo, hasta, creado_por) values
    ('pruebas', '+57 3009990001', 'TOXIC SQUAD', 'DEMO · No jugó la última sala', null, 'demo'),
    ('pruebas', '+52 5599990002', 'SIN NOMBRE',  'DEMO · Número baneado (el equipo no)', null, 'demo')
on conflict do nothing;

-- 4) Cupos e inscritos ----------------------------------------------------
do $$
declare pub bigint; vip bigint; lleno bigint;
begin
    insert into portal_programados (portal, titulo, fecha, hay_staff, cupos_totales, link_grupo, estado, publicar_en, tipo)
    values ('pruebas', '[DEMO] SCRIM PÚBLICO 8PM', now() + interval '6 hours', true, 12, 'https://chat.whatsapp.com/DEMO', 'ABIERTO', null, 'PUBLICO')
    returning id into pub;
    insert into portal_cupos (programado_id, nombre_equipo, telefono) values
        (pub, 'PUMAS SQUAD', 'REGISTRO STAFF'),
        (pub, 'INFINITY',    '+57 3001110001'),
        (pub, 'LYON',        '+57 3001110002'),
        (pub, 'GUN DYNASTY', '+52 5511110003');

    insert into portal_programados (portal, titulo, fecha, hay_staff, cupos_totales, link_grupo, estado, publicar_en, tipo)
    values ('pruebas', '[DEMO] SCRIM VIP 10PM', now() + interval '8 hours', false, 12, 'https://chat.whatsapp.com/DEMO', 'ABIERTO', null, 'VIP')
    returning id into vip;
    insert into portal_cupos (programado_id, nombre_equipo, telefono) values
        (vip, 'DRAGONES FC', '+52 5512340002'),
        (vip, 'NOVA LEGION', '+57 3005550003');

    insert into portal_programados (portal, titulo, fecha, hay_staff, cupos_totales, link_grupo, estado, publicar_en, tipo)
    values ('pruebas', '[DEMO] SCRIM PÚBLICO MAÑANA', now() + interval '1 day', false, 12, 'https://chat.whatsapp.com/DEMO', 'ABIERTO', now() + interval '2 hours', 'PUBLICO');

    insert into portal_programados (portal, titulo, fecha, hay_staff, cupos_totales, link_grupo, estado, publicar_en, tipo)
    values ('pruebas', '[DEMO] SCRIM VIP LLENO', now() + interval '10 hours', false, 3, 'https://chat.whatsapp.com/DEMO', 'ABIERTO', null, 'VIP')
    returning id into lleno;
    insert into portal_cupos (programado_id, nombre_equipo, telefono) values
        (lleno, 'LOS TIGRES',      '+57 3005550001'),
        (lleno, 'DRAGONES FC',     '+52 5512340002'),
        (lleno, 'BLOODY BROTHERS', '+54 1155550004');   -- 3 de 3: sale como "Cupos agotados"
end $$;
