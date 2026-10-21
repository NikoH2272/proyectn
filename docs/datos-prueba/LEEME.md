# Datos de prueba

## Logs para "Generar baneo" (Entrenos Pumas)

Son 4 salas inventadas (`MatchResult_210000000000000000X_...log`). Súbelas en
**Admin Pumas → CARGAR → Cargar**, confirma los nombres y toca
**GENERAR BANEO** (o guarda, y la ventana se abre sola).

Deben salir 3 equipos:

| Equipo | Qué pasó | Motivo que sale |
|---|---|---|
| TOXIC SQUAD | Jugó S1, S2 y S3, no la última | No jugó la última sala |
| GHOST TEAM | Solo jugó S1 | Jugó 1 de 4 salas · No jugó la última sala |
| CHILL | Jugó S2 y S3 | No jugó la última sala |

Los otros 9 equipos jugaron las 4 salas y no salen.

Con **Banear** el equipo queda baneado y también los números con que ese
equipo se inscribió a los cupos en los últimos 30 días. Con **Perdonar** solo
se quita de la lista.

> Ojo: si guardas estos resultados, quedan como un entreno real de Pumas.
> Para solo probar la ventana usa el botón **GENERAR BANEO** sin guardar.

## Módulo de Pruebas: VIP, baneados y cupos

Corre `sql/26_datos_prueba_pruebas.sql` en Supabase (después de `sql/25`).
Deja lista VIP, baneados (equipo y número) y cupos públicos, VIP y programados
en el portal de Pruebas. Los cupos públicos salen en `/pruebas/cupos.html` y
los VIP solo en la página oculta `/pruebas/cupos-vip.html`. Al principio del
archivo están los casos para probar y cómo borrar los ejemplos.
