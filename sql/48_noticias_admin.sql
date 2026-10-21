-- =====================================================================
--  PROYECTN · 48 · Admin noticias — funciones SECURITY DEFINER
--  Amplía sql/noticias.sql: agrega 'grupos_interes', oculta 'ffws' al
--  público, y expone 5 RPCs para que el admin opere sin service_role.
--
--  Requiere: 01_admins_portales.sql, 02_roles_usuarios.sql, noticias.sql
--  Se puede correr las veces que quieras (idempotente).
-- =====================================================================

-- 1) TABLA — agregar tipo grupos_interes y remodelar CHECK ────────────

alter table public.noticias
    drop constraint if exists noticias_tipo_check;

alter table public.noticias
    add constraint noticias_tipo_check
        check (tipo in ('actualizacion', 'ffws', 'recomendacion', 'grupos_interes'));


-- 2) RLS — ocultar ffws al público (beta) ────────────────────────────

alter table public.noticias enable row level security;

drop policy if exists "noticias_select_public" on public.noticias;
create policy "noticias_select_public" on public.noticias
    for select
    using (activo = true and tipo <> 'ffws');

drop policy if exists "noticias_write_service" on public.noticias;
create policy "noticias_write_service" on public.noticias
    for all
    using  (current_setting('role') = 'service_role')
    with check (current_setting('role') = 'service_role');


-- 3) FUNCIONES ADMIN ─────────────────────────────────────────────────
--    Todas usan SECURITY DEFINER para bypassear RLS.
--    Todas validan la sesión antes de operar.

-- 3a) listar (admin ve inactivas y ffws)
create or replace function public.admin_noticias_listar(
    p_token uuid,
    p_tipo  text
)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    return (
        select coalesce(
            jsonb_agg(
                jsonb_build_object(
                    'id',           n.id,
                    'tipo',         n.tipo,
                    'fecha_display',n.fecha_display,
                    'contenido',    n.contenido,
                    'url',          n.url,
                    'activo',       n.activo,
                    'orden',        n.orden,
                    'created_at',   n.created_at
                )
                order by n.orden, n.created_at desc
            ),
            '[]'::jsonb
        )
        from public.noticias n
        where n.tipo = p_tipo
    );
end $$;


-- 3b) guardar nueva
create or replace function public.admin_noticias_guardar(
    p_token     uuid,
    p_tipo      text,
    p_fecha     text,
    p_contenido text,
    p_url       text default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
    nuevo public.noticias;
begin
    perform _exigir_permiso(p_token, 'gestionar');
    insert into public.noticias (tipo, fecha_display, contenido, url)
        values (p_tipo, p_fecha, p_contenido, p_url)
        returning * into nuevo;
    return to_jsonb(nuevo);
end $$;


-- 3c) actualizar existente
create or replace function public.admin_noticias_actualizar(
    p_token     uuid,
    p_id        uuid,
    p_fecha     text,
    p_contenido text,
    p_url       text default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    update public.noticias
       set fecha_display = p_fecha,
           contenido     = p_contenido,
           url           = p_url
     where id = p_id;
end $$;


-- 3d) activar / desactivar
create or replace function public.admin_noticias_toggle(
    p_token  uuid,
    p_id     uuid,
    p_activo boolean
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    update public.noticias
       set activo = p_activo
     where id = p_id;
end $$;


-- 3e) borrar
create or replace function public.admin_noticias_borrar(
    p_token uuid,
    p_id    uuid
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    delete from public.noticias where id = p_id;
end $$;
