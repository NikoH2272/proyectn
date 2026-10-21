-- =====================================================================
--  PUMAS GAMING · 41 · Multi-encuesta por portal
--  Permite múltiples encuestas activas a la vez en el mismo portal.
--
--  Tablas nuevas: din_encuestas, din_encuesta_votos
--  Funciones:
--    Público : din_enc_publico, din_enc_votar
--    Admin   : din_enc_admin_listar, din_enc_admin_crear,
--              din_enc_admin_editar, din_enc_admin_restablecer,
--              din_enc_admin_borrar
-- =====================================================================


-- 1) TABLAS -----------------------------------------------------------

create table if not exists public.din_encuestas (
    id          bigint generated always as identity primary key,
    portal      text        not null references public.portales(id) on delete cascade,
    titulo      text,
    pregunta    text,
    opciones    jsonb       not null default '[]',
    imagen      text,
    deadline    timestamptz,
    activo      boolean     not null default false,
    ronda       int         not null default 0,
    creado      timestamptz not null default now(),
    actualizado timestamptz not null default now()
);

create index if not exists din_enc_portal_activo on public.din_encuestas(portal, activo);


create table if not exists public.din_encuesta_votos (
    id           bigint generated always as identity primary key,
    encuesta_id  bigint      not null references public.din_encuestas(id) on delete cascade,
    ronda        int         not null default 0,
    nombre       text        not null,
    opcion_idx   int         not null,
    ip_hash      text,
    voter_token  text,
    creado       timestamptz not null default now()
);

-- Un voto por navegador (voter_token) por ronda
create unique index if not exists din_ev_token
    on public.din_encuesta_votos(encuesta_id, ronda, voter_token)
    where voter_token is not null;

-- Un voto por IP por ronda
create unique index if not exists din_ev_ip
    on public.din_encuesta_votos(encuesta_id, ronda, ip_hash)
    where ip_hash is not null;

create index if not exists din_ev_enc_ronda on public.din_encuesta_votos(encuesta_id, ronda);


-- 2) FUNCIÓN PÚBLICA: listar encuestas activas con resultados ---------

