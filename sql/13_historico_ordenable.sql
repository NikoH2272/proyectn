-- =====================================================================
--  PUMAS GAMING · 13 · Histórico Top 100 ordenable por PR o PG
--  Requiere 12. Se puede correr las veces que quieras.
--    p_orden = 'pr' → PR (PG ÷ sesiones) → booyah → PG   (como siempre)
--    p_orden = 'pg' → PG (puntos totales) → PR → booyah
--  p_portal = null → todos los entrenos LATAM · 'row', 'zmf', ... → uno solo
-- =====================================================================

create or replace function public.latam_historico(p_portal text default null, p_orden text default 'pr', p_limite int default 100)
returns jsonb
language sql stable
set search_path = public
as $$
    select coalesce(jsonb_agg(to_jsonb(t) - 'puesto' order by t.puesto), '[]') from (
        select q.*, row_number() over (
                   order by case when p_orden = 'pg' then q.pts else q.pr end desc,
                            case when p_orden = 'pg' then q.pr  else q.b  end desc,
                            case when p_orden = 'pg' then q.b   else q.pts end desc,
                            q.equipo) as puesto
          from _latam_equipos(p_portal, null, null) q
    ) t
    where t.puesto <= least(greatest(coalesce(p_limite, 100), 1), 200);
$$;

grant execute on function public.latam_historico(text, text, int) to anon, authenticated;

-- Prueba: top 5 por PG de todos los entrenos
select latam_historico(null, 'pg', 5);
