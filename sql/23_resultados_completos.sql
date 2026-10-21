-- =====================================================================
--  PUMAS GAMING · 23 · "Resultados completos" (exportado de la sala)
--  Requiere 17. Se puede correr las veces que quieras.
--
--  La sala de Free Fire exporta dos cosas:
--    · Resultados          → MatchResult_<id>.log  (equipos, top y kills) — lo de siempre
--    · Resultados completos → <id>.csv             (1 fila por jugador: daño, headshots,
--                             paredes gloo, revividos, tiempo vivo, armas usadas...)
--  Los completos se guardan aquí (stats_jugadores) y salen como estadísticas
--  avanzadas del entreno. Por defecto SOLO en Entrenos Pumas; el superadmin
--  lo habilita para más eventos en Admin → Resultados completos.
-- =====================================================================

-- 1) Permiso por evento: sitio_config 'export_completo' = {"portales": [...]}
insert into public.sitio_config (clave, valor) values ('export_completo', '{"portales": ["entrenamientos", "pruebas"]}')
on conflict (clave) do nothing;
-- El módulo de pruebas también lo tiene habilitado (si ya existía la configuración, se le agrega)
update public.sitio_config
   set valor = jsonb_set(valor, '{portales}', coalesce(valor->'portales', '[]'::jsonb) || '["pruebas"]'::jsonb)
 where clave = 'export_completo' and not coalesce(valor->'portales', '[]'::jsonb) ? 'pruebas';

create or replace function public._export_completo_ok(p_portal text)
returns boolean language sql stable
set search_path = public
as $$
    select coalesce((select (valor->'portales') ? p_portal from sitio_config where clave = 'export_completo'), p_portal in ('entrenamientos', 'pruebas'));
$$;
revoke execute on function public._export_completo_ok(text) from public, anon, authenticated;

create or replace function public.admin_export_completo(p_token uuid, p_portales text[])
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'gestionar')->>'usuario';
    malo text;
begin
    select x into malo from unnest(coalesce(p_portales, '{}')) x where not exists (select 1 from portales where id = x) limit 1;
    if malo is not null then raise exception 'El portal % no existe', malo; end if;
    insert into sitio_config (clave, valor, actualizado, actualizado_por)
    values ('export_completo', jsonb_build_object('portales', coalesce(to_jsonb(p_portales), '[]'::jsonb)), now(), quien)
    on conflict (clave) do update set valor = excluded.valor, actualizado = now(), actualizado_por = excluded.actualizado_por;
    return json_build_object('ok', true);
end $$;


-- 2) Estadísticas por jugador y por sala (compactas: 1 fila por jugador por sala)
create table if not exists public.stats_jugadores (
    id          bigint generated always as identity primary key,
    portal      text not null,
    sesion_id   text not null,            -- id del entreno (uuid en Pumas, número en los demás portales)
    sala        smallint not null,
    match_id    text,
    mapa        smallint,
    modo        smallint,
    equipo      text,
    jugador     text not null,
    account_id  text,
    kills       smallint not null default 0,
    dano        int not null default 0,
    headshots   smallint not null default 0,
    hits        smallint not null default 0,
    disparos    smallint not null default 0,
    revividos   smallint not null default 0,   -- veces que revivió a un compañero
    gloo        smallint not null default 0,   -- paredes gloo usadas
    vivo        smallint not null default 0,   -- segundos vivo
    asistencias smallint not null default 0,
    derribos    smallint not null default 0,
    booyah      boolean not null default false,
    arma        text,                          -- arma con la que hizo más daño
    armas       jsonb not null default '[]',   -- [{n: nombre, d: daño, k: kills, hs: headshots, s: disparos}]
    extra       jsonb not null default '{}',
    fecha       timestamptz,                   -- fecha y hora del entreno (para filtrar por día)
    titulo      text,                          -- nombre del entreno   -- de la repetición (.json): muertes, primera sangre, kill más lejana...
    creado      timestamptz not null default now()
);
alter table public.stats_jugadores add column if not exists extra jsonb not null default '{}';
alter table public.stats_jugadores add column if not exists fecha timestamptz;
alter table public.stats_jugadores add column if not exists titulo text;
create index if not exists stats_jugadores_sesion on public.stats_jugadores (portal, sesion_id);
create index if not exists stats_jugadores_fecha on public.stats_jugadores (portal, creado desc);
alter table public.stats_jugadores enable row level security;
drop policy if exists "stats_jugadores lectura publica" on public.stats_jugadores;
create policy "stats_jugadores lectura publica" on public.stats_jugadores for select using (true);

