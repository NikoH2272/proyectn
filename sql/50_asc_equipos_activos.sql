-- sql/50_asc_equipos_activos.sql
-- Gestión de qué categorías/equipos están activos en el inicio de cada portal de ascensos.
-- Usa sitio_config con clave 'asc_equipos_<portal>' → ["ev_cacm","ev_lyon",...]

-- ① Crear sitio_config si no existe (normalmente ya existe)
create table if not exists public.sitio_config (
    clave text primary key,
    valor jsonb not null default '{}'::jsonb,
    actualizado timestamptz default now()
);

-- ② Función pública: retorna lista de IDs de categorías activas para ese portal
create or replace function public.asc_equipos_activos(p_portal text)
returns jsonb language sql security definer stable set search_path = public as $$
    select coalesce(valor, '[]'::jsonb)
    from public.sitio_config
    where clave = 'asc_equipos_' || p_portal;
$$;

-- ③ Función admin: guarda la lista (requiere permiso 'gestionar')
create or replace function public.admin_asc_equipos_guardar(
    p_token  uuid,
    p_portal text,
    p_activos jsonb   -- array de ids, ej: ["ev_cacm","ev_lyon"]
) returns void language plpgsql security definer set search_path = public as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');
    insert into public.sitio_config (clave, valor, actualizado)
    values ('asc_equipos_' || p_portal, p_activos, now())
    on conflict (clave) do update
        set valor = excluded.valor,
            actualizado = now();
end;
$$;

-- ④ Grants
grant execute on function public.asc_equipos_activos(text) to anon, authenticated;
grant execute on function public.admin_asc_equipos_guardar(uuid, text, jsonb) to authenticated;
