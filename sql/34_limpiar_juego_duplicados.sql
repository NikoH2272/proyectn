-- =====================================================================
--  PUMAS GAMING · 34 · Limpiar duplicados del juego (una sola vez)
--  Para cada jugador (mismo nombre, mismo portal) conserva únicamente
--  la entrada con la puntuación más alta y borra las demás.
--  Seguro de correr varias veces (idempotente).
-- =====================================================================

delete from public.din_entradas
where tipo = 'juego'
  and id not in (
      -- El ID con la puntuación más alta de cada jugador por portal
      select distinct on (portal, lower(nombre))
             id
        from public.din_entradas
       where tipo = 'juego'
       order by portal,
                lower(nombre),
                (metadata->>'puntos')::int desc nulls last,
                creado desc   -- desempate: el más reciente si empatan puntos
  );
