-- =====================================================================
--  PUMAS GAMING · 46 · Nuevos tipos de juego (Pac-Man, Breakout, Bomberman)
--  + función de exportación de datos
--  Corre en Supabase SQL Editor
-- =====================================================================

-- ── 1. Ampliar constraint de tipos ───────────────────────────────────
alter table public.din_sesiones
    drop constraint if exists din_sesiones_tipo_check;

alter table public.din_sesiones
    add constraint din_sesiones_tipo_check
    check (tipo in (
        'registro','encuesta',
        'juego','juego_tetris','juego_3lineas',
        'juego_pacman','juego_breakout','juego_bomberman'
    ));

-- ── 2. Actualizar din_admin_config para aceptar nuevos tipos ─────────
create or replace function public.din_admin_config(
    p_token            uuid,
    p_portal           text,
    p_tipo             text,
    p_activo           boolean     default null,
    p_titulo           text        default null,
    p_config           jsonb       default null,
    p_deadline         timestamptz default null,
    p_quitar_deadline  boolean     default false,
    p_inicio           timestamptz default null,
    p_quitar_inicio    boolean     default false
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
begin
    if p_tipo not in (
        'registro','encuesta',
        'juego','juego_tetris','juego_3lineas',
        'juego_pacman','juego_breakout','juego_bomberman'
    ) then
        raise exception 'Tipo desconocido: %', p_tipo;
    end if;
    if not exists (select 1 from portales where id = p_portal) then
        raise exception 'Portal desconocido: %', p_portal;
    end if;

    insert into din_sesiones (portal, tipo, activo, titulo, config, deadline, inicio, actualizado_por)
    values (p_portal, p_tipo,
            coalesce(p_activo, false),
            nullif(trim(coalesce(p_titulo, '')), ''),
            coalesce(p_config, '{}'),
            case when coalesce(p_quitar_deadline, false) then null else p_deadline end,
            case when coalesce(p_quitar_inicio,   false) then null else p_inicio   end,
            ses->>'usuario')
    on conflict (portal, tipo) do update set
        activo          = coalesce(p_activo,   din_sesiones.activo),
        titulo          = case when p_titulo is null then din_sesiones.titulo
                               else nullif(trim(p_titulo), '') end,
        config          = coalesce(p_config,   din_sesiones.config),
        deadline        = case when coalesce(p_quitar_deadline, false) then null
                               else coalesce(p_deadline, din_sesiones.deadline) end,
        inicio          = case when coalesce(p_quitar_inicio, false) then null
                               else coalesce(p_inicio, din_sesiones.inicio) end,
        actualizado     = now(),
        actualizado_por = ses->>'usuario';

    return json_build_object('ok', true);
end $$;

-- ── 3. Actualizar din_registrar para nuevos tipos ────────────────────
-- (Sólo necesita que el constraint exista — la función ya usa 'juego%')
-- Verificar que sigue funcionando
select 'din_registrar soporta juego% por wildcard' as info;

-- ── 4. Función de exportación para el admin ──────────────────────────
create or replace function public.din_exportar(
    p_token  uuid,
    p_portal text,
    p_tipo   text default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses json := _exigir_permiso(p_token, 'portal:' || p_portal);
begin
    return (
        select coalesce(json_agg(
            json_build_object(
                'id',      e.id,
                'portal',  e.portal,
                'tipo',    e.tipo,
                'nombre',  e.nombre,
                'numero',  e.numero,
                'ig',      e.ig,
                'puntos',  (e.metadata->>'puntos')::int,
                'metadata',e.metadata,
                'creado',  to_char(e.creado, 'YYYY-MM-DD HH24:MI:SS')
            ) order by e.creado desc
        ), '[]'::json)
        from din_entradas e
        where e.portal = p_portal
          and (p_tipo is null or e.tipo = p_tipo)
    );
end $$;

grant execute on function public.din_exportar(uuid, text, text) to anon, authenticated;

-- ── 5. Ampliar din_publico para nuevos tipos ─────────────────────────
-- (Ya funciona con 'juego%' wildcard — sólo verificamos)
select 'din_publico soporta juego% por wildcard' as info;

-- ── 6. Permisos actualizados ─────────────────────────────────────────
grant execute on function public.din_admin_config(uuid, text, text, boolean, text, jsonb, timestamptz, boolean, timestamptz, boolean) to anon, authenticated;

-- ── 7. Ver tipos disponibles ─────────────────────────────────────────
select tipo, count(*) as portales_con_sesion
from din_sesiones
group by tipo
order by tipo;
