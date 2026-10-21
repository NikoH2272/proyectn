-- =====================================================================
--  PUMAS GAMING · 39 · Log de votos rechazados (intentos de bot)
--  Requiere 38_din_seguridad.sql corrido primero.
--
--  Cada voto duplicado bloqueado queda registrado en din_rechazos.
--  Puedes ver cuántos intentos hubo, desde qué IPs y con qué frecuencia.
-- =====================================================================

-- 1) TABLA DE RECHAZOS ------------------------------------------------

create table if not exists public.din_rechazos (
    id           bigint generated always as identity primary key,
    portal       text        not null,
    tipo         text        not null,
    ronda        int         not null default 0,
    ip_hash      text,
    voter_token  text,
    motivo       text        not null, -- 'duplicado_ip' | 'duplicado_token' | 'otro'
    creado       timestamptz not null default now()
);

create index if not exists din_rechazos_portal on public.din_rechazos(portal, tipo, creado desc);
create index if not exists din_rechazos_ip     on public.din_rechazos(ip_hash) where ip_hash is not null;


-- 2) FUNCIÓN ACTUALIZADA: din_registrar con log de rechazos -----------

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
    v_motivo  text;
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
        v_ronda := coalesce((ses.config->>'ronda')::int, 0);

        -- Extraer IP del request
        begin
            v_headers := current_setting('request.headers', true)::json;
            v_ip := trim(split_part(
                coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''),
                ',', 1
            ));
            v_ip_hash := case when v_ip <> '' then md5(v_ip) else null end;
        exception when others then
            v_ip_hash := null;
        end;

        -- Detectar qué restricción se viola antes de intentar el insert
        if v_ip_hash is not null and exists (
            select 1 from din_votos_ratelimit
            where portal = p_portal and tipo = p_tipo and ronda = v_ronda and ip_hash = v_ip_hash
        ) then
            v_motivo := 'duplicado_ip';
        elsif v_token <> '' and exists (
            select 1 from din_votos_ratelimit
            where portal = p_portal and tipo = p_tipo and ronda = v_ronda and voter_token = v_token
        ) then
            v_motivo := 'duplicado_token';
        end if;

        if v_motivo is not null then
            -- Registrar el intento rechazado (sin bloquear si falla el insert del log)
            begin
                insert into din_rechazos(portal, tipo, ronda, ip_hash, voter_token, motivo)
                values (p_portal, p_tipo, v_ronda, v_ip_hash,
                        case when v_token <> '' then v_token else null end,
                        v_motivo);
            exception when others then null; end;
            raise exception 'Ya registraste tu voto en esta encuesta';
        end if;

        -- Registrar voto válido en rate limit
        begin
            insert into din_votos_ratelimit(portal, tipo, ronda, ip_hash, voter_token)
            values (p_portal, p_tipo, v_ronda, v_ip_hash,
                    case when v_token <> '' then v_token else null end);
        exception when unique_violation then
            begin
                insert into din_rechazos(portal, tipo, ronda, ip_hash, voter_token, motivo)
                values (p_portal, p_tipo, v_ronda, v_ip_hash,
                        case when v_token <> '' then v_token else null end, 'otro');
            exception when others then null; end;
            raise exception 'Ya registraste tu voto en esta encuesta';
        end;
    end if;

    -- ── Juego: upsert por nombre ─────────────────────────────────────
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
                   set metadata = coalesce(p_metadata, '{}'), ig = nullif(v_ig, ''), creado = now()
                 where id = v_id_ant;
            end if;
            return json_build_object('ok', true, 'id', v_id_ant);
        end if;
    end if;

    -- ── Registro: no duplicar nombre ─────────────────────────────────
    if p_tipo = 'registro' and exists (
        select 1 from din_entradas
        where portal = p_portal and tipo = 'registro'
          and regexp_replace(lower(nombre), '[^a-z0-9]', '', 'g') =
              regexp_replace(lower(v_nom), '[^a-z0-9]', '', 'g')
    ) then
        raise exception 'Ese equipo ya está registrado';
    end if;

    insert into din_entradas (portal, tipo, nombre, numero, ig, metadata)
    values (p_portal, p_tipo, v_nom, nullif(v_num, ''), nullif(v_ig, ''), coalesce(p_metadata, '{}'))
    returning id into nuevo;

    return json_build_object('ok', true, 'id', nuevo);
end $$;


-- 3) GRANTS -----------------------------------------------------------

grant execute on function public.din_registrar(text, text, text, text, text, jsonb, text) to anon, authenticated;
