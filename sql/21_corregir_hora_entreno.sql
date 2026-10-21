-- =====================================================================
--  PUMAS GAMING · 21 · Corregir la fecha/hora (y la jornada) de un entreno
--  Requiere 09. Se puede correr las veces que quieras.
--  Lo usa Admin → Corregir entrenos (solo superadmin, rol con "gestionar").
--  p_jornada null → no cambia (ej. "BLOQUE A" en Dragon Fest).
-- =====================================================================
create or replace function public.admin_editar_entreno(
    p_token uuid, p_portal text, p_sesion text, p_fecha timestamptz, p_jornada text
)
returns json
language plpgsql security definer
set search_path = public
as $$
declare
    n int;
begin
    perform _exigir_permiso(p_token, 'gestionar');
    if p_fecha is null then raise exception 'Elige la fecha y hora'; end if;
    if p_fecha > now() + interval '30 days' or p_fecha < now() - interval '3 years' then
        raise exception 'Revisa la fecha: está fuera de rango';
    end if;
    if p_portal = 'entrenamientos' then
        update entrenamientos_sesiones
           set fecha = p_fecha,
               jornada = case when p_jornada is null then jornada else left(nullif(trim(p_jornada), ''), 60) end
         where id::text = p_sesion;
    else
        update portal_sesiones
           set fecha = p_fecha,
               jornada = case when p_jornada is null then jornada else left(nullif(trim(p_jornada), ''), 60) end
         where id::text = p_sesion and portal = p_portal;
    end if;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'No se encontró ese entreno en %', p_portal; end if;
    return json_build_object('ok', true);
end $$;

grant execute on function public.admin_editar_entreno(uuid, text, text, timestamptz, text) to anon, authenticated;
