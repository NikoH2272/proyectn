# SQL de Pumas Gaming

Se ejecutan **en orden** en Supabase → SQL Editor. Cada archivo se puede volver a correr sin duplicar nada. El 01 ya no toca las funciones de login (viven en 02/05), así que volver a correrlo no rompe los roles.

| # | Archivo | Qué hace | ¿Ejecutado? |
|---|---------|----------|-------------|
| 01 | `01_admins_portales.sql` | Login por usuario (sin @), contraseñas cifradas, sesiones, efecto global | ☐ |
| 02 | `02_roles_usuarios.sql` | Catálogo de portales, roles, permisos y gestión de usuarios | ☐ |
| 03 | `03_datos_portales.sql` | Tablas de datos de los portales, vistas de tabla general y storage | ☐ |
| 04 | `04_corregir_usuarios.sql` | Revisa y fuerza el rol correcto de cada admin; reset de clave de adminpumas | ☐ |
| 05 | `05_reparar_funciones.sql` | Repara login/sesión/permisos si se volvió a correr el 01 después del 02 | ☐ |
| 06 | `06_dragonfest.sql` | Portales Dragon Fest (mixto y femenino) y su rol compartido | ☐ |
| 07 | `07_entrenos_latam.sql` | Entrenos LATAM: vistas que juntan los entrenos (0 bytes extra), links de grupos, tablas más livianas | ☐ |
| 08 | `08_latam_con_pumas.sql` | Pumas entra en Entrenos LATAM (vistas con UNION, sin copiar datos) | ☐ |
| 09 | `09_guardar_y_corregir_entrenos.sql` | Guardar entrenos desde cada herramienta; superadmin borra entrenos y corrige nombres | ☐ |
| 10 | `10_zmf_femenino.sql` | ZMF mixto y femenino: portal zmffem y rol de ZMF con los dos | ☐ |
| 11 | `11_links_grupos.sql` | Links de WhatsApp de cada entreno en `portales.link` | ☐ |
| 12 | `12_optimizar_latam_y_respaldo.sql` | LATAM calculado en la base (pocos KB por visita) + respaldo para superadmin | ☐ |
| 13 | `13_historico_ordenable.sql` | Histórico Top 100 ordenable por PR o PG (portales y LATAM) | ☐ |
| 14 | `14_top_killers.sql` | Top killers con mínimo 3 salas + top por kills totales | ☐ |
| 15 | `15_top_booyah.sql` | Destacado Top Booyah (5 equipos con más booyahs) | ☐ |
| 16 | `16_ranking_pr_pg_kills.sql` | Top 50 e Histórico ordenables por PR, PG o KILLS | ☐ |
| 17 | `17_ascensos_modulos_sorteos.sql` | Ascensos AZA y Pruebas (base aparte), baneados, módulos creados desde el panel, torneos aliados, sorteos por portal y cupos para cualquier portal. Crea el usuario `pruebas` | ☐ |
| 18 | `18_roles_ascensos_ia.sql` | Rol **Administrador Ascensos** (todos los ascensos) con sub roles por ascenso (AZA, QFD, Pruebas); permiso y límite diario de la lectura con IA (solo Ascensos AZA) y motores activos (Gemini, privado, Claude) que elige el superadmin (ver `docs/IA_ASCENSOS.md`) | ☐ |
| 19 | `19_moderadores_aza_y_vip.sql` | Moderadores de Ascensos AZA (los crea el Administrador Ascensos; IA apagada por defecto y eventos habilitados por moderador) y registro VIP de Entrenos Pumas (`/entrenamientos/vip.html`) | ☐ |
| 20 | `20_aza_moderadores_y_baneados_cupos.sql` | El usuario de AZA también crea, modifica y elimina moderadores; los equipos baneados no pueden inscribirse a cupos (ni como staff) | ☐ |
| 21 | `21_corregir_hora_entreno.sql` | Corregir entrenos: también la fecha/hora y la jornada (ej. BLOQUE A de Dragon Fest) | ☐ |
| 22 | `22_vip_codigos.sql` | Registro VIP solo con código de acceso que genera el admin de Pumas (la página ya no está en los menús) | ☐ |
| 23 | `23_resultados_completos.sql` | Resultados completos de la sala (.csv): estadísticas por jugador (daño, headshots, gloo, revividas, tiempo vivo, armas). Solo Entrenos Pumas; el superadmin habilita más eventos | ☐ |
| 24 | `24_cupos_contador.sql` | Cupos: los programados salen con contador hasta que se abren, y la inscripción revisa que el cupo sea del portal de la página | ☐ |
| 25 | `25_cupos_vip_y_baneos.sql` | Cupos PÚBLICOS o VIP (VIP solo con el nombre y número registrados), baneo por equipo y por número (sin cupo), y "Generar baneo" desde los resultados. Pumas y Pruebas | ☐ |
| 26 | `26_datos_prueba_pruebas.sql` | **Opcional.** Datos de ejemplo SOLO para el módulo de Pruebas: lista VIP, baneados (equipo y número) y cupos públicos, VIP y programados. Se borran con el bloque del final | ☐ |
| 27 | `27_aza_portal_aparte.sql` | Ascensos AZA como portal aparte: sus usuarios (admins y moderadores) solo los ve el superadmin, en su ventana "Ascensos AZA · subusuarios"; los moderadores solo los manejan el superadmin y los admins de AZA | ☐ |
| 28 | `28_pumas_portal_aparte.sql` | Entrenos Pumas como portal aparte: Configuración (qué secciones ve el público) y usuarios del staff de Pumas con los módulos del panel que cada uno puede usar. Solo el superadmin los ve en Usuarios y roles | ☐ |
| 29 | `29_latam_semana_actual.sql` | Entrenos: la tabla de la semana (lunes a domingo) siempre muestra la semana actual; si todavía no hay resultados, sale vacía con aviso (ya no salta a la semana pasada) | ☐ |
| 30 | `30_cupos_vip_baneos_portales.sql` | Habilita VIP y baneos por portal, repara permisos de roles, valida el portal al inscribirse y revoca el RPC sin ámbito; AZA queda sin VIP | ☐ |
| 31 | `31_usuarios_por_portal.sql` | Usuarios propios de cada portal: el admin del portal crea su staff (solo entra a ese portal) y el superadmin ve los usuarios de cada portal y crea sus administradores | ☐ |
| 32 | `32_secciones_por_usuario.sql` | Usuarios del portal: a cada usuario del staff se le eligen las secciones del panel que ve (herramienta, cupos, baneados…), además de su rol | ☐ |

