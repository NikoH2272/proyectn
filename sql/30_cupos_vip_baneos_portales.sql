-- =====================================================================
-- PUMAS GAMING · 30 · VIP y baneos aislados por portal
-- Requiere las migraciones historicas 01 a 29 aplicadas en orden.
--
-- - Asegura permisos propios de cupos para los roles de cada portal.
-- - Mantiene Dragon Fest y ZMF separados por categoria.
-- - AZA conserva ascensos y baneos, pero no admite cupos VIP.
-- - Exige que el cupo pertenezca al portal indicado al inscribirse.
-- - Retira el RPC antiguo que aceptaba un ID de cupo sin portal.
-- - Reaplica permisos RPC de cupos, lista VIP y baneos.
-- - No crea cupos de ejemplo ni modifica inscripciones, VIP o baneos guardados.
-- =====================================================================

begin;

do $$
declare
    portales_faltantes text[];
    roles_faltantes text[];
begin
    select array_agg(requerido.id order by requerido.id)
      into portales_faltantes
      from (values
          ('ascensosaza'), ('ascensosqfd'), ('pruebas'), ('row'), ('rusheo'),
          ('dragonfest'), ('dragonfestfem'), ('zmf'), ('zmffem')
      ) as requerido(id)
     where not exists (select 1 from public.portales p where p.id = requerido.id);

    if portales_faltantes is not null then
        raise exception 'Faltan portales. Ejecuta las migraciones historicas requeridas: %',
            array_to_string(portales_faltantes, ', ');
    end if;

    select array_agg(requerido.id order by requerido.id)
      into roles_faltantes
      from (values
          ('aza'), ('moderador_aza'), ('administradorascensos'), ('pruebas'), ('qfd'), ('row'),
          ('rusheo'), ('dragonfest'), ('zmf')
      ) as requerido(id)
     where not exists (select 1 from public.roles r where r.id = requerido.id);

    if roles_faltantes is not null then
        raise exception 'Faltan roles. Ejecuta las migraciones historicas requeridas: %',
            array_to_string(roles_faltantes, ', ');
    end if;

    if to_regprocedure('public.cupo_inscribir(bigint,text,text)') is null then
        raise exception 'No existe cupo_inscribir(bigint,text,text). Ejecuta primero SQL 17 y 20.';
    end if;
end $$;

-- Agrega permisos propios sin eliminar otros portales que el rol ya administra.
update public.roles as r
   set portales = (
       select array_agg(distinct p.portal_id order by p.portal_id)
         from unnest(coalesce(r.portales, '{}'::text[]) || requerido.portales) as p(portal_id)
   )
  from (values
      ('aza',                   array['ascensosaza']::text[]),
    ('moderador_aza',         array['ascensosaza']::text[]),
      ('administradorascensos', array['ascensosaza', 'ascensosqfd', 'pruebas']::text[]),
      ('pruebas',               array['pruebas']::text[]),
      ('qfd',                   array['ascensosqfd']::text[]),
      ('row',                   array['row']::text[]),
      ('rusheo',                array['rusheo']::text[]),
      ('dragonfest',            array['dragonfest', 'dragonfestfem']::text[]),
      ('zmf',                   array['zmf', 'zmffem']::text[])
  ) as requerido(id, portales)
 where r.id = requerido.id;

