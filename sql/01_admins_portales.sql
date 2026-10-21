-- =====================================================================
--  PUMAS GAMING · Admins por portal, login por usuario y configuración
--  Ejecutar completo en Supabase → SQL Editor (es idempotente: se puede
--  correr más de una vez sin romper nada).
-- =====================================================================

-- 0) (OPCIONAL) VER LA ESTRUCTURA ACTUAL DE TU BASE ---------------------
--    Corre solo este SELECT, copia el resultado (botón "Copy" / CSV) y
--    pégamelo en el chat para conocer tus tablas y columnas.
-- select table_name, column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
-- order by table_name, ordinal_position;


-- 1) EXTENSIÓN PARA CIFRAR CONTRASEÑAS ---------------------------------
create extension if not exists pgcrypto with schema extensions;


-- 2) USUARIOS: login por nombre de usuario (sin @) + permisos por portal
alter table public.usuarios_admin add column if not exists usuario  text;
alter table public.usuarios_admin add column if not exists nombre   text;
alter table public.usuarios_admin add column if not exists portales text[]  not null default '{}';
alter table public.usuarios_admin add column if not exists activo   boolean not null default true;

-- El correo deja de ser obligatorio
alter table public.usuarios_admin alter column email drop not null;

-- Los usuarios que ya existían usan como usuario lo que va antes del @
-- (ej. admin@pumas.com → admin). Revisa el resultado al final.
update public.usuarios_admin
   set usuario = lower(split_part(email, '@', 1))
 where usuario is null and email is not null;

update public.usuarios_admin set nombre = usuario where nombre is null;

-- Los admins que ya existían conservan acceso total
update public.usuarios_admin set portales = '{*}' where portales = '{}';

create unique index if not exists usuarios_admin_usuario_key
    on public.usuarios_admin (lower(usuario));

-- Cifra las contraseñas que estén en texto plano (bcrypt)
update public.usuarios_admin
   set password = extensions.crypt(password, extensions.gen_salt('bf'))
 where password is not null and password !~ '^\$2[aby]\$';

-- Nadie puede leer la tabla directo con la llave pública: solo las
-- funciones de abajo (security definer) acceden a ella.
alter table public.usuarios_admin enable row level security;


-- 3) SESIONES ----------------------------------------------------------
create table if not exists public.admin_sesiones (
    token   uuid primary key default gen_random_uuid(),
    usuario text not null,
    creada  timestamptz not null default now(),
    expira  timestamptz not null default now() + interval '7 days'
);
alter table public.admin_sesiones enable row level security;


-- 4) PERSONALIZACIÓN ---------------------------------------------------
--    Fila 'global' → efecto que sale en TODAS las páginas.
--    (Quién puede cambiarlo lo define el rol, ver 02_roles_usuarios.sql)
create table if not exists public.portal_config (
    portal          text primary key,
    efecto          text not null default 'ninguno'
                    check (efecto in ('ninguno','iconos','fantasmas','calabazas','nieve')),
    efecto_icono    text not null default '🔥',
    efecto_cantidad int  not null default 30 check (efecto_cantidad between 5 and 120),
    logos           jsonb not null default '[null,null,null,null]'::jsonb,
    actualizado     timestamptz not null default now(),
    actualizado_por text
);
alter table public.portal_config enable row level security;

drop policy if exists "portal_config lectura publica" on public.portal_config;
create policy "portal_config lectura publica"
    on public.portal_config for select using (true);

insert into public.portal_config (portal) values ('global')
on conflict (portal) do nothing;


-- 5) FUNCIONES -----------------------------------------------------------
--    Solo cerrar_sesion vive aquí. login_admin, validar_sesion y
--    guardar_efecto_global se definen en 02_roles_usuarios.sql (con roles).
--    Así, volver a correr este archivo NO pisa las funciones de roles.
create or replace function public.cerrar_sesion(p_token uuid)
returns void
language sql security definer
set search_path = public
as $$
    delete from admin_sesiones where token = p_token;
$$;

drop function if exists public.guardar_config_portal(uuid, text, text, text, int, jsonb);
drop function if exists public.guardar_logos_portal(uuid, text, jsonb);

grant execute on function public.cerrar_sesion(uuid) to anon, authenticated;


-- 6) CREAR LOS ADMINS ---------------------------------------------------
--    portales: '*' = todo · o cualquiera de:
--    principal, entrenamientos, ascensosqfd, row, rusheo, zmf
--    ⚠ CAMBIA cada 'CAMBIAR_CLAVE_...' por una contraseña real antes de correr.
insert into public.usuarios_admin (usuario, nombre, password, portales)
select v.usuario, v.nombre, extensions.crypt(v.clave, extensions.gen_salt('bf')), v.portales
  from (values
    ('adminpumas',  'Admin Pumas',  'adminpumas11',  array['*']),
    ('coachniko',   'Coach Niko',   'coach2272niko',   array['*']),
    ('adminqfd',    'Admin QFD',    'adminqfd33',    array['ascensosqfd']),
    ('adminrow',    'Admin ROW',    'adminrow44',    array['row']),
    ('adminrusheo', 'Admin Rusheo', 'adminrusheo55', array['rusheo']),
    ('adminzmf',    'Admin ZMF',    'adminzmf66',    array['zmf'])
  ) as v(usuario, nombre, clave, portales)
 where not exists (
    select 1 from public.usuarios_admin a where lower(a.usuario) = lower(v.usuario)
 );


-- 7) UTILIDADES (copiar y correr cuando las necesites) ------------------
-- Cambiar contraseña:
--   update public.usuarios_admin
--      set password = extensions.crypt('NUEVA_CLAVE', extensions.gen_salt('bf'))
--    where usuario = 'coachniko';
--
-- Dar acceso a otro portal:
--   update public.usuarios_admin
--      set portales = array_append(portales, 'rusheo')
--    where usuario = 'adminrow';
--
-- Desactivar un usuario:
--   update public.usuarios_admin set activo = false where usuario = 'adminzmf';

-- Revisión final
select usuario, nombre, email, portales, activo from public.usuarios_admin order by usuario;
