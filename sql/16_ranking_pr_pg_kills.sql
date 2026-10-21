-- =====================================================================
--  PUMAS GAMING · 16 · Rankings ordenables por PR, PG o KILLS
--  Requiere 12. Se puede correr las veces que quieras.
--    p_orden = 'pr'   → PR (PG ÷ sesiones) → booyah → PG
--    p_orden = 'pg'   → PG (puntos totales) → PR → booyah
--    p_orden = 'kill' → kills totales → PR → PG
--  p_desde / p_hasta (fechas) → Top 50 de la semana; sin fechas → histórico.
-- =====================================================================

create or replace function public.latam_ranking(
    p_portal text default null, p_orden text default 'pr',
    p_desde date default null, p_hasta date default null, p_limite int default 100
)
returns jsonb
language sql stable
set search_path = public
as $$
    select coalesce(jsonb_agg(to_jsonb(t) - 'puesto' order by t.puesto), '[]') from (
        select q.*, row_number() over (
                   order by case p_orden when 'pg' then q.pts when 'kill' then q.k else q.pr end desc,
                            case p_orden when 'pg' then q.pr  when 'kill' then q.pr else q.b end desc,
                            case p_orden when 'pg' then q.b   when 'kill' then q.pts else q.pts end desc,
                            q.equipo) as puesto
          from _latam_equipos(p_portal, p_desde, p_hasta) q
    ) t
    where t.puesto <= least(greatest(coalesce(p_limite, 100), 1), 200);
$$;

-- El histórico del 13 ahora también entiende 'kill'
create or replace function public.latam_historico(p_portal text default null, p_orden text default 'pr', p_limite int default 100)
returns jsonb
language sql stable
set search_path = public
as $$
    select latam_ranking(p_portal, p_orden, null, null, p_limite);
$$;

grant execute on function public.latam_ranking(text, text, date, date, int) to anon, authenticated;
grant execute on function public.latam_historico(text, text, int)          to anon, authenticated;

-- Prueba: top 5 por kills de todos los entrenos
select latam_ranking(null, 'kill', null, null, 5);
