# Cupos, VIP y baneos por portal

## Objetivo

Cada portal administra sus propios cupos y sus reglas de VIP/baneo. Las páginas públicas consultan el ID del portal al que pertenecen. Dragon Fest y ZMF tienen IDs separados para mixto y femenino; sus datos no se combinan aunque compartan panel administrativo.

Entrenos LATAM es un agregador de resultados, no una página de cupos. El panel central `/admin/` tampoco lista cupos de todos los portales.

## Portales

| Portal / ID de datos | Cupos públicos | VIP | Baneos |
|---|---|---|---|
| Entrenamientos / `entrenamientos` | Flujo especial de Pumas | Sí, flujo existente | Sí, flujo existente |
| AZA / `ascensosaza` | Sí | No | Sí; conserva la gestión de baneos y el análisis de ascensos existente |
| Pruebas / `pruebas` | Sí | Sí, flujo existente | Sí, flujo existente |
| QFD / `ascensosqfd` | Sí | Sí | Sí |
| ROW / `row` | Sí | Sí | Sí |
| Rusheo / `rusheo` | Sí | Sí | Sí |
| Dragon Fest mixto / `dragonfest` | Sí | Sí | Sí |
| Dragon Fest femenino / `dragonfestfem` | Sí | Sí | Sí |
| ZMF mixto / `zmf` | Sí | Sí | Sí |
| ZMF femenino / `zmffem` | Sí | Sí | Sí |
| Módulos dinámicos / ID del módulo | Sí | Sí | Sí |

AZA no debe crear ni publicar cupos VIP. SQL 30 también rechaza ese tipo de cupo en la API y en la validación de inscripciones. La lista y las reglas que determinan qué equipos cumplen los parámetros de ascenso siguen perteneciendo a la herramienta de AZA; no se sustituyen por la lista VIP.

## Flujo de administración

### Cupos públicos

En el panel local de cada portal, abre **Cupos**, completa título, fecha, cantidad de cupos y enlace del grupo. Se puede añadir una lista de equipos asegurados por el staff y programar la hora de publicación. El panel muestra las inscripciones y permite cerrar, reabrir, finalizar, quitar un equipo o borrar la jornada.

La página pública `cupos.html` consulta únicamente el ID de ese portal. Las rutas femeninas usan `cupos-femenino.html` y no consultan los cupos mixtos.

### Cupos VIP

1. En el panel del portal, añade cada equipo VIP con el número de contacto usado para inscribirse.
2. En **VIP · horarios y equipos autorizados**, selecciona el día, habilita los horarios, define cupos y pega el enlace de grupo correspondiente.
3. Crea los horarios. El panel genera el registro VIP y muestra el enlace de la página VIP oculta.
4. Copia ese enlace y compártelo directamente con los equipos autorizados. No se agrega a la navegación pública.

La página VIP tiene una ruta diferente por portal y categoría. Los módulos dinámicos usan `modulo/cupos-vip.html?p=<id>`. La página muestra solo jornadas VIP abiertas de ese mismo ID. La inscripción debe coincidir con el nombre del equipo y el número VIP registrado; la base compara nombres normalizados y los últimos diez dígitos del teléfono.

Los enlaces VIP son ocultos por navegación, no un mecanismo de autenticación. No deben publicarse en listados generales.

### Baneos

En **Baneos por equipo o teléfono**, se puede registrar un equipo, un número o ambos, con motivo y fecha de vencimiento opcional. Un baneo sin fecha no vence. La validación ocurre al insertar la inscripción, así que afecta tanto cupos públicos como VIP y no depende solo de que el formulario web oculte un botón.

Los equipos baneados vigentes se muestran en la página pública de su propio portal. Los números y sus registros permanecen privados y solo los consulta el administrador autorizado. Un baneo no elimina inscripciones anteriores; bloquea inscripciones nuevas mientras esté vigente.

El panel de AZA mantiene además su gestión histórica de baneados y el flujo que presenta los equipos candidatos según los parámetros de ascenso. Esa herramienta no se reemplaza por VIP.

## Aislamiento y seguridad

- Cada página pasa a `PumasCupos` o `PumasControl` el ID que le corresponde. Dragon Fest femenino usa `dragonfestfem`; ZMF femenino usa `zmffem`.
- `cupos_publicos` filtra las jornadas por `portal`; la respuesta pública no contiene teléfonos.
- Las funciones administrativas reciben el ID del portal y verifican la sesión/permisos antes de listar o modificar sus registros.
- `cupo_inscribir_portal` verifica que la jornada pertenezca al ID recibido.
- SQL 30 revoca el acceso público al RPC anterior `cupo_inscribir`, que no recibía ID de portal. Las páginas deben usar la ruta con ámbito de portal.
- La lista pública de baneados solo contiene equipos; los teléfonos de baneo y la lista VIP no se leen desde la página pública.

Como toda inscripción pública, los cupos visibles no son privados frente a alguien que inspeccione directamente las llamadas públicas de Supabase. El aislamiento aquí impide que las páginas y paneles del sitio mezclen portales; no convierte los horarios públicos en contenido autenticado.

## Base de datos

SQL 30 es una migración idempotente y se aplica después de las migraciones históricas **01 a 29, en orden**. Está en [`sql/30_cupos_vip_baneos_portales.sql`](../sql/30_cupos_vip_baneos_portales.sql), y su registro está en [`sql/README.md`](../sql/README.md).

La migración:

- conserva los permisos actuales de cada rol y agrega sus IDs propios, incluidos ambos IDs de Dragon Fest y ZMF;
- restaura la función de inscripción con validación de propiedad del cupo;
- deshabilita el RPC de inscripción sin ámbito de portal;
- concede los permisos de ejecución para cupos, VIP y baneos;
- impide que AZA active o acepte inscripciones VIP;
- no crea jornadas de ejemplo ni modifica inscripciones, listas VIP o baneos existentes.

No se debe ejecutar SQL 30 antes de las migraciones previas: necesita tablas, roles, triggers y funciones que estas crean. Después de ejecutarlo en Supabase, marca la fila 30 como aplicada en `sql/README.md`. No se aplicó la migración desde esta sesión.

## Verificación manual

1. Abre cada portal y confirma que su página pública muestre solo sus cupos y baneos.
2. Crea una jornada pública y confirma que aparezca solo en la página de ese portal.
3. Para cada portal con VIP, registra un equipo y comprueba que el enlace copiado abra la página VIP correspondiente; no debe abrir la lista VIP de otra categoría.
4. Prueba una inscripción VIP con el nombre y número correctos y otra con datos diferentes; la segunda debe rechazarse.
5. Banea un equipo y luego un número. Confirma que no puedan inscribirse en cupos públicos ni VIP, que el equipo se muestre públicamente y que el número no aparezca fuera del panel.
6. Comprueba que una fecha de vencimiento pasada ya no bloquee la inscripción.
7. En AZA, confirma que el administrador solo pueda crear cupos públicos y que su flujo de ascensos siga generando la lista basada en sus parámetros.
8. En un módulo dinámico, verifica que tanto la página como las llamadas RPC usen el mismo `id` de módulo.

## Código compartido

- `portal-kit/cupos.js`: páginas públicas y administración de cupos.
- `portal-kit/cupos-control.js`: administración VIP, baneos y enlace oculto VIP.
- `portal-kit/baneados.js`: lista pública de equipos baneados.
- `portal-kit/portal.js`: llamadas RPC con el ID del portal.