-- Guardar las estadísticas de un entreno (reemplaza las que hubiera de ese entreno)
create or replace function public.guardar_stats(p_token uuid, p_portal text, p_sesion text, p_filas jsonb)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    n int;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if not _export_completo_ok(p_portal) then
        raise exception 'Los resultados completos no están habilitados para este evento (Admin → Resultados completos)';
    end if;
    if jsonb_typeof(p_filas) <> 'array' or jsonb_array_length(p_filas) = 0 then raise exception 'No hay estadísticas para guardar'; end if;
    if jsonb_array_length(p_filas) > 1500 then raise exception 'Demasiadas filas en un solo entreno'; end if;
    delete from stats_jugadores where portal = p_portal and sesion_id = p_sesion;
    insert into stats_jugadores (portal, sesion_id, sala, match_id, mapa, modo, equipo, jugador, account_id, kills, dano, headshots,
                                 hits, disparos, revividos, gloo, vivo, asistencias, derribos, booyah, arma, armas, extra, fecha, titulo)
    select p_portal, p_sesion,
           least(greatest(coalesce((x->>'sala')::int, 1), 1), 50),
           left(x->>'match_id', 40), (x->>'mapa')::smallint, (x->>'modo')::smallint,
           left(trim(x->>'equipo'), 60), left(trim(x->>'jugador'), 60), left(x->>'account_id', 30),
           coalesce((x->>'kills')::int, 0), coalesce((x->>'dano')::int, 0), coalesce((x->>'headshots')::int, 0),
           coalesce((x->>'hits')::int, 0), coalesce((x->>'disparos')::int, 0), coalesce((x->>'revividos')::int, 0),
           coalesce((x->>'gloo')::int, 0), least(coalesce((x->>'vivo')::int, 0), 32000), coalesce((x->>'asistencias')::int, 0),
           coalesce((x->>'derribos')::int, 0), coalesce((x->>'booyah')::boolean, false),
           left(x->>'arma', 40), coalesce(x->'armas', '[]'),
           case when jsonb_typeof(x->'extra') = 'object' then x->'extra' else '{}' end,
           case when coalesce(x->>'fecha', '') ~ '^\d{4}-\d{2}-\d{2}' then (x->>'fecha')::timestamptz end,
           left(x->>'titulo', 80)
      from jsonb_array_elements(p_filas) x
     where coalesce(trim(x->>'jugador'), '') <> '';
    get diagnostics n = row_count;
    return json_build_object('ok', true, 'filas', n);
end $$;

-- Al borrar un entreno (Admin → Corregir entrenos) también se borran sus estadísticas
create or replace function public.admin_borrar_entreno(p_token uuid, p_portal text, p_sesion text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    n int;
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if p_portal = 'entrenamientos' then
        delete from top_killers      where sesion_id::text = p_sesion;
        delete from salas_resultados where sesion_id::text = p_sesion;
        delete from entrenamientos_sesiones where id::text = p_sesion;
    else
        delete from portal_sesiones where id::text = p_sesion and portal = p_portal;
    end if;
    get diagnostics n = row_count;
    if n = 0 then
        raise exception 'No se encontró ese entreno en %', p_portal;
    end if;
    delete from stats_jugadores where portal = p_portal and sesion_id = p_sesion;
    return json_build_object('ok', true);
end $$;

grant execute on function public.admin_export_completo(uuid, text[])         to anon, authenticated;
grant execute on function public.guardar_stats(uuid, text, text, jsonb)       to anon, authenticated;
grant execute on function public.admin_borrar_entreno(uuid, text, text)       to anon, authenticated;

-- Borrar solo el análisis (estadísticas) de un entreno: lo usa la pestaña Análisis del módulo de pruebas
create or replace function public.borrar_stats(p_token uuid, p_portal text, p_sesion text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    n int;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    delete from stats_jugadores where portal = p_portal and sesion_id = p_sesion;
    get diagnostics n = row_count;
    return json_build_object('ok', true, 'filas', n);
end $$;
grant execute on function public.borrar_stats(uuid, text, text) to anon, authenticated;
