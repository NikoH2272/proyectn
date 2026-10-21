-- =====================================================================
--  PUMAS GAMING · 37 · Historial de dinámicas (auditoría)
--  Guarda un snapshot de resultados cada vez que se termina o
--  restablece una encuesta/registro.
--  Requiere 33_dinamicas.sql corrido primero.
-- =====================================================================

-- 1) TABLA ------------------------------------------------------------

create table if not exists public.din_historial (
    id            bigint generated always as identity primary key,
    portal        text        not null,
    tipo          text        not null,
    titulo        text,
    config        jsonb       not null default '{}',
    resultados    jsonb       not null default '{}',
    total_votos   int         not null default 0,
    iniciado      timestamptz,
    cerrado       timestamptz not null default now(),
    ronda         int         not null default 0,
    archivado_por text
);

create index if not exists din_historial_portal on public.din_historial(portal, tipo, cerrado desc);


-- 2) FUNCIÓN ADMIN: archivar snapshot antes de vaciar ----------------

create or replace function public.din_admin_archivar(
    p_token  uuid,
    p_portal text,
    p_tipo   text
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    ses       din_sesiones;
    quien     text;
    resultados jsonb;
    total     int;
begin
    quien := (select _exigir_permiso(p_token, 'portal:' || p_portal))->>'usuario';

    select * into ses from din_sesiones where portal = p_portal and tipo = p_tipo;
    if not found then
        return json_build_object('ok', true, 'archivado', false);
    end if;

    -- Calcular resultados según tipo
    if p_tipo = 'encuesta' then
        select coalesce(
            jsonb_object_agg(opcion_idx, cnt),
            '{}'::jsonb
        ) into resultados
        from (
            select (metadata->>'opcion_idx') as opcion_idx, count(*)::int as cnt
            from din_entradas
            where portal = p_portal and tipo = p_tipo
            group by metadata->>'opcion_idx'
        ) v;
    else
        select coalesce(
            jsonb_agg(jsonb_build_object('nombre', nombre, 'numero', numero, 'ig', ig, 'creado', creado)),
            '[]'::jsonb
        ) into resultados
        from din_entradas
        where portal = p_portal and tipo = p_tipo
        order by creado;
    end if;

    select count(*) into total from din_entradas where portal = p_portal and tipo = p_tipo;

    -- Solo archivar si hay datos
    if total = 0 then
        return json_build_object('ok', true, 'archivado', false);
    end if;

    insert into din_historial (portal, tipo, titulo, config, resultados, total_votos, iniciado, ronda, archivado_por)
    values (
        p_portal, p_tipo,
        ses.titulo,
        ses.config,
        coalesce(resultados, '{}'::jsonb),
        total,
        ses.inicio,
        coalesce((ses.config->>'ronda')::int, 0),
        quien
    );

    return json_build_object('ok', true, 'archivado', true, 'total', total);
end $$;


-- 3) FUNCIÓN ADMIN: leer historial ------------------------------------

create or replace function public.din_admin_historial(
    p_token  uuid,
    p_portal text,
    p_tipo   text  default null
)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    return (
        select coalesce(json_agg(row_to_json(h) order by h.cerrado desc), '[]'::json)
        from din_historial h
        where h.portal = p_portal
          and (p_tipo is null or h.tipo = p_tipo)
        limit 100
    );
end $$;


-- 4) GRANTS -----------------------------------------------------------

grant execute on function public.din_admin_archivar(uuid, text, text)         to anon, authenticated;
grant execute on function public.din_admin_historial(uuid, text, text)         to anon, authenticated;
