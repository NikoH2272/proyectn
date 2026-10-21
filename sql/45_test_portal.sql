-- =====================================================================
--  PUMAS GAMING · 45 · Portal de pruebas para juegos
--  Crea el portal "testdev" aislado de producción.
--  Los scores van a din_entradas con portal='testdev' — no afecta nada.
--  Para limpiar manualmente:
--    DELETE FROM din_entradas WHERE portal = 'testdev';
-- =====================================================================

-- ── Portal de pruebas ─────────────────────────────────────────────────
insert into public.portales (id, nombre, color)
values ('testdev', 'Test Dev', '#FF6B35')
on conflict (id) do nothing;

-- ── Sesiones activas para los tres juegos ────────────────────────────
insert into public.din_sesiones (portal, tipo, activo, titulo, config)
values
    ('testdev', 'juego',         true, '🐍 Snake [TEST]',         '{}'),
    ('testdev', 'juego_tetris',  true, '🟦 Tetris [TEST]',        '{}'),
    ('testdev', 'juego_3lineas', true, '✕○ 3 en Línea [TEST]',   '{}')
on conflict (portal, tipo) do update set activo = true;

-- ── Verificar ────────────────────────────────────────────────────────
select p.id, p.nombre, s.tipo, s.activo
from public.portales p
join public.din_sesiones s on s.portal = p.id
where p.id = 'testdev'
order by s.tipo;
