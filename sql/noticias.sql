-- =====================================================================
-- PROYECTN · Tabla noticias
-- Correr en Supabase SQL Editor
-- =====================================================================

create table if not exists noticias (
  id          uuid        primary key default gen_random_uuid(),
  tipo        text        not null check (tipo in ('actualizacion', 'ffws', 'recomendacion')),
  fecha_display text      not null default '',
  contenido   text        not null,
  url         text,
  activo      boolean     not null default true,
  orden       int         not null default 0,
  created_at  timestamptz not null default now()
);

-- índice para listado ordenado
create index if not exists noticias_tipo_orden_idx on noticias (tipo, orden, created_at desc);

-- RLS
alter table noticias enable row level security;

-- Lectura pública (solo activas)
drop policy if exists "noticias_select_public" on noticias;
create policy "noticias_select_public" on noticias
  for select
  using (activo = true);

-- Escritura solo desde service_role (el cliente de admin usa la clave service)
-- Si usas la clave anon en admin, reemplaza por la función de sesión de tu portal:
drop policy if exists "noticias_write_service" on noticias;
create policy "noticias_write_service" on noticias
  for all
  using (current_setting('role') = 'service_role')
  with check (current_setting('role') = 'service_role');

-- ---- datos de ejemplo (opcional, borrar luego) ----------------------
insert into noticias (tipo, fecha_display, contenido, orden) values
  ('actualizacion', 'Oct 2026', 'Portal PROYECTN v6.9 — nuevo diseño, paleta neon verde y hub de admin restructurado.', 1),
  ('actualizacion', 'Oct 2026', 'Herramienta de Resultados FF disponible en /herramienta/ con soporte para Mapas y Plantillas próximamente.', 2),
  ('recomendacion', 'Tip', 'Usa la herramienta de resultados para generar tablas en segundos desde los archivos de sala.', 1),
  ('recomendacion', 'Tip', 'El portal de cupos permite apartar lugar antes de cada entrenamiento. Abre a las 8 PM hora RD.', 2);
