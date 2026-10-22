-- 51 · Imagen de resultados en jornadas de ascensos
-- Agrega la columna imagen a asc_jornadas, la función para actualizarla
-- y el bucket de almacenamiento para las imágenes 2000×2000.

-- 1) Columna en la tabla
alter table public.asc_jornadas
    add column if not exists imagen text;

-- 2) Función para actualizar la imagen de una jornada ya guardada
--    (se llama después de subir el PNG a storage)
create or replace function public.asc_actualizar_imagen(
    p_token  uuid,
    p_portal text,
    p_id     bigint,
    p_imagen text
)
returns json
language plpgsql security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    update asc_jornadas
       set imagen = nullif(trim(coalesce(p_imagen, '')), '')
     where id = p_id and portal = p_portal;
    if not found then
        raise exception 'Jornada no encontrada';
    end if;
    return json_build_object('ok', true);
end $$;

grant execute on function public.asc_actualizar_imagen(uuid, text, bigint, text)
    to anon, authenticated;

-- 3) Bucket público para las imágenes de resultados (máx. 2 MB, solo PNG)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asc-imagenes', 'asc-imagenes', true, 2097152, array['image/png'])
on conflict (id) do nothing;

-- 4) Políticas de acceso al bucket
drop policy if exists "asc imagenes select"  on storage.objects;
drop policy if exists "asc imagenes insert"  on storage.objects;

create policy "asc imagenes select" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'asc-imagenes');

create policy "asc imagenes insert" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'asc-imagenes');
