-- =====================================================================
--  PUMAS GAMING · 22 · Registro VIP solo con código de acceso
--  Requiere 19. Se puede correr las veces que quieras.
--
--  · El admin de Pumas genera códigos (panel → Registrar VIP → Códigos).
--    Cada código tiene usos máximos (por defecto 1) y vencimiento.
--  · /entrenamientos/vip.html pide el código antes de mostrar el formulario,
--    y la base lo vuelve a revisar al registrar (sin código no se puede).
--  · La función vieja sin código (sql/19) se BORRA para que no se pueda
--    saltar el código.
-- =====================================================================

create table if not exists public.vip_codigos (
    codigo     text primary key,
    usos_max   int  not null default 1 check (usos_max between 1 and 100),
    usos       int  not null default 0,
    vence      timestamptz not null default now() + interval '7 days',
    activo     boolean not null default true,
    nota       text,
    creado_por text,
    creado     timestamptz not null default now()
);
alter table public.vip_registros add column if not exists codigo text;
alter table public.vip_codigos enable row level security;   -- sin políticas: privado

-- Sin código ya no se puede registrar
drop function if exists public.vip_registrar(text, text, text, text[]);

create or replace function public._vip_codigo_ok(p_codigo text)
returns boolean language sql stable
set search_path = public
as $$
    select exists (select 1 from vip_codigos
                    where codigo = upper(trim(coalesce(p_codigo, '')))
                      and activo and usos < usos_max and vence > now());
$$;
revoke execute on function public._vip_codigo_ok(text) from public, anon, authenticated;

-- Público: ¿el código sirve? (para mostrar el formulario)
create or replace function public.vip_validar_codigo(p_codigo text)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform pg_sleep(0.4);   -- frena a quien intente adivinar códigos
    return json_build_object('ok', _vip_codigo_ok(p_codigo));
end $$;

-- Público: registrarse con código
create or replace function public.vip_registrar(p_codigo text, p_nombre text, p_tag text, p_telefono text, p_horarios text[])
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    v_cod text := upper(trim(coalesce(p_codigo, '')));
    v_nom text := upper(left(trim(coalesce(p_nombre, '')), 60));
    v_tag text := upper(left(trim(coalesce(p_tag, '')), 10));
    v_hor text[];
begin
    perform pg_sleep(0.4);
    -- se bloquea la fila del código para que dos personas no gasten el último uso a la vez
    perform 1 from vip_codigos where codigo = v_cod for update;
    if not _vip_codigo_ok(v_cod) then
        raise exception 'El código no es válido, ya se usó o venció. Pide uno nuevo al staff de Pumas.';
    end if;
    if v_nom = '' or v_tag = '' or length(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g')) < 7 then
        raise exception 'Completa nombre del equipo, tag y un número válido del representante';
    end if;
    select array_agg(distinct h order by h) into v_hor
      from unnest(coalesce(p_horarios, '{}')) h where h in ('10AM', '1PM', '4PM', '6PM', '8PM');
    if v_hor is null then raise exception 'Elige al menos un horario'; end if;
    if exists (select 1 from vip_registros where estado <> 'RECHAZADO'
                and regexp_replace(lower(nombre), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v_nom), '[^a-z0-9]', '', 'g')) then
        raise exception 'Ese equipo ya tiene un registro VIP';
    end if;
    insert into vip_registros (nombre, tag, telefono, horarios, codigo)
    values (v_nom, v_tag, left(trim(p_telefono), 30), v_hor, v_cod);
    update vip_codigos set usos = usos + 1 where codigo = v_cod;
    return json_build_object('ok', true);
end $$;

-- Admin de Pumas: generar, listar y desactivar códigos
create or replace function public.admin_vip_codigo_crear(p_token uuid, p_usos int, p_dias int, p_nota text)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    quien text := _exigir_permiso(p_token, 'portal:entrenamientos')->>'usuario';
    v_cod text;
    letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- sin 0/O ni 1/I para no confundir
    i int;
begin
    if (select count(*) from vip_codigos where creado > now() - interval '1 day') >= 200 then
        raise exception 'Demasiados códigos hoy';
    end if;
    loop
        v_cod := 'VIP-';
        for i in 1..6 loop
            v_cod := v_cod || substr(letras, 1 + floor(random() * length(letras))::int, 1);
        end loop;
        exit when not exists (select 1 from vip_codigos where codigo = v_cod);
    end loop;
    insert into vip_codigos (codigo, usos_max, vence, nota, creado_por)
    values (v_cod, least(greatest(coalesce(p_usos, 1), 1), 100),
            now() + make_interval(days => least(greatest(coalesce(p_dias, 7), 1), 60)),
            left(nullif(trim(p_nota), ''), 80), quien);
    return json_build_object('ok', true, 'codigo', v_cod);
end $$;

create or replace function public.admin_vip_codigos(p_token uuid)
returns json
language plpgsql security definer stable
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:entrenamientos');
    return (select coalesce(json_agg(to_json(c) order by c.creado desc), '[]'::json)
              from (select * from vip_codigos order by creado desc limit 100) c);
end $$;

create or replace function public.admin_vip_codigo_desactivar(p_token uuid, p_codigo text)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:entrenamientos');
    update vip_codigos set activo = false where codigo = upper(trim(p_codigo));
    return json_build_object('ok', true);
end $$;

grant execute on function public.vip_validar_codigo(text)                          to anon, authenticated;
grant execute on function public.vip_registrar(text, text, text, text, text[])     to anon, authenticated;
grant execute on function public.admin_vip_codigo_crear(uuid, int, int, text)      to anon, authenticated;
grant execute on function public.admin_vip_codigos(uuid)                           to anon, authenticated;
grant execute on function public.admin_vip_codigo_desactivar(uuid, text)           to anon, authenticated;