Cuando ejecutes uno, cambia ☐ por ☑ y súbelo a git, para que los dos sepamos en qué estado está la base.

## Reglas

1. **No se edita un archivo que ya se ejecutó.** Cualquier cambio va en un archivo nuevo con el siguiente número (`04_...`, `05_...`).
2. Cada archivo nuevo empieza con un comentario que dice qué hace y qué necesita.
3. Si un SQL falla, copia el error completo en el chat antes de intentar arreglarlo a mano.

## Modelo

```
portales ──< roles.portales          (qué ve cada rol)
roles    ──< usuarios_admin.rol      (cada usuario tiene un rol)

portales ──< portal_equipos
portales ──< portal_sesiones ──< portal_salas
                             └──< portal_killers
portales ──< portal_programados ──< portal_cupos

v_tabla_general        → por portal y equipo (incluye Pumas/entrenamientos)
v_tabla_general_todos  → un equipo sumado en todos los portales

storage: portales-logs/<portal>/...   portales-logos/<portal>/...

LATAM (solo vistas, no copian datos; leen portales.latam = true):
v_latam_sesiones  → entrenos LATAM (calendario)
v_latam_equipos   → 1 fila por equipo por entreno (PG, kills, booyahs, salas)
v_latam_killers   → 1 fila por jugador por entreno (kills, salas → KDA)

ASCENSOS (base aparte, sql/17; no entra a LATAM):
asc_jornadas   → 1 fila por jornada (equipos y clasificados en jsonb, categoría)
asc_baneados   → equipos baneados por portal (lista pública)

SITIO Y SORTEOS (sql/17):
portales.logo/titulo/color_tema/color2/tipo → personalización y módulos (tipo 'modulo' → /modulo/?p=<id>)
sitio_config, torneos_aliados               → sección "Torneos aliados" del inicio
sorteos ──< sorteo_registros                → un sorteo por portal (contacto privado)
portal_programados ──< portal_cupos         → cupos de cualquier portal (vía funciones)
```
