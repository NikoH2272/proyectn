-- 50_portal_features.sql
-- Toggles por portal: resultados completos y caídas publicados en el portal público.
-- Corre este archivo UNA VEZ en Supabase después de sql/49_ascensos_pasarela.sql.

-- 1) Columnas en portal_config --------------------------------------------------
--    Si ya existen no hace nada (idempotente).
alter table public.portal_config
    add column if not exists pub_completos boolean not null default false,
    add column if not exists pub_caidas    boolean not null default false;

-- Asegura que cada portal de ascensos tenga una fila en portal_config
insert into public.portal_config (portal)
    select id from public.portales
    where id in ('rusheo','ascensosaza','ascensosqfd','zmf','zmffem','dragonfest','dragonfestfem','row')
on conflict (portal) do nothing;


-- 2) Función PÚBLICA: leer config de features de un portal ----------------------
create or replace function public.portal_features(p_portal text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
    select jsonb_build_object(
        'pub_completos', coalesce(pub_completos, false),
        'pub_caidas',    coalesce(pub_caidas, false)
    )
    from portal_config
    where portal = p_portal;
$$;
grant execute on function public.portal_features(text) to anon, authenticated;


-- 3) Función ADMIN: actualizar features (requiere token + permiso gestionar) ----
create or replace function public.admin_portal_features(
    p_token      uuid,
    p_portal     text,
    p_completos  boolean,
    p_caidas     boolean
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'gestionar');

    -- Upsert: crea la fila si no existía
    insert into portal_config (portal, pub_completos, pub_caidas)
    values (p_portal, p_completos, p_caidas)
    on conflict (portal) do update set
        pub_completos = excluded.pub_completos,
        pub_caidas    = excluded.pub_caidas,
        actualizado   = now(),
        actualizado_por = (select usuario from admin_sesiones where token = p_token limit 1);

    return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_portal_features(uuid, text, boolean, boolean) to anon, authenticated;


-- Revisión
select portal, pub_completos, pub_caidas
  from public.portal_config
 where portal not in ('global')
 order by portal;
