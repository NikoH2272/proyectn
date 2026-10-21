-- =====================================================================
--  PUMAS GAMING · 06 · Dragon Fest (mixto y femenino)
--  Separa Dragon Fest de Ascensos QFD:
--    - 2 portales con resultados aparte: dragonfest (mixto) y dragonfestfem
--    - 1 rol que maneja los dos (la herramienta /dragonfest/admin.html es compartida)
--  Requiere 02 y 03. Se puede correr las veces que quieras.
-- =====================================================================

insert into public.portales (id, nombre, color, ruta) values
    ('dragonfest',    'Dragon Fest',          '#2E6BFF', '/dragonfest/'),
    ('dragonfestfem', 'Dragon Fest Femenino', '#FF4FA3', '/dragonfestfem/')
on conflict (id) do nothing;

insert into public.roles (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios) values
    ('dragonfest', 'Admin Dragon Fest', '{dragonfest,dragonfestfem}', false, false)
on conflict (id) do nothing;

-- El usuario se crea desde el panel: coachniko → Usuarios y roles →
-- usuario "admindragonfest" con el rol "Admin Dragon Fest".

-- Revisión
select id, nombre, portales from public.roles order by id;