create or replace function public.din_enc_publico(p_portal text)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    return coalesce((
        select json_agg(
            json_build_object(
                'id',       e.id,
                'titulo',   e.titulo,
                'pregunta', e.pregunta,
                'opciones', e.opciones,
                'imagen',   e.imagen,
                'deadline', e.deadline,
                'cerrado',  e.deadline is not null and now() > e.deadline,
                'ronda',    e.ronda,
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


-- 3) FUNCIÓN PÚBLICA: votar -------------------------------------------

create or replace function public.din_enc_votar(
    p_encuesta_id    bigint,
    p_nombre         text,
    p_opcion_idx     int,
    p_voter_token    text    default null,
    p_recaptcha_token text   default null
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    enc           din_encuestas;
    v_nom         text  := left(trim(coalesce(p_nombre, '')), 80);
    v_token       text  := left(trim(coalesce(p_voter_token, '')), 128);
    v_headers     json;
    v_ip          text;
    v_ip_hash     text;
    v_rc_secret   text;
    v_rc_resp     json;
    v_rc_ok       boolean;
    v_n_opciones  int;
begin
    -- Validaciones básicas
    select * into enc from din_encuestas where id = p_encuesta_id;
    if not found then raise exception 'Encuesta no encontrada'; end if;
    if not coalesce(enc.activo, false) then raise exception 'Esta encuesta no está activa'; end if;
    if enc.deadline is not null and now() > enc.deadline then raise exception 'La encuesta ya cerró'; end if;
    if v_nom = '' then raise exception 'El nombre es requerido'; end if;

    -- Validar índice de opción
    v_n_opciones := jsonb_array_length(enc.opciones);
    if p_opcion_idx < 0 or p_opcion_idx >= v_n_opciones then
        raise exception 'Opción inválida';
    end if;

    -- Verificación reCAPTCHA
    begin
        select decrypted_secret into v_rc_secret
        from vault.decrypted_secrets where name = 'recaptcha_secret' limit 1;
    exception when others then v_rc_secret := null; end;

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
        exception when others then v_rc_ok := true; end;
        if not v_rc_ok then raise exception 'Verificación reCAPTCHA fallida'; end if;
    end if;

    -- Extraer IP
    begin
        v_headers := current_setting('request.headers', true)::json;
        v_ip := trim(split_part(
            coalesce(v_headers->>'x-forwarded-for', v_headers->>'x-real-ip', ''), ',', 1
        ));
        v_ip_hash := case when v_ip <> '' then md5(v_ip) else null end;
    exception when others then v_ip_hash := null; end;

    -- Insertar voto (los índices únicos bloquean duplicados)
    begin
        insert into din_encuesta_votos(encuesta_id, ronda, nombre, opcion_idx, ip_hash, voter_token)
        values (
            p_encuesta_id, enc.ronda, v_nom, p_opcion_idx,
            v_ip_hash,
            case when v_token <> '' then v_token else null end
        );
    exception when unique_violation then
        raise exception 'Ya registraste tu voto en esta encuesta';
    end;

    return json_build_object('ok', true);
end $$;


-- 4) FUNCIÓN ADMIN: listar todas las encuestas del portal --------------

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
                'id',       e.id,
                'titulo',   e.titulo,
                'pregunta', e.pregunta,
                'opciones', e.opciones,
                'imagen',   e.imagen,
                'deadline', e.deadline,
                'activo',   e.activo,
                'ronda',    e.ronda,
                'cerrado',  e.deadline is not null and now() > e.deadline,
                'creado',   e.creado,
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


-- 5) FUNCIÓN ADMIN: crear encuesta ------------------------------------

create or replace function public.din_enc_admin_crear(
    p_token    uuid,
    p_portal   text,
    p_titulo   text        default null,
    p_pregunta text        default null,
    p_opciones jsonb       default '[]',
    p_imagen   text        default null,
    p_deadline timestamptz default null,
    p_activo   boolean     default false
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
    insert into din_encuestas(portal, titulo, pregunta, opciones, imagen, deadline, activo)
    values (p_portal, nullif(trim(coalesce(p_titulo,'')),'' ), nullif(trim(coalesce(p_pregunta,'')),'' ),
            p_opciones, nullif(trim(coalesce(p_imagen,'')),'' ), p_deadline, coalesce(p_activo, false))
    returning id into nuevo;
    return json_build_object('ok', true, 'id', nuevo);
end $$;


-- 6) FUNCIÓN ADMIN: editar encuesta -----------------------------------

create or replace function public.din_enc_admin_editar(
    p_token          uuid,
    p_id             bigint,
    p_titulo         text        default null,
    p_pregunta       text        default null,
    p_opciones       jsonb       default null,
    p_imagen         text        default null,
    p_deadline       timestamptz default null,
    p_activo         boolean     default null,
    p_quitar_deadline boolean    default false
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
        titulo      = case when p_titulo    is not null then nullif(trim(p_titulo),'')    else titulo    end,
        pregunta    = case when p_pregunta  is not null then nullif(trim(p_pregunta),'')  else pregunta  end,
        opciones    = coalesce(p_opciones, opciones),
        imagen      = case when p_imagen    is not null then nullif(trim(p_imagen),'')    else imagen    end,
        deadline    = case when coalesce(p_quitar_deadline,false) then null
                           when p_deadline is not null then p_deadline
                           else deadline end,
        activo      = coalesce(p_activo, activo),
        actualizado = now()
    where id = p_id;

    return json_build_object('ok', true);
end $$;


-- 7) FUNCIÓN ADMIN: restablecer votos (nueva ronda) -------------------

create or replace function public.din_enc_admin_restablecer(p_token uuid, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
declare enc din_encuestas;
begin
    select * into enc from din_encuestas where id = p_id;
    if not found then raise exception 'Encuesta no encontrada'; end if;
    perform _exigir_permiso(p_token, 'portal:' || enc.portal);

    delete from din_encuesta_votos where encuesta_id = p_id and ronda = enc.ronda;
    update din_encuestas set ronda = ronda + 1, actualizado = now() where id = p_id;

    return json_build_object('ok', true);
end $$;


-- 8) FUNCIÓN ADMIN: borrar encuesta -----------------------------------

create or replace function public.din_enc_admin_borrar(p_token uuid, p_id bigint)
returns json
language plpgsql security definer
set search_path = public
as $$
declare enc din_encuestas;
begin
    select * into enc from din_encuestas where id = p_id;
    if not found then raise exception 'Encuesta no encontrada'; end if;
    perform _exigir_permiso(p_token, 'portal:' || enc.portal);
    delete from din_encuestas where id = p_id;
    return json_build_object('ok', true);
end $$;


-- 9) GRANTS -----------------------------------------------------------

grant execute on function public.din_enc_publico(text)                                              to anon, authenticated;
grant execute on function public.din_enc_votar(bigint, text, int, text, text)                       to anon, authenticated;
grant execute on function public.din_enc_admin_listar(uuid, text)                                   to anon, authenticated;
grant execute on function public.din_enc_admin_crear(uuid, text, text, text, jsonb, text, timestamptz, boolean) to anon, authenticated;
grant execute on function public.din_enc_admin_editar(uuid, bigint, text, text, jsonb, text, timestamptz, boolean, boolean) to anon, authenticated;
grant execute on function public.din_enc_admin_restablecer(uuid, bigint)                            to anon, authenticated;
grant execute on function public.din_enc_admin_borrar(uuid, bigint)                                 to anon, authenticated;