-- La pagina envia su propio ID; no permite inscribir desde un portal en otro.
create or replace function public.cupo_inscribir_portal(
    p_portal text,
    p_programado bigint,
    p_equipo text,
    p_telefono text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    portal_cupo text;
begin
    select g.portal into portal_cupo
      from public.portal_programados g
     where g.id = p_programado;

    if not found or portal_cupo is distinct from p_portal then
        raise exception 'Ese cupo no es de este portal';
    end if;

    return public.cupo_inscribir(p_programado, p_equipo, p_telefono);
end $$;

-- AZA no administra VIP; rechazarlo tambien en el trigger de inscripcion.
create or replace function public._revisar_cupo(p_portal text, p_tipo text, p_equipo text, p_tel text)
returns void
language plpgsql
stable
set search_path = public
as $$
begin
    if p_portal = 'ascensosaza' and coalesce(p_tipo, 'PUBLICO') = 'VIP' then
        raise exception 'Ascensos AZA no admite cupos VIP';
    end if;
    if _baneado(p_portal, p_equipo) then
        raise exception 'Este equipo está baneado y no puede inscribirse a los cupos';
    end if;
    if _tel_baneado(p_portal, p_tel) then
        raise exception 'Este número está baneado y no puede inscribirse a los cupos';
    end if;
    if coalesce(p_tipo, 'PUBLICO') = 'VIP' and not _es_vip(p_portal, p_equipo, p_tel) then
        raise exception 'Este entreno es solo para equipos VIP: inscríbete con el mismo nombre de equipo y número con que te registraste como VIP';
    end if;
end $$;
revoke execute on function public._revisar_cupo(text, text, text, text) from public, anon, authenticated;

create or replace function public.admin_cupo_tipo(p_token uuid, p_portal text, p_id bigint, p_tipo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if p_tipo not in ('PUBLICO', 'VIP') then raise exception 'Tipo inválido'; end if;
    if p_portal = 'ascensosaza' and p_tipo = 'VIP' then
        raise exception 'Ascensos AZA no admite cupos VIP';
    end if;
    update public.portal_programados set tipo = p_tipo where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

create or replace function public.admin_cupo_vip(p_token uuid, p_portal text, p_id bigint, p_cierra_en timestamptz)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
    perform _exigir_permiso(p_token, 'portal:' || p_portal);
    if p_portal = 'ascensosaza' then raise exception 'Ascensos AZA no admite cupos VIP'; end if;
    update public.portal_programados set tipo = 'VIP', cierra_en = p_cierra_en where id = p_id and portal = p_portal;
    return json_build_object('ok', true);
end $$;

-- Los endpoints leen y escriben por portal; los administradores requieren sesion y permiso.
revoke all on function public.cupo_inscribir(bigint, text, text) from public, anon, authenticated;
grant execute on function public.cupos_publicos(text) to anon, authenticated;
grant execute on function public.cupo_inscribir_portal(text, bigint, text, text) to anon, authenticated;
grant execute on function public.admin_cupos_listar(uuid, text) to anon, authenticated;
grant execute on function public.admin_cupo_guardar(uuid, text, text, timestamptz, int, text, timestamptz, text[]) to anon, authenticated;
grant execute on function public.admin_cupo_estado(uuid, text, bigint, text) to anon, authenticated;
grant execute on function public.admin_cupo_borrar(uuid, text, bigint) to anon, authenticated;
grant execute on function public.admin_cupo_quitar(uuid, text, bigint) to anon, authenticated;
grant execute on function public.admin_cupo_tipo(uuid, text, bigint, text) to anon, authenticated;
grant execute on function public.admin_cupo_vip(uuid, text, bigint, timestamptz) to anon, authenticated;
grant execute on function public.admin_vip_lista(uuid, text) to anon, authenticated;
grant execute on function public.admin_vip_guardar(uuid, text, text, text) to anon, authenticated;
grant execute on function public.admin_vip_borrar(uuid, text, bigint) to anon, authenticated;
grant execute on function public.admin_baneos_lista(uuid, text) to anon, authenticated;
grant execute on function public.admin_baneo_guardar(uuid, text, text, text, text, date) to anon, authenticated;
grant execute on function public.admin_baneo_borrar(uuid, text, text, bigint) to anon, authenticated;
grant execute on function public.admin_baneo_resultados(uuid, text, text, text, date) to anon, authenticated;

commit;

-- Verificacion de permisos despues de ejecutar la migracion.
select id, portales
  from public.roles
 where id in ('aza', 'moderador_aza', 'administradorascensos', 'pruebas', 'qfd', 'row', 'rusheo', 'dragonfest', 'zmf')
 order by id;