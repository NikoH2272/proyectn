-- =====================================================================
--  PUMAS GAMING · 04 · Revisar y corregir roles y claves de los admins
--  Requiere 01 y 02. Se puede correr las veces que quieras.
-- =====================================================================

-- 1) REVISIÓN: corre solo este SELECT primero y mira la columna "rol".
--    adminrow debe decir row, adminrusheo → rusheo, adminzmf → zmf,
--    adminqfd → qfd, adminpumas → pumas, coachniko → superadmin.
select u.usuario, u.email, u.rol, r.portales, u.activo,
       (u.password ~ '^\$2[aby]\$') as clave_cifrada
  from public.usuarios_admin u
  left join public.roles r on r.id = u.rol
 order by u.usuario;


-- 2) CORRECCIÓN DE ROLES (fuerza el rol correcto aunque ya tuvieran otro)
update public.usuarios_admin set rol = 'superadmin', activo = true where lower(usuario) = 'coachniko';
update public.usuarios_admin set rol = 'pumas',      activo = true where lower(usuario) = 'adminpumas';
update public.usuarios_admin set rol = 'qfd',        activo = true where lower(usuario) = 'adminqfd';
update public.usuarios_admin set rol = 'row',        activo = true where lower(usuario) = 'adminrow';
update public.usuarios_admin set rol = 'rusheo',     activo = true where lower(usuario) = 'adminrusheo';
update public.usuarios_admin set rol = 'zmf',        activo = true where lower(usuario) = 'adminzmf';


-- 3) NUEVA CLAVE PARA adminpumas
--    Si adminpumas ya existía antes del 01 (por ejemplo, adminpumas@...),
--    el 01 no lo volvió a crear y conservó su clave ANTERIOR, no la que
--    pusiste en el script.
--    Más fácil: entra como coachniko → Usuarios y roles → fila adminpumas →
--    "Cambiar clave" → Guardar.  O por SQL: quita los dos guiones de las
--    3 líneas de abajo, cambia la clave y córrelo.
-- update public.usuarios_admin
--    set password = extensions.crypt('PON_AQUI_LA_CLAVE', extensions.gen_salt('bf'))
--  where lower(usuario) = 'adminpumas';

-- Cierra las sesiones abiertas para que todos vuelvan a entrar con su rol nuevo
delete from public.admin_sesiones;

-- Revisión final
select u.usuario, u.rol, r.portales from public.usuarios_admin u
  left join public.roles r on r.id = u.rol order by u.usuario;
