-- =====================================================================
--  PUMAS GAMING · 42 · Límite de jugadores en registro + N ganadores en encuestas
--
--  Cambios:
--    · din_encuestas.n_ganadores  — cuántos ganadores destacar (default 1)
--    · din_registrar              — respeta config.limite del portal en lugar de 5000 fijo
--    · funciones actualizadas: din_enc_publico, din_enc_admin_listar,
--      din_enc_admin_crear, din_enc_admin_editar
-- =====================================================================


-- 1) NUEVA COLUMNA n_ganadores ----------------------------------------

alter table public.din_encuestas
    add column if not exists n_ganadores int not null default 1;


-- 2) din_enc_publico — incluye n_ganadores ----------------------------

create or replace function public.din_enc_publico(p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    return coalesce((
        select json_agg(
            json_build_object(
                'id',          e.id,
                'titulo',      e.titulo,
                'pregunta',    e.pregunta,
                'opciones',    e.opciones,
                'imagen',      e.imagen,
                'deadline',    e.deadline,
                'cerrado',     e.deadline is not null and now() > e.deadline,
                'ronda',       e.ronda,
                'n_ganadores', e.n_ganadores,
                'votos', (
                    select coalesce(json_object_agg(v.opcion_idx::text, v.total), '{}')
                    from (
                        select opcion_idx, count(*) as total
                        from din_encuesta_votos
                        where encuesta_id = e.id and ronda = e.ronda
                        group by opcion_idx
                    ) v
                )
            )
            order by e.creado
        )
        from din_encuestas e
        where e.portal = p_portal and e.activo = true
    ), '[]'::json);
end $$;


-- 3) din_enc_admin_listar — incluye n_ganadores -----------------------

create or replace function public.din_enc_admin_listar(p_token uuid, p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return coalesce((
        select json_agg(
            json_build_object(
                'id',          e.id,
                'titulo',      e.titulo,
                'pregunta',    e.pregunta,
                'opciones',    e.opciones,
                'imagen',      e.imagen,
                'deadline',    e.deadline,
                'activo',      e.activo,
                'ronda',       e.ronda,
                'n_ganadores', e.n_ganadores,
                'cerrado',     e.deadline is not null and now() > e.deadline,
                'creado',      e.creado,
                'votos', (
                    select coalesce(json_object_agg(v.opcion_idx::text, v.total), '{}')
                    from (
                        select opcion_idx, count(*) as total
                        from din_encuesta_votos
                        where encuesta_id = e.id and ronda = e.ronda
                        group by opcion_idx
                    ) v
                ),
                'total_votos', (
                    select count(*) from din_encuesta_votos
                    where encuesta_id = e.id and ronda = e.ronda
                )
            )
            order by e.creado desc
        )
        from din_encuestas e
        where e.portal = p_portal
    ), '[]'::json);
end $$;


-- 4) din_enc_admin_crear — acepta n_ganadores -------------------------

create or replace function public.din_enc_admin_crear(
    p_token       uuid,
    p_portal      text,
    p_titulo      text        default null,
    p_pregunta    text        default null,
    p_opciones    jsonb       default '[]',
    p_imagen      text        default null,
    p_deadline    timestamptz default null,
    p_activo      boolean     default false,
    p_n_ganadores int         default 1
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare nuevo bigint;
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if jsonb_array_length(coalesce(p_opciones, '[]')) < 2 then
        raise exception 'Se necesitan al menos 2 opciones';
    end if;
    insert into din_encuestas(portal, titulo, pregunta, opciones, imagen, deadline, activo, n_ganadores)
    values (
        p_portal,
        nullif(trim(coalesce(p_titulo,'')),'' ),
        nullif(trim(coalesce(p_pregunta,'')),'' ),
        p_opciones,
        nullif(trim(coalesce(p_imagen,'')),'' ),
        p_deadline,
        coalesce(p_activo, false),
        greatest(1, coalesce(p_n_ganadores, 1))
    )
    returning id into nuevo;
    return json_build_object('ok', true, 'id', nuevo);
end $$;


-- 5) din_enc_admin_editar — acepta n_ganadores -------------------------

create or replace function public.din_enc_admin_editar(
    p_token           uuid,
    p_id              bigint,
    p_titulo          text        default null,
    p_pregunta        text        default null,
    p_opciones        jsonb       default null,
    p_imagen          text        default null,
    p_deadline        timestamptz default null,
    p_activo          boolean     default null,
    p_quitar_deadline boolean     default false,
    p_n_ganadores     int         default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare enc din_encuestas;
begin
    select * into enc from din_encuestas where id = p_id;
    if not found then raise exception 'Encuesta no encontrada'; end if;
    perform _exigir_permiso(p_token, 'portal:' || enc.portal);

    update din_encuestas set
        titulo       = case when p_titulo    is not null then nullif(trim(p_titulo),'')    else titulo    end,
        pregunta     = case when p_pregunta  is not null then nullif(trim(p_pregunta),'')  else pregunta  end,
        opciones     = coalesce(p_opciones, opciones),
        imagen       = case when p_imagen    is not null then nullif(trim(p_imagen),'')    else imagen    end,
        deadline     = case when coalesce(p_quitar_deadline,false) then null
                            when p_deadline is not null then p_deadline
                            else deadline end,
        activo       = coalesce(p_activo, activo),
        n_ganadores  = case when p_n_ganadores is not null then greatest(1, p_n_ganadores) else n_ganadores end,
        actualizado  = now()
    where id = p_id;

    return json_build_object('ok', true);
end $$;


-- 6) din_registrar — límite configurable desde din_sesiones.config ----
--    Usa config->>'limite' si existe, si no el hardcoded 5000.

