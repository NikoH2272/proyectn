-- =====================================================================
--  PROYECTN · 49 · Pasarela de ascensos por portal
--  Agrega configuración por portal para mostrar una sección CTA que
--  apunta al portal de ascensos activo para ese equipo.
--  Requiere: sql/17_ascensos_modulos_sorteos.sql (tabla portales)
-- =====================================================================

-- 1) COLUMNAS en portales -----------------------------------------------
alter table public.portales add column if not exists asc_activo  boolean not null default false;
alter table public.portales add column if not exists asc_portal  text;   -- referencia al portal de ascensos
alter table public.portales add column if not exists asc_btn     text;   -- texto del botón CTA (null = "Apartar cupo")


-- 2) FUNCIÓN PÚBLICA: obtener config de pasarela para un portal ---------
create or replace function public.portal_ascensos_config(p_portal text)
returns jsonb
language sql security definer stable
set search_path = public
as $$
    select case
        when coalesce(p.asc_activo, false) and p.asc_portal is not null
        then jsonb_build_object(
            'activo',     true,
            'asc_portal', p.asc_portal,
            'btn',        coalesce(nullif(trim(p.asc_btn), ''), 'Apartar cupo'),
            'asc_nombre', ap.nombre,
            'asc_ruta',   coalesce(ap.ruta, '/ascensos/'),
            'asc_color',  coalesce(ap.color_tema, ap.color, '#B6FF00')
        )
        else '{"activo":false}'::jsonb
    end
    from public.portales p
    left join public.portales ap on ap.id = p.asc_portal
    where p.id = p_portal;
$$;


-- 3) FUNCIÓN ADMIN: listar portales con su config de pasarela -----------
create or replace function public.admin_ascensos_portales_listar(p_token uuid)
returns jsonb
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    return (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id',         p.id,
            'nombre',     p.nombre,
            'color',      coalesce(p.color_tema, p.color, '#888'),
            'tipo',       p.tipo,
            'asc_activo', coalesce(p.asc_activo, false),
            'asc_portal', p.asc_portal,
            'asc_btn',    p.asc_btn
        ) order by p.orden, p.id), '[]'::jsonb)
        from public.portales p
        where p.tipo not in ('ascensos')
          and p.id not in ('entrenoslatam', 'pruebas')
    );
end $$;


-- 4) FUNCIÓN ADMIN: actualizar config de pasarela de un portal ----------
create or replace function public.admin_ascensos_portal_config(
    p_token      uuid,
    p_portal     text,
    p_asc_activo boolean,
    p_asc_portal text,    -- '' = borrar la referencia · null = no cambiar
    p_asc_btn    text     -- '' = borrar el texto · null = no cambiar
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');

    if not exists (select 1 from portales where id = p_portal) then
        raise exception 'Portal no encontrado: %', p_portal;
    end if;
    if coalesce(p_asc_portal, '') <> '' and
       not exists (select 1 from portales where id = p_asc_portal and tipo = 'ascensos') then
        raise exception 'Portal de ascensos no válido: %', p_asc_portal;
    end if;

    update portales set
        asc_activo = coalesce(p_asc_activo, asc_activo),
        asc_portal = case
            when p_asc_portal is null then asc_portal
            when p_asc_portal = ''   then null
            else p_asc_portal
        end,
        asc_btn = case
            when p_asc_btn is null then asc_btn
            when p_asc_btn = ''   then null
            else left(trim(p_asc_btn), 60)
        end
    where id = p_portal;

    return jsonb_build_object('ok', true);
end $$;


-- 5) PERMISOS --------------------------------------------------------------
grant execute on function public.portal_ascensos_config(text)                                              to anon, authenticated;
grant execute on function public.admin_ascensos_portales_listar(uuid)                                      to anon, authenticated;
grant execute on function public.admin_ascensos_portal_config(uuid, text, boolean, text, text)             to anon, authenticated;


-- Revisión
select id, nombre, tipo, asc_activo, asc_portal, asc_btn
  from public.portales
 order by orden, id;
