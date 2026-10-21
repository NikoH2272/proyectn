-- =====================================================================
--  PUMAS GAMING · 18 · Roles de ascensos y resultados con IA
--  Requiere 17. Se puede correr las veces que quieras.
--
--  · Rol padre "administradorascensos" (Administrador Ascensos): ve TODOS
--    los ascensos (AZA, QFD y Pruebas).
--  · Cada ascenso es un sub rol suyo: aza, qfd, pruebas (solo su portal).
--    roles.padre guarda la relación; el panel los muestra agrupados.
--  · IA (SOLO Ascensos AZA): la función de Supabase "ascensos-ia" lee
--    las capturas con Claude. Antes de llamar a la IA pide permiso aquí:
--    ia_autorizar revisa la sesión, el acceso al portal y el límite diario
--    (40 lecturas por usuario por día) y deja registro en ia_uso.
-- =====================================================================

-- 1) ROLES: padre y sub roles ------------------------------------------
alter table public.roles add column if not exists padre text references public.roles(id) on update cascade on delete set null;

insert into public.roles as r (id, nombre, portales, puede_personalizar, puede_gestionar_usuarios) values
    ('administradorascensos', 'Administrador Ascensos', '{ascensosaza,ascensosqfd,pruebas}', false, false)
on conflict (id) do update set portales = array(select distinct unnest(r.portales || excluded.portales));

insert into public.roles (id, nombre, portales) values
    ('aza', 'Ascensos AZA', '{ascensosaza}'),
    ('qfd', 'Ascensos QFD', '{ascensosqfd}'),
    ('pruebas', 'Ascensos Pruebas', '{pruebas}')
on conflict (id) do nothing;

update public.roles set padre = 'administradorascensos', nombre = 'Ascensos AZA'     where id = 'aza';
update public.roles set padre = 'administradorascensos', nombre = 'Ascensos QFD'     where id = 'qfd';
update public.roles set padre = 'administradorascensos', nombre = 'Ascensos Pruebas' where id = 'pruebas';

-- El listado del panel ahora trae el padre de cada rol
create or replace function public.admin_listar(p_token uuid)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    return json_build_object(
        'usuarios', coalesce((
            select json_agg(json_build_object(
                       'usuario', u.usuario, 'nombre', u.nombre, 'email', u.email,
                       'rol', u.rol, 'activo', u.activo) order by lower(u.usuario))
              from usuarios_admin u), '[]'::json),
        'roles', coalesce((
            select json_agg(json_build_object(
                       'id', r.id, 'nombre', r.nombre, 'portales', r.portales, 'padre', r.padre,
                       'personalizar', r.puede_personalizar, 'gestionar', r.puede_gestionar_usuarios,
                       'usuarios', (select count(*) from usuarios_admin u where u.rol = r.id)) order by r.id)
              from roles r), '[]'::json),
        'portales', coalesce((
            select json_agg(json_build_object('id', p.id, 'nombre', p.nombre, 'color', p.color) order by p.id)
              from portales p where p.activo), '[]'::json)
    );
end $$;

-- Cambiar de quién es sub rol (null = rol suelto)
create or replace function public.admin_rol_padre(p_token uuid, p_id text, p_padre text)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if nullif(p_padre, '') is not null then
        if p_padre = p_id then raise exception 'Un rol no puede ser sub rol de sí mismo'; end if;
        if not exists (select 1 from roles where id = p_padre) then raise exception 'El rol padre no existe'; end if;
        if exists (select 1 from roles where id = p_padre and padre = p_id) then
            raise exception 'Ese rol ya es sub rol de este (no se pueden cruzar)';
        end if;
    end if;
    update roles set padre = nullif(p_padre, '') where id = p_id;
    return json_build_object('ok', true);
end $$;


-- 2) IA: permiso, límite diario y registro --------------------------------
create table if not exists public.ia_uso (
    id       bigint generated always as identity primary key,
    usuario  text not null,
    portal   text not null,
    imagenes smallint not null default 0,
    creado   timestamptz not null default now()
);
create index if not exists ia_uso_usuario_dia on public.ia_uso (lower(usuario), creado desc);
alter table public.ia_uso enable row level security;   -- sin políticas: privado

create or replace function public.ia_autorizar(p_token uuid, p_portal text, p_imagenes int)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:' || p_portal)->>'usuario';
    hoy int;
    limite constant int := 40;
begin
    if p_portal <> 'ascensosaza' then
        raise exception 'La lectura con IA es solo para Ascensos AZA';
    end if;
    if coalesce(p_imagenes, 0) < 1 or p_imagenes > 16 then
        raise exception 'Sube de 1 a 16 capturas por lectura';
    end if;
    select count(*) into hoy from ia_uso
     where lower(usuario) = lower(quien) and creado > now() - interval '1 day';
    if hoy >= limite then
        raise exception 'Llegaste al límite de % lecturas con IA en 24 horas', limite;
    end if;
    insert into ia_uso (usuario, portal, imagenes) values (quien, p_portal, p_imagenes);
    return json_build_object('ok', true, 'usuario', quien, 'quedan', limite - hoy - 1);
end $$;

-- 3) MOTORES DE IA: el superadmin elige cuáles están activos y cuál va por defecto
--    (sitio_config 'ia_motores'). La función ascensos-ia lo lee: solo usa los activos.
insert into public.sitio_config (clave, valor) values ('ia_motores', '{"activos": ["gemini"], "defecto": "gemini"}')
on conflict (clave) do nothing;

create or replace function public.admin_ia_motores(p_token uuid, p_activos text[], p_defecto text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'gestionar')->>'usuario';
    malo text;
begin
    select x into malo from unnest(coalesce(p_activos, '{}')) x where x not in ('gemini', 'privado', 'claude') limit 1;
    if malo is not null then raise exception 'Motor desconocido: %', malo; end if;
    if p_defecto is not null and not (p_defecto = any(coalesce(p_activos, '{}'))) then
        raise exception 'El motor por defecto tiene que estar activo';
    end if;
    insert into sitio_config (clave, valor, actualizado, actualizado_por)
    values ('ia_motores', jsonb_build_object('activos', coalesce(to_jsonb(p_activos), '[]'::jsonb), 'defecto', p_defecto), now(), quien)
    on conflict (clave) do update set valor = excluded.valor, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;

grant execute on function public.admin_ia_motores(uuid, text[], text) to anon, authenticated;
grant execute on function public.admin_listar(uuid)                to anon, authenticated;
grant execute on function public.admin_rol_padre(uuid, text, text) to anon, authenticated;
grant execute on function public.ia_autorizar(uuid, text, int)     to anon, authenticated;

-- Revisión
select id, nombre, padre, portales from public.roles order by coalesce(padre, id), padre nulls first, id;
