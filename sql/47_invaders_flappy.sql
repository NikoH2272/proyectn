-- =====================================================================
--  PUMAS GAMING · 47 · Nuevos tipos de juego (Space Invaders, Flappy Bird)
--  Corre en Supabase SQL Editor después de 46_nuevos_juegos.sql
-- =====================================================================

-- ── 1. Ampliar constraint de tipos ───────────────────────────────────
alter table public.din_sesiones
    drop constraint if exists din_sesiones_tipo_check;

alter table public.din_sesiones
    add constraint din_sesiones_tipo_check
    check (tipo in (
        'registro','encuesta',
        'juego','juego_tetris','juego_3lineas',
        'juego_pacman','juego_breakout','juego_bomberman',
        'juego_invaders','juego_flappy'
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
        'juego_pacman','juego_breakout','juego_bomberman',
        'juego_invaders','juego_flappy'
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

grant execute on function public.din_admin_config(uuid, text, text, boolean, text, jsonb, timestamptz, boolean, timestamptz, boolean) to anon, authenticated;

-- ── 3. Verificar tipos disponibles ───────────────────────────────────
select tipo, count(*) as portales_con_sesion
from din_sesiones
group by tipo
order by tipo;