create or replace function public.din_registrar(
    p_portal           text,
    p_tipo             text,
    p_nombre           text,
    p_numero           text    default null,
    p_ig               text    default null,
    p_metadata         jsonb   default '{}',
    p_voter_token      text    default null,
    p_recaptcha_token  text    default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses           din_sesiones;
    v_nom         text  := left(trim(coalesce(p_nombre, '')), 80);
    v_num         text  := left(trim(coalesce(p_numero, '')), 20);
    v_ig          text  := left(trim(replace(coalesce(p_ig, ''), '@', '')), 60);
    v_token       text  := left(trim(coalesce(p_voter_token, '')), 128);
    nuevo         bigint;
    v_id_ant      bigint;
    v_pts_ant     int;
    v_pts_new     int;
    v_ronda       int;
    v_headers     json;
    v_ip          text;
    v_ip_hash     text;
    v_motivo      text;
    v_rc_secret   text;
    v_rc_resp     json;
    v_rc_ok       boolean;
    v_limite      int;
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

    -- Límite configurable: config->>'limite' o 5000 por defecto
    v_limite := coalesce(nullif((ses.config->>'limite')::text, '')::int, 5000);
    if (select count(*) from din_entradas where portal = p_portal and tipo = p_tipo) >= v_limite then
        raise exception 'Se alcanzó el límite de registros (% equipos)', v_limite;
    end if;

    -- ── Verificación reCAPTCHA (solo encuesta) ───────────────────────
    if p_tipo = 'encuesta' then
        begin
            select decrypted_secret into v_rc_secret
            from vault.decrypted_secrets
            where name = 'recaptcha_secret'
            limit 1;
        exception when others then
            v_rc_secret := null;
        end;

        if v_rc_secret is not null and v_rc_secret <> '' then
            if coalesce(p_recaptcha_token, '') = '' then
                raise exception 'Se requiere verificación reCAPTCHA';
            end if;

            begin
                select content::json into v_rc_resp
                from http_post(
                    'https://www.google.com/recaptcha/api/siteverify',
                    'secret=' || v_rc_secret || '&response=' || p_recaptcha_token,
                    'application/x-www-form-urlencoded'
                );
                v_rc_ok := coalesce((v_rc_resp->>'success')::boolean, false);
            exception when others then
                v_rc_ok := true;
            end;

            if not v_rc_ok then
                raise exception 'Verificación reCAPTCHA fallida';
            end if;
        end if;
    end if;

    -- ── Deduplicación server-side (solo encuesta) ────────────────────
    if p_tipo = 'encuesta' then
        v_ronda := coalesce((ses.config->>'ronda')::int, 0);

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
            begin
                insert into din_rechazos(portal, tipo, ronda, ip_hash, voter_token, motivo)
                values (p_portal, p_tipo, v_ronda, v_ip_hash,
                        case when v_token <> '' then v_token else null end,
                        v_motivo);
            exception when others then null; end;
            raise exception 'Ya registraste tu voto en esta encuesta';
        end if;

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


-- 7) GRANTS -----------------------------------------------------------

grant execute on function public.din_enc_publico(text)                                                                           to anon, authenticated;
grant execute on function public.din_enc_admin_listar(uuid, text)                                                                to anon, authenticated;
grant execute on function public.din_enc_admin_crear(uuid, text, text, text, jsonb, text, timestamptz, boolean, int)             to anon, authenticated;
grant execute on function public.din_enc_admin_editar(uuid, bigint, text, text, jsonb, text, timestamptz, boolean, boolean, int) to anon, authenticated;
grant execute on function public.din_registrar(text, text, text, text, text, jsonb, text, text)                                  to anon, authenticated;

-- Revocar firma anterior de enc_admin_crear/editar sin n_ganadores
do $$ begin
    revoke execute on function public.din_enc_admin_crear(uuid, text, text, text, jsonb, text, timestamptz, boolean) from anon, authenticated;
exception when undefined_function then null; end $$;

do $$ begin
    revoke execute on function public.din_enc_admin_editar(uuid, bigint, text, text, jsonb, text, timestamptz, boolean, boolean) from anon, authenticated;
exception when undefined_function then null; end $$;
