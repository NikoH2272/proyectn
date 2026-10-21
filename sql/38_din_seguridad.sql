-- =====================================================================
--  PUMAS GAMING · 38 · Seguridad de votación — deduplicación server-side
--  Requiere 33_dinamicas.sql corrido primero.
--
--  Protecciones agregadas:
--  · din_votos_ratelimit — una fila por (portal, tipo, ronda, ip_hash)
--                          y una por (portal, tipo, ronda, voter_token)
--  · din_registrar actualizado — rechaza voto duplicado en el servidor
--    usando IP del request y un token de fingerprint que el cliente genera.
-- =====================================================================

-- 1) TABLA DE DEDUPLICACIÓN -------------------------------------------

create table if not exists public.din_votos_ratelimit (
    id           bigint generated always as identity primary key,
    portal       text        not null,
    tipo         text        not null,
    ronda        int         not null default 0,
    ip_hash      text,
    voter_token  text,
    creado       timestamptz not null default now()
);

-- Un voto por IP por ronda
create unique index if not exists din_rl_ip
    on public.din_votos_ratelimit(portal, tipo, ronda, ip_hash)
    where ip_hash is not null;

-- Un voto por token de navegador por ronda
create unique index if not exists din_rl_token
    on public.din_votos_ratelimit(portal, tipo, ronda, voter_token)
    where voter_token is not null;

-- Limpiar registros viejos automáticamente (> 7 días)
create index if not exists din_rl_creado on public.din_votos_ratelimit(creado);


-- 2) FUNCIÓN ACTUALIZADA: din_registrar --------------------------------
--    Agrega p_voter_token (UUID generado en el navegador del participante)
--    y deduplicación server-side por IP + token.

create or replace function public.din_registrar(
    p_portal       text,
    p_tipo         text,
    p_nombre       text,
    p_numero       text    default null,
    p_ig           text    default null,
    p_metadata     jsonb   default '{}',
    p_voter_token  text    default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses       din_sesiones;
    v_nom     text  := left(trim(coalesce(p_nombre, '')), 80);
    v_num     text  := left(trim(coalesce(p_numero, '')), 20);
    v_ig      text  := left(trim(replace(coalesce(p_ig, ''), '@', '')), 60);
    v_token   text  := left(trim(coalesce(p_voter_token, '')), 128);
    nuevo     bigint;
    v_id_ant  bigint;
    v_pts_ant int;
    v_pts_new int;
    v_ronda   int;
    v_headers json;
    v_ip      text;
    v_ip_hash text;
begin
    -- ── Validaciones básicas ─────────────────────────────────────────
    select * into ses from din_sesiones where portal = p_portal and tipo = p_tipo;
    if not found or not coalesce(ses.activo, false) then
        raise exception 'Esta dinámica no está activa';
    end if;
    if ses.inicio is not null and now() < ses.inicio then
        raise exception 'El registro aún no está abierto';
    end if;
    if ses.deadline is not null and now() > ses.deadline then
        raise exception 'El tiempo de registro cerró';
    end if;
    if v_nom = '' then
        raise exception 'El nombre es requerido';
    end if;
    if v_nom ~* '(puta|puto|culero|pendejo|chingad|mierda|coño|verga|cabron|mamada|pinche|carajo|joder|cojones|ojete|perra|marica|maricon|joto|hdp|imbecil|putazo|malparido)' then
        raise exception 'El nombre contiene palabras no permitidas';
    end if;
    if (select count(*) from din_entradas where portal = p_portal and tipo = p_tipo) >= 5000 then
        raise exception 'Se alcanzó el límite de registros';
    end if;

    -- ── Deduplicación server-side (solo encuesta) ────────────────────
    if p_tipo = 'encuesta' then
        -- Obtener ronda actual
        v_ronda := coalesce((ses.config->>'ronda')::int, 0);

        -- Extraer IP del request (Supabase expone los headers en el contexto)
        begin
            v_headers := current_setting('request.headers', true)::json;
            v_ip := trim(split_part(
                coalesce(
                    v_headers->>'x-forwarded-for',
                    v_headers->>'x-real-ip',
                    ''
                ), ',', 1
            ));
            v_ip_hash := case when v_ip <> '' then md5(v_ip) else null end;
        exception when others then
            v_ip_hash := null;
        end;

        -- Intentar registrar huella; falla si ya votó
        begin
            insert into din_votos_ratelimit(portal, tipo, ronda, ip_hash, voter_token)
            values (
                p_portal, p_tipo, v_ronda,
                v_ip_hash,
                case when v_token <> '' then v_token else null end
            );
        exception when unique_violation then
            raise exception 'Ya registraste tu voto en esta encuesta';
        end;
    end if;

    -- ── Lógica específica por tipo ───────────────────────────────────

    -- Juego: upsert por nombre — conservar solo la puntuación más alta
    if p_tipo = 'juego' then
        v_pts_new := coalesce((p_metadata->>'puntos')::int, 0);
        select id, (metadata->>'puntos')::int
        into v_id_ant, v_pts_ant
        from din_entradas
        where portal = p_portal and tipo = 'juego'
          and lower(nombre) = lower(v_nom)
        order by (metadata->>'puntos')::int desc nulls last
        limit 1;
        if found then
            if v_pts_new > coalesce(v_pts_ant, 0) then
                update din_entradas
                   set metadata = coalesce(p_metadata, '{}'),
                       ig       = nullif(v_ig, ''),
                       creado   = now()
                 where id = v_id_ant;
            end if;
            return json_build_object('ok', true, 'id', v_id_ant);
        end if;
    end if;

    -- Registro: no duplicar el mismo nombre
    if p_tipo = 'registro' and exists (
        select 1 from din_entradas
        where portal = p_portal and tipo = 'registro'
          and regexp_replace(lower(nombre), '[^a-z0-9]', '', 'g') =
              regexp_replace(lower(v_nom), '[^a-z0-9]', '', 'g')
    ) then
        raise exception 'Ese equipo ya está registrado';
    end if;

    insert into din_entradas (portal, tipo, nombre, numero, ig, metadata)
    values (p_portal, p_tipo, v_nom, nullif(v_num, ''), nullif(v_ig, ''),
            coalesce(p_metadata, '{}'))
    returning id into nuevo;

    return json_build_object('ok', true, 'id', nuevo);
end $$;


-- 3) LIMPIEZA AUTOMÁTICA (ejecutar periódicamente o manual) -----------

create or replace function public.din_limpiar_ratelimit()
returns void language sql security definer set search_path = public as $$
    delete from din_votos_ratelimit where creado < now() - interval '8 days';
$$;


-- 4) GRANTS -----------------------------------------------------------

grant execute on function public.din_registrar(text, text, text, text, text, jsonb, text) to anon, authenticated;
grant execute on function public.din_limpiar_ratelimit() to authenticated;

-- Revocar el grant de la firma anterior si existe
do $$ begin
    revoke execute on function public.din_registrar(text, text, text, text, text, jsonb) from anon, authenticated;
exception when undefined_function then null;
end $$;
