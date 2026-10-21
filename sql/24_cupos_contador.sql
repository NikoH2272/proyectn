-- =====================================================================
--  PUMAS GAMING · 24 · Cupos: contador para abrir y cada portal con lo suyo
--  Requiere 17 y 20. Se puede correr las veces que quieras.
--
--  · cupos_publicos ahora también devuelve los cupos PROGRAMADOS (que se
--    abren más tarde, hasta 7 días antes) con su hora de apertura, para que
--    la página muestre el contador "se abre en...". Inscribirse sigue sin
--    poderse hasta esa hora (lo revisa cupo_inscribir).
--  · cupo_inscribir_portal: igual que cupo_inscribir pero exige que el cupo
--    sea del portal de la página. Así un portal nunca inscribe en cupos de otro.
-- =====================================================================

create or replace function public.cupos_publicos(p_portal text)
returns json
language sql security definer stable
set search_path = public
as $$
    select coalesce(json_agg(json_build_object(
               'id', g.id, 'portal', g.portal, 'titulo', g.titulo, 'fecha', g.fecha, 'cupos', g.cupos_totales,
               'abre_en', g.publicar_en,
               'pendiente', g.publicar_en is not null and g.publicar_en > now(),
               'inscritos', (select coalesce(json_agg(json_build_object('equipo', c.nombre_equipo, 'staff', c.telefono = 'REGISTRO STAFF') order by c.creado), '[]'::json)
                               from portal_cupos c where c.programado_id = g.id)) order by coalesce(g.publicar_en, g.fecha), g.fecha), '[]'::json)
      from portal_programados g
     where g.portal = p_portal and g.estado = 'ABIERTO'
       and (g.publicar_en is null or g.publicar_en <= now() + interval '7 days')
       and g.fecha > now() - interval '6 hours';
$$;

create or replace function public.cupo_inscribir_portal(p_portal text, p_programado bigint, p_equipo text, p_telefono text)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    if not exists (select 1 from portal_programados where id = p_programado and portal = p_portal) then
        raise exception 'Ese cupo no es de este portal';
    end if;
    return cupo_inscribir(p_programado, p_equipo, p_telefono);
end $$;

grant execute on function public.cupos_publicos(text) to anon, authenticated;
grant execute on function public.cupo_inscribir_portal(text, bigint, text, text) to anon, authenticated;
